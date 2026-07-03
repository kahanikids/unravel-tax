import { useEffect, useState } from "react";
import {
  deriveComputedFields,
  formatFixtureDate,
  parseFile,
  parsePastedExtraction,
  reparseWithColumnMap,
  type ExtractionSummaryFigures,
  type IngestResult,
  type IngestWarning,
  type NormalizedTransaction
} from "../ingest";
import { EXPECTED_TRANSACTION_COLUMNS } from "../ingest/types";
import type { CanonicalTransactionColumn } from "../ingest/headerMatching";
import type { RawSheet } from "../lib";

/** Dates from Excel/HTML arrive as Date objects; flatten to a stable string so the reference sheet and saved session hold plain primitives. */
function toRawSheet(headers: string[], records: Record<string, string | number | Date>[]): RawSheet {
  return {
    headers,
    records: records.map((record) => {
      const flat: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(record)) {
        flat[key] = value instanceof Date ? formatFixtureDate(value) : value;
      }
      return flat;
    })
  };
}

export type UploadedDocument = {
  fileName: string;
  rowCount: number;
};

type PendingReview = {
  fileName: string;
  ingest: IngestResult;
  transactions: NormalizedTransaction[];
  warnings: IngestWarning[];
  columnAssignments: Partial<Record<CanonicalTransactionColumn, string>>;
};

