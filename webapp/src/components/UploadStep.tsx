import { useEffect, useState } from "react";
import {
  deriveComputedFields,
  parseFile,
  parsePastedExtraction,
  reparseWithColumnMap,
  type IngestResult,
  type IngestWarning,
  type NormalizedTransaction
} from "../ingest";
import { EXPECTED_TRANSACTION_COLUMNS } from "../ingest/types";
import type { CanonicalTransactionColumn } from "../ingest/headerMatching";

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
  onRemove,
  onContinue,
  localFolderSupported,
  localFolderName,
  onChooseLocalFolder
}: {
  documents: UploadedDocument[];
  onCommit: (transactions: NormalizedTransaction[], fileName: string) => void;
  onRemove: (index: number) => void;
  onContinue: () => void;
  localFolderSupported: boolean;
  localFolderName: string | null;
  onChooseLocalFolder: () => void;
}) {
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [awaitingPaste, setAwaitingPaste] = useState<{ fileName: string; reason?: string } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    if (!awaitingPaste || extractionPrompt) {
      return;
    }
    fetch(`${import.meta.env.BASE_URL}extraction-prompt.txt`)
      .then((response) => response.text())
      .then(setExtractionPrompt)
      .catch(() => setExtractionPrompt("Could not load extraction prompt. See prompts/01-extract-statement.md in the repo."));
  }, [awaitingPaste, extractionPrompt]);

  function openReview(fileName: string, result: IngestResult) {
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
      return;
    }

    if (result.sourceHeaders.length > 0 && missingCols.length > 0) {
      setPending({
        fileName,
        ingest: result,
        transactions: [],
        warnings: result.warnings,
        columnAssignments: {}
      });
      return;
    }

    if (result.promptRoute) {
      setAwaitingPaste({ fileName, reason: result.promptRoute.reason });
      return;
    }

    setError(result.warnings[0]?.message ?? "Could not read any transaction rows from that file.");
  }

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setParsing(true);
    try {
      openReview(file.name, await parseFile(file));
    } catch {
      setError("Could not read that file.");
    } finally {
      setParsing(false);
      setIsDragOver(false);
    }
  }

  function handlePasteSubmit() {
    if (!awaitingPaste) {
      return;
    }
    setError(null);
    const result = parsePastedExtraction(pasteText);
    if (result.transactions.length === 0) {
      setError(result.warnings[0]?.message ?? "Could not read that table.");
      return;
    }
    setPending({
      fileName: awaitingPaste.fileName,
      ingest: result,
      transactions: result.transactions,
      warnings: result.warnings,
      columnAssignments: {}
    });
    setAwaitingPaste(null);
    setPasteText("");
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
          One at a time: add a document, confirm what we read, then the next. CSV, Excel, and saved webpages are read
          in your browser. PDFs and pasted text go through the guided extraction prompt.
        </span>
        <span className="upload-lede-mobile">Add one statement at a time. We'll show what we read before using it.</span>
      </p>

      {parsing ? (
        <p className="upload-parsing-hint">Reading file...</p>
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
            handleFile(event.dataTransfer.files);
          }}
        >
          <label className="primary-button upload-button">
            Choose a file
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.html,.htm,.tsv,.txt,.pdf"
              onChange={(event) => handleFile(event.target.files)}
              hidden
            />
          </label>
          <p className="upload-hint">Drop a file here, or click to choose. Broker/AMC capital gains statements are the main thing this step is for.</p>
        </div>
      )}

      {localFolderSupported ? (
        <div className="folder-panel">
          {localFolderName ? (
            <p className="folder-panel-selected">
              Saving a copy of each document to <strong>{localFolderName}</strong> on your computer as you go.
            </p>
          ) : (
            <p className="folder-panel-copy">Want a copy of each document saved to a folder on your computer as you add it?</p>
          )}
          {!localFolderName ? (
            <button type="button" className="text-button" onClick={onChooseLocalFolder}>
              Save to a folder instead
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}

      {awaitingPaste ? (
        <div className="paste-panel">
          <p>
            <strong>{awaitingPaste.fileName}</strong> needs the AI extraction step.
            {awaitingPaste.reason ? ` ${awaitingPaste.reason}` : " This app couldn't find a transaction table on its own."}
          </p>
          <ol className="paste-steps">
            <li>Copy the prompt below.</li>
            <li>Paste it into your AI chat of choice, along with the document.</li>
            <li>Paste the table it gives you back here.</li>
          </ol>
          <details className="extraction-prompt">
            <summary>Show the extraction prompt</summary>
            <pre>{extractionPrompt || "Loading prompt…"}</pre>
          </details>
          <textarea
            className="paste-textarea"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder="Paste the extracted table here (markdown or tab-separated)."
            rows={6}
          />
          <div className="paste-actions">
            <button type="button" className="primary-button" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
              Read this table
            </button>
            <button type="button" className="text-button" onClick={() => setAwaitingPaste(null)}>
              Cancel
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
            <div className="modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={confirmPending}
                disabled={pending.transactions.length === 0}
              >
                Looks right, add to my filing
              </button>
              <button type="button" className="text-button" onClick={() => setPending(null)}>
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
      {documents.length === 0 ? <p className="upload-empty-hint">Add at least one document to continue.</p> : null}
    </div>
  );
}
