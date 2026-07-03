import { useState } from "react";
import { parseFile, parsePastedExtraction, type NormalizedTransaction, type ParsedTransactionSource } from "../ingest";

export type UploadedDocument = {
  fileName: string;
  rowCount: number;
};

type Pending = {
  fileName: string;
  source: ParsedTransactionSource;
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
  const [pending, setPending] = useState<Pending | null>(null);
  const [awaitingPaste, setAwaitingPaste] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setError(null);
    try {
      const result = await parseFile(file);
      if (result.kind === "pdf_or_freeform") {
        setAwaitingPaste(file.name);
      } else {
        setPending({ fileName: file.name, source: result });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that file.");
    }
  }

  function handlePasteSubmit() {
    if (!awaitingPaste) {
      return;
    }
    setError(null);
    try {
      const source = parsePastedExtraction(pasteText);
      setPending({ fileName: awaitingPaste, source });
      setAwaitingPaste(null);
      setPasteText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that table.");
    }
  }

  function confirmPending() {
    if (!pending) {
      return;
    }
    onCommit(pending.source.transactions, pending.fileName);
    setPending(null);
  }

  return (
    <div className="step-card">
      <h2>Add your documents</h2>
      <p className="step-lede">
        One at a time: add a document, confirm what we read, then the next. CSV, Excel, and saved webpages are read
        in your browser - PDFs and pasted text go through the guided extraction prompt.
      </p>

      <div className="upload-dropzone">
        <label className="primary-button upload-button">
          Choose a file
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.html,.htm,.tsv,.txt,.pdf"
            onChange={(event) => handleFile(event.target.files)}
            hidden
          />
        </label>
        <p className="upload-hint">Broker/AMC capital gains statements are the main thing this step is for.</p>
      </div>

      {localFolderSupported ? (
        <div className="folder-panel">
          {localFolderName ? (
            <p>
              Saving a copy of each document to <strong>{localFolderName}</strong> on your computer as you go.
            </p>
          ) : (
            <>
              <p>Want a copy of each document saved to a folder on your computer as you add it?</p>
              <button type="button" className="text-button" onClick={onChooseLocalFolder}>
                Choose a folder
              </button>
            </>
          )}
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}

      {awaitingPaste ? (
        <div className="paste-panel">
          <p>
            <strong>{awaitingPaste}</strong> needs the AI extraction step - this app doesn't parse PDFs or free-form
            text itself.
          </p>
          <ol className="paste-steps">
            <li>Copy the prompt from <code>prompts/01-extract-statement.md</code>.</li>
            <li>Paste it into your AI chat of choice, along with the document.</li>
            <li>Paste the table it gives you back here.</li>
          </ol>
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
          <div className="modal-card" role="dialog" aria-labelledby="confirm-title">
            <h3 id="confirm-title">Here's what we read from {pending.fileName}</h3>
            <p>Confirm this looks right before it's used anywhere.</p>
            <div className="preview-table-wrap">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Scrip</th>
                    <th>Purchase</th>
                    <th>Sell</th>
                    <th>Units</th>
                    <th>Gain/(Loss)</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.source.transactions.slice(0, 8).map((row, index) => (
                    <tr key={index}>
                      <td>{row.scripName}</td>
                      <td>{row.purchaseDate}</td>
                      <td>{row.sellDate}</td>
                      <td>{row.units}</td>
                      <td>{row.gainLoss}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pending.source.transactions.length > 8 ? (
                <p className="preview-more">+{pending.source.transactions.length - 8} more rows</p>
              ) : null}
            </div>
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={confirmPending}>
                Looks right - add to my filing
              </button>
              <button type="button" className="text-button" onClick={() => setPending(null)}>
                Something's off, discard
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
        <button type="button" className="primary-button" onClick={onContinue}>
          Continue to your results
        </button>
      </div>
    </div>
  );
}