export function UploadStep({
  documents,
  onCommit,
  onCommitReference,
  onApplySummaryFigures,
  onRemove,
  onContinue,
  localFolderSupported,
  localFolderName,
  onChooseLocalFolder
}: {
  documents: UploadedDocument[];
  onCommit: (transactions: NormalizedTransaction[], fileName: string) => void;
  onCommitReference: (fileName: string, rawSheet: RawSheet) => void;
  /** Push recognised annual totals into the results-screen "A few more numbers" fields, plus a net-gain-with-no-detail flag. */
  onApplySummaryFigures?: (figures: ExtractionSummaryFigures, netGainOnly: boolean) => void;
  onRemove: (index: number) => void;
  onContinue: () => void;
  localFolderSupported: boolean;
  localFolderName: string | null;
  onChooseLocalFolder: () => void;
}) {
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [awaitingPaste, setAwaitingPaste] = useState<{ fileName: string; reason?: string } | null>(null);
  // A paste that yielded only annual totals / a net-gain-only marker (no usable
  // transaction rows) lands here instead of dead-ending as a generic error.
  const [summaryGuidance, setSummaryGuidance] = useState<{
    fileName: string;
    figures?: ExtractionSummaryFigures;
    netGainOnly: boolean;
    documentType?: string;
    notes?: string;
  } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  // Files chosen together are reviewed one at a time; the rest wait here and
  // advance automatically as each is added, discarded, or skipped.
  const [queue, setQueue] = useState<File[]>([]);

  useEffect(() => {
    if (!awaitingPaste || extractionPrompt) {
      return;
    }
    fetch(`${import.meta.env.BASE_URL}extraction-prompt.txt`)
      .then((response) => response.text())
      .then(setExtractionPrompt)
      .catch(() => setExtractionPrompt("Could not load extraction prompt. See prompts/01-extract-statement.md in the repo."));
  }, [awaitingPaste, extractionPrompt]);

  /** Opens the right review UI for a file. Returns true when it needs the user
   * (a review modal or the paste panel), false when nothing interactive opened
   * (a hard error) so a queued batch can move on to the next file. */
  function openReview(fileName: string, result: IngestResult): boolean {
    const missingCols = EXPECTED_TRANSACTION_COLUMNS.filter(
      (col) => !Object.values(result.headerMap).includes(col)
    );

    if (result.transactions.length > 0) {
      setPending({
        fileName,
        ingest: result,
        transactions: result.transactions,
        warnings: result.warnings,
        columnAssignments: {}
      });
      return true;
    }

    if (result.sourceHeaders.length > 0 && missingCols.length > 0) {
      setPending({
        fileName,
        ingest: result,
        transactions: [],
        warnings: result.warnings,
        columnAssignments: {}
      });
      return true;
    }

    if (result.promptRoute) {
      setAwaitingPaste({ fileName, reason: result.promptRoute.reason });
      return true;
    }

    setError(`Could not read any rows from ${fileName}. ${result.warnings[0]?.message ?? ""}`.trim());
    return false;
  }

  async function processFile(file: File) {
    setParsing(true);
    let opened = false;
    try {
      opened = openReview(file.name, await parseFile(file));
    } catch {
      setError(`Could not read ${file.name}.`);
    } finally {
      setParsing(false);
      setIsDragOver(false);
    }
    // A file that opened nothing interactive shouldn't stall the rest of a batch.
    if (!opened) {
      advanceQueue();
    }
  }

  // Pull the next queued file into review. Called at each terminal point of the
  // current file's review (added, discarded, skipped, or paste cancelled).
  function advanceQueue() {
    setQueue((prev) => {
      if (prev.length === 0) {
        return prev;
      }
      const [next, ...rest] = prev;
      void processFile(next);
      return rest;
    });
  }

  async function handleFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) {
      return;
    }
    setError(null);
    const [first, ...rest] = files;
    setQueue(rest);
    await processFile(first);
  }

  function handlePasteSubmit() {
    if (!awaitingPaste) {
      return;
    }
    setError(null);
    const result = parsePastedExtraction(pasteText);
    if (result.transactions.length > 0) {
      setPending({
        fileName: awaitingPaste.fileName,
        ingest: result,
        transactions: result.transactions,
        warnings: result.warnings,
        columnAssignments: {}
      });
      setAwaitingPaste(null);
      setPasteText("");
      return;
    }
    // No per-transaction rows, but the JSON was readable (a summary/annual-total
    // like a PMS annual report or AIS, or a holdings-only statement): guide the
    // user instead of dead-ending. Anything with figures, a net-gain marker, or
    // at least the AI's own documentType/notes counts as readable.
    if (result.summaryFigures || result.netGainOnly || result.documentType || result.notes) {
      setSummaryGuidance({
        fileName: awaitingPaste.fileName,
        figures: result.summaryFigures,
        netGainOnly: Boolean(result.netGainOnly),
        documentType: result.documentType,
        notes: result.notes
      });
      // Populate the results-screen fields now rather than asking the user to
      // retype these annual totals; the guidance panel below just points there.
      if (result.summaryFigures || result.netGainOnly) {
        onApplySummaryFigures?.(result.summaryFigures ?? {}, Boolean(result.netGainOnly));
      }
      setAwaitingPaste(null);
      setPasteText("");
      return;
    }
    setError(result.warnings[0]?.message ?? "Could not read that. Paste the whole JSON block the AI gave you.");
  }

  function dismissSummaryGuidance() {
    // A summary-only paste commits no document, so the step's own "Continue to
    // your results" stays disabled - if we only dismissed here, the recognised
    // figures would sit unseen on the results screen with no obvious way to get
    // there. So once there are no more queued files, take the user straight to
    // the results screen (where those figures now live) instead of stranding
    // them on the upload step.
    const recognised = Boolean(summaryGuidance?.figures || summaryGuidance?.netGainOnly);
    setSummaryGuidance(null);
    if (queue.length > 0) {
      advanceQueue();
    } else if (recognised) {
      onContinue();
    }
  }

  function applyColumnMap() {
    if (!pending) {
      return;
    }
    const result = reparseWithColumnMap(
      pending.ingest.kind,
      pending.ingest.sourceHeaders,
      pending.ingest.sourceRecords,
      pending.columnAssignments
    );
    if (result.transactions.length === 0) {
      setError(result.warnings.find((w) => w.code === "missing_column")?.message ?? "Still missing required columns.");
      return;
    }
    setPending({
      ...pending,
      ingest: result,
      transactions: result.transactions,
      warnings: result.warnings
    });
  }

  function confirmPending() {
    if (!pending || pending.transactions.length === 0) {
      return;
    }
    onCommit(pending.transactions, pending.fileName);
    setPending(null);
    advanceQueue();
  }

  // For a raw upload that isn't a capital-gains statement (bank interest,
  // dividends, MF holdings): keep its rows verbatim as a reference sheet in the
  // workbook rather than dropping the file. It contributes no tax figures.
  function addAsReference() {
    if (!pending) {
      return;
    }
    onCommitReference(pending.fileName, toRawSheet(pending.ingest.sourceHeaders, pending.ingest.sourceRecords));
    setPending(null);
    advanceQueue();
  }

  function discardPending() {
    setPending(null);
    advanceQueue();
  }

  function updatePendingRow(index: number, patch: Partial<NormalizedTransaction>) {
    setPending((prev) => {
      if (!prev) {
        return prev;
      }
      const transactions = [...prev.transactions];
      const merged = { ...transactions[index], ...patch };
      try {
        transactions[index] = deriveComputedFields(merged);
      } catch {
        transactions[index] = merged;
      }
      return { ...prev, transactions };
    });
  }

  function removePendingRow(index: number) {
    setPending((prev) => (prev ? { ...prev, transactions: prev.transactions.filter((_, i) => i !== index) } : prev));
  }

  const missingColumns = pending
    ? EXPECTED_TRANSACTION_COLUMNS.filter((col) => !Object.values(pending.ingest.headerMap).includes(col))
    : [];

  return (
    <div className="step-card">
      <h2>Add your documents</h2>
      <p className="step-lede">
        <span className="upload-lede-desktop">
          Add all your statements at once, or a few at a time. We'll walk through them one by one and show what we read
          before using anything. CSV, Excel, and saved webpages are read in your browser. PDFs and pasted text go through
          the guided extraction prompt.
        </span>
        <span className="upload-lede-mobile">Add your statements. Pick several at once if you like. We'll show what we read before using each.</span>
      </p>

      {parsing ? (
        <p className="upload-parsing-hint">Reading file{queue.length > 0 ? ` (${queue.length} more queued)` : ""}...</p>
      ) : (
        <div
          className={isDragOver ? "upload-dropzone upload-dropzone-active" : "upload-dropzone"}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            handleFiles(event.dataTransfer.files);
          }}
        >
          <span className="info-tip upload-info-tip">
            <button type="button" className="info-tip-trigger" aria-label="About adding documents">
              i
            </button>
            <span className="info-tip-bubble" role="tooltip">
              Drop files here, or click to choose. You can pick several at once. Broker/AMC capital gains statements
              are the main thing this step is for; bank interest, dividend, and MF statements can be added too.
            </span>
          </span>
          <label className="primary-button upload-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose files
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.html,.htm,.tsv,.txt,.pdf"
              multiple
              onChange={(event) => handleFiles(event.target.files)}
              hidden
            />
          </label>
        </div>
      )}

      {localFolderSupported ? (
        <div className="folder-panel">
          {localFolderName ? (
            <p className="folder-panel-selected">
              Saving a copy of each document to <strong>{localFolderName}</strong> on your computer as you go.
            </p>
          ) : (
            <button type="button" className="text-button" onClick={onChooseLocalFolder}>
              Save to a local folder
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}

      {awaitingPaste ? (
        <div className="paste-panel">
          <p>
            <strong>{awaitingPaste.fileName}</strong> needs the AI extraction step.
            {awaitingPaste.reason ? ` ${awaitingPaste.reason}` : " This app couldn't read it on its own."}
          </p>
          <ol className="paste-steps">
            <li>Copy the prompt below.</li>
            <li>Paste it into your AI chat of choice, along with the document.</li>
            <li>Paste the JSON it gives you back here.</li>
          </ol>
          <details className="extraction-prompt">
            <summary>Show the extraction prompt</summary>
            <pre>{extractionPrompt || "Loading prompt…"}</pre>
          </details>
          <textarea
            className="paste-textarea"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder="Paste the JSON here (a table still works if that's what you got back)."
            rows={6}
          />
          <div className="paste-actions">
            <button type="button" className="primary-button" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
              Read this
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAwaitingPaste(null);
                advanceQueue();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {summaryGuidance ? (
        <div className="paste-panel">
          <p>
            <strong>{summaryGuidance.fileName}</strong>
            {summaryGuidance.documentType ? ` looks like a ${summaryGuidance.documentType}` : " looks like a summary statement"}
            . It has no per-transaction buy/sell rows, so there's nothing to tax-calculate from it directly.
          </p>
          {(() => {
            const figures = summaryGuidance.figures;
            const annualRows: [string, number][] = figures
              ? (
                  [
                    ["Dividend income", figures.dividendIncome],
                    ["Interest income", figures.interestIncome],
                    ["TDS already deducted", figures.tdsDeducted],
                    ["Deductible charges (brokerage/PMS/STT/custodian)", figures.deductibleCharges]
                  ] as [string, number | undefined][]
                ).filter((row): row is [string, number] => typeof row[1] === "number")
              : [];
            return annualRows.length > 0 ? (
              <div>
                <p>
                  We recognised these annual figures and added them for you under{" "}
                  <strong>"A few more numbers"</strong> on the Current Filing page. Open that section and check them:
                </p>
                <ul className="paste-steps">
                  {annualRows.map(([label, value]) => (
                    <li key={label}>
                      {label}: <strong>₹{value.toLocaleString("en-IN")}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}
          {summaryGuidance.netGainOnly ? (
            <p className="inline-error">
              This statement only gives a <strong>net realised capital gain</strong>, with no per-transaction buy/sell
              dates. This tool can't split short-term vs long-term from a net figure, so it is <strong>not being used
              in any calculation</strong>. Get the detailed per-transaction capital-gains statement from your
              broker/AMC/PMS (or enter the short-term/long-term split yourself), then add that here.
            </p>
          ) : null}
          {summaryGuidance.notes ? (
            <p className="paste-steps">What the AI noted: {summaryGuidance.notes}</p>
          ) : null}
          <div className="paste-actions">
            <button type="button" className="primary-button" onClick={dismissSummaryGuidance}>
              {summaryGuidance.figures ? "See these on your results" : "Got it, continue"}
            </button>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-wide" role="dialog" aria-labelledby="confirm-title">
            <h3 id="confirm-title">Here's what we read from {pending.fileName}</h3>
            <p>Fix anything that's wrong, or remove a row entirely, before it's used anywhere.</p>

            {pending.warnings.length > 0 ? (
              <details className="ingest-warnings" open>
                <summary>{pending.warnings.length} note(s) about this file</summary>
                <ul>
                  {pending.warnings.map((warning, index) => (
                    <li key={`${warning.code}-${index}`}>{warning.message}</li>
                  ))}
                </ul>
              </details>
            ) : null}

            {missingColumns.length > 0 && pending.ingest.sourceHeaders.length > 0 ? (
              <div className="column-mapper">
                <p>
                  <strong>Map columns:</strong> we couldn't match every required column automatically. Pick the right
                  source column for each, then click Apply mapping.
                </p>
                {pending.ingest.promptRoute ? (
                  <p className="column-mapper-alt">
                    Or{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setAwaitingPaste({ fileName: pending.fileName, reason: pending.ingest.promptRoute?.reason });
                        setPending(null);
                      }}
                    >
                      use the AI extraction prompt
                    </button>{" "}
                    instead.
                  </p>
                ) : null}
                {missingColumns.map((column) => (
                  <label key={column} className="column-mapper-row">
                    <span>{column}</span>
                    <select
                      value={pending.columnAssignments[column] ?? ""}
                      onChange={(event) =>
                        setPending((prev) =>
                          prev
                            ? {
                                ...prev,
                                columnAssignments: {
                                  ...prev.columnAssignments,
                                  [column]: event.target.value || undefined
                                }
                              }
                            : prev
                        )
                      }
                    >
                      <option value="">— pick a column —</option>
                      {pending.ingest.sourceHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button type="button" className="text-button" onClick={applyColumnMap}>
                  Apply mapping
                </button>
              </div>
            ) : null}

            {pending.transactions.length === 0 ? (
              <p className="checklist-empty">Every row has been removed. Discard, or go back and re-add the document.</p>
            ) : (
              <div className="preview-table-wrap">
                <table className="preview-table preview-table-editable">
                  <thead>
                    <tr>
                      <th>Scrip</th>
                      <th>Purchase</th>
                      <th>Sell</th>
                      <th className="col-units">Units</th>
                      <th className="col-buy">Buy value</th>
                      <th className="col-sell">Sell value</th>
                      <th className="col-price">Buy price</th>
                      <th className="col-price">Sell price</th>
                      <th>Gain/(Loss)</th>
                      <th>Class</th>
                      <th aria-label="Remove row" />
                    </tr>
                  </thead>
                  <tbody>
                    {pending.transactions.map((row, index) => (
                      <tr key={index}>
                        <td data-label="Scrip">
                          <input
                            type="text"
                            value={row.scripName}
                            aria-label="Scrip name"
                            onChange={(event) => updatePendingRow(index, { scripName: event.target.value })}
                          />
                        </td>
                        <td data-label="Purchase">
                          <input
                            type="text"
                            value={row.purchaseDate}
                            aria-label="Purchase date"
                            placeholder="DD-MMM-YYYY"
                            onChange={(event) => updatePendingRow(index, { purchaseDate: event.target.value })}
                          />
                        </td>
                        <td data-label="Sell">
                          <input
                            type="text"
                            value={row.sellDate}
                            aria-label="Sell date"
                            placeholder="DD-MMM-YYYY"
                            onChange={(event) => updatePendingRow(index, { sellDate: event.target.value })}
                          />
                        </td>
                        <td className="col-units" data-label="Units">
                          <input
                            type="number"
                            value={row.units}
                            aria-label="Units"
                            onChange={(event) => updatePendingRow(index, { units: Number(event.target.value) || 0 })}
                          />
                        </td>
                        <td className="col-buy" data-label="Buy value">
                          <input
                            type="number"
                            value={row.buyValue}
                            aria-label="Buy value"
                            onChange={(event) => updatePendingRow(index, { buyValue: Number(event.target.value) || 0 })}
                          />
                        </td>
                        <td className="col-sell" data-label="Sell value">
                          <input
                            type="number"
                            value={row.sellValue}
                            aria-label="Sell value"
                            onChange={(event) => updatePendingRow(index, { sellValue: Number(event.target.value) || 0 })}
                          />
                        </td>
                        <td className="col-price" data-label="Buy price">
                          <input
                            type="number"
                            value={row.buyPrice}
                            aria-label="Buy price"
                            onChange={(event) => updatePendingRow(index, { buyPrice: Number(event.target.value) || 0 })}
                          />
                        </td>
                        <td className="col-price" data-label="Sell price">
                          <input
                            type="number"
                            value={row.sellPrice}
                            aria-label="Sell price"
                            onChange={(event) => updatePendingRow(index, { sellPrice: Number(event.target.value) || 0 })}
                          />
                        </td>
                        <td data-label="Gain">{row.gainLoss}</td>
                        <td data-label="Class">{row.taxClass}</td>
                        <td data-label="Action">
                          <button type="button" className="text-button" onClick={() => removePendingRow(index)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pending.transactions.length === 0 && pending.ingest.sourceRecords.length > 0 ? (
              <p className="column-mapper-alt">
                Not a capital-gains statement (e.g. bank interest, dividends, or an MF holdings list)?{" "}
                <button type="button" className="text-button" onClick={addAsReference}>
                  Keep it as a reference sheet
                </button>
                . Its rows go into your workbook as-is, without being tax-calculated.
              </p>
            ) : null}
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={confirmPending}
                disabled={pending.transactions.length === 0}
              >
                Looks right, add to my filing
              </button>
              <button type="button" className="text-button" onClick={discardPending}>
                Discard this document
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {documents.length > 0 ? (
        <div className="document-list">
          <h3>Added so far</h3>
          {documents.map((document, index) => (
            <div className="document-row" key={`${document.fileName}-${index}`}>
              <span>{document.fileName}</span>
              <span className="document-row-count">{document.rowCount} rows</span>
              <button type="button" className="text-button" onClick={() => onRemove(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="step-actions">
        <button type="button" className="primary-button" onClick={onContinue} disabled={documents.length === 0}>
          Continue to your results
        </button>
      </div>
      {documents.length === 0 ? (
        <p className="upload-empty-hint">
          Add a document to continue. Or, if you didn't sell any shares or mutual funds this year,{" "}
          <button type="button" className="text-button" onClick={onContinue}>
            skip this step
          </button>{" "}
          and type your dividend/interest figures in on the results screen.
        </p>
      ) : null}
    </div>
  );
}
