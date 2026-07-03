import { useState } from "react";
import { deriveComputedFields, parseFile, parsePastedExtraction, type NormalizedTransaction } from "../ingest";

export type UploadedDocument = {
  fileName: string;
  rowCount: number;
};

type Pending = {
  fileName: string;
  transactions: NormalizedTransaction[];
};

const EXTRACTION_PROMPT = `I'm sharing one document — it could be a PDF, an Excel file, a CSV, a saved webpage, or pasted text. Read it and output ONLY a table with these exact columns, one row per transaction:

Scrip/Fund Name | Purchase Date | Sell Date | Units | Buy Value | Sell Value | Buy Price | Sell Price

Rules:
- If the source has more than one table, use the one that actually contains transaction rows, not a summary or disclaimer table — tell me which one you used.
- If the file has subtotal or summary rows mixed in with transaction rows, drop the subtotal rows — I only want individual transaction lines.
- Use DD-MMM-YYYY date format.
- Do not classify long-term/short-term yourself, and do not calculate gains yourself.
- If any transaction is missing a purchase date or sell date, flag it in a separate line after the table instead of guessing.
- Output the table in a format I can copy straight into a spreadsheet (tab-separated or markdown table, your choice, just tell me which).
- End with one line summarizing what you read and how confident you are.`;

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
  const [pending, setPending] = useState<Pending | null>(null);
  const [awaitingPaste, setAwaitingPaste] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const result = await parseFile(file);
      if (result.kind === "pdf_or_freeform") {
        setAwaitingPaste(file.name);
      } else {
        setPending({ fileName: file.name, transactions: result.transactions });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that file.");
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
    try {
      const source = parsePastedExtraction(pasteText);
      setPending({ fileName: awaitingPaste, transactions: source.transactions });
      setAwaitingPaste(null);
      setPasteText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that table.");
    }
  }

  function confirmPending() {
    if (!pending || pending.transactions.length === 0) {
      return;
    }
    onCommit(pending.transactions, pending.fileName);
    setPending(null);
  }

  // Recomputes hold period/tax class/gain-loss from the edited fields, same
  // as a freshly parsed row. Invalid in-progress edits (e.g. a half-typed
  // date) are kept as typed without recalculating, rather than crashing.
  function updatePendingRow(index: number, patch: Partial<NormalizedTransaction>) {
    setPending((prev) => {
      if (!prev) {
        return prev;
      }
      const transactions = prev.transactions.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }
        const merged = { ...row, ...patch };
        try {
          return deriveComputedFields(merged);
        } catch {
          return merged;
        }
      });
      return { ...prev, transactions };
    });
  }

  function removePendingRow(index: number) {
    setPending((prev) => (prev ? { ...prev, transactions: prev.transactions.filter((_, i) => i !== index) } : prev));
  }

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
            <>
              <p className="folder-panel-copy">Want a copy of each document saved to a folder on your computer as you add it?</p>
              <button type="button" className="text-button" onClick={onChooseLocalFolder}>
                Save to a folder instead
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}

      {awaitingPaste ? (
        <div className="paste-panel">
          <p>
            <strong>{awaitingPaste}</strong> needs the AI extraction step. This app doesn't parse PDFs or free-form
            text itself.
          </p>
          <ol className="paste-steps">
            <li>Copy the prompt below.</li>
            <li>Paste it into your AI chat of choice, along with the document.</li>
            <li>Paste the table it gives you back here.</li>
          </ol>
          <details className="extraction-prompt">
            <summary>Show the extraction prompt</summary>
            <pre>{EXTRACTION_PROMPT}</pre>
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
