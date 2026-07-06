import { useEffect, useState } from "react";
import {
  deriveComputedFields,
  formatFixtureDate,
  parseFile,
  parseExtractionJson,
  parsePastedExtraction,
  reparseWithColumnMap,
  type ExtractionSummaryFigures,
  type IngestResult,
  type IngestWarning,
  type NormalizedTransaction
} from "../ingest";
import type { ExtractProgress } from "../ingest/llmExtract";
import { runOpenRouterExtraction } from "../ingest/openRouterExtract";
import {
  getStoredExtractionMethod,
  getStoredOpenRouterApiKey,
  setStoredExtractionMethod,
  setStoredOpenRouterApiKey,
  type ExtractionMethod
} from "../lib/extractionPrefs";
import { ExtractionMethodModal } from "./ExtractionMethodModal";
import { EXPECTED_TRANSACTION_COLUMNS } from "../ingest/types";
import type { CanonicalTransactionColumn } from "../ingest/headerMatching";
import type { RawSheet } from "../lib";
import { InfoTooltip } from "./InfoTooltip";

/** Dates from Excel/HTML arrive as Date objects; flatten to a stable string so the reference sheet and saved session hold plain primitives. */
function toRawSheet(
  headers: string[],
  records: Record<string, string | number | Date>[]
): RawSheet {
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
  extractionModelUsed?: string;
  /** Page-1 preview for a PDF upload, so the user can visually confirm this is the right document before it's used anywhere. */
  thumbnailDataUrl?: string;
};

type ExtractionError = {
  title: string;
  message: string;
  details?: string;
  source?: ExtractionMethod;
  contextWindowTooSmall: boolean;
};

const DOCUMENT_CHUNK_SIZE = 8000;

function isContextWindowError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("context window") || lower.includes("prompt tokens exceed");
}

function makeExtractionError(message: string, source?: ExtractionMethod): ExtractionError {
  if (isContextWindowError(message)) {
    return {
      title: "This document is too large for that model",
      message:
        "The selected LLM could not fit the extracted document text in its context window. Try one of the other extraction options, or split the report into smaller parts and extract each part in order.",
      details: message,
      source,
      contextWindowTooSmall: true
    };
  }

  return {
    title: "Extraction did not work",
    message,
    source,
    contextWindowTooSmall: false
  };
}

function splitDocumentText(text: string): string[] {
  if (text.length <= DOCUMENT_CHUNK_SIZE) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const hardEnd = Math.min(start + DOCUMENT_CHUNK_SIZE, text.length);
    const newlineBreak = text.lastIndexOf("\n", hardEnd);
    const end = newlineBreak > start + DOCUMENT_CHUNK_SIZE * 0.65 ? newlineBreak : hardEnd;
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

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
  onCommit: (
    transactions: NormalizedTransaction[],
    fileName: string,
    sheetNameHint?: string
  ) => void;
  onCommitReference: (fileName: string, rawSheet: RawSheet, sheetNameHint?: string) => void;
  /** Push recognised annual totals into the results-screen "A few more numbers" fields, plus a net-gain-with-no-detail flag. */
  onApplySummaryFigures?: (figures: ExtractionSummaryFigures, netGainOnly: boolean) => void;
  onRemove: (index: number) => void;
  onContinue: () => void;
  localFolderSupported: boolean;
  localFolderName: string | null;
  onChooseLocalFolder: () => void;
}) {
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [awaitingPaste, setAwaitingPaste] = useState<{
    fileName: string;
    reason?: string;
    extractedText?: string;
    diagnosticSummary?: string;
    suggestedSheetName?: string;
    thumbnailDataUrl?: string;
  } | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");
  // A paste that yielded only annual totals / a net-gain-only marker (no usable
  // transaction rows) lands here instead of dead-ending as a generic error.
  const [summaryGuidance, setSummaryGuidance] = useState<{
    fileName: string;
    figures?: ExtractionSummaryFigures;
    netGainOnly: boolean;
    documentType?: string;
    notes?: string;
    extractionModelUsed?: string;
  } | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [extractionPrompt, setExtractionPrompt] = useState("");
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod | null>(() =>
    getStoredExtractionMethod()
  );
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [openRouterApiKey, setOpenRouterApiKey] = useState(() => getStoredOpenRouterApiKey());
  const [webGpuAvailable, setWebGpuAvailable] = useState<boolean | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState<ExtractProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractionError, setExtractionError] = useState<ExtractionError | null>(null);
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
      .catch(() =>
        setExtractionPrompt(
          "Could not load extraction prompt. See prompts/01-extract-statement.md in the repo."
        )
      );
  }, [awaitingPaste, extractionPrompt]);

  useEffect(() => {
    setCopyStatus("idle");
    setExtractProgress(null);
    setExtracting(false);
    setExtractionError(null);
  }, [awaitingPaste?.fileName]);

  useEffect(() => {
    if (!awaitingPaste) {
      setShowMethodPicker(false);
      return;
    }
    const stored = getStoredExtractionMethod();
    if (stored) {
      setExtractionMethod(stored);
      setShowMethodPicker(false);
    } else {
      setExtractionMethod(null);
      setShowMethodPicker(true);
    }
  }, [awaitingPaste?.fileName]);

  useEffect(() => {
    if (!awaitingPaste || extractionMethod !== "browser") {
      setWebGpuAvailable(null);
      return;
    }
    let cancelled = false;
    void import("../ingest/llmExtract").then(({ isWebGpuAvailable }) =>
      isWebGpuAvailable().then((available) => {
        if (!cancelled) {
          setWebGpuAvailable(available);
        }
      })
    );
    return () => {
      cancelled = true;
    };
  }, [awaitingPaste?.fileName, extractionMethod]);

  /** Opens the right review UI for a file. Returns true when it needs the user
   * (a review modal or the paste panel), false when nothing interactive opened
   * (a hard error) so a queued batch can move on to the next file. */
  function openReview(fileName: string, result: IngestResult, thumbnailDataUrl?: string): boolean {
    const missingCols = EXPECTED_TRANSACTION_COLUMNS.filter(
      (col) => !Object.values(result.headerMap).includes(col)
    );

    if (result.transactions.length > 0) {
      setPending({
        fileName,
        ingest: result,
        transactions: result.transactions,
        warnings: result.warnings,
        columnAssignments: {},
        thumbnailDataUrl
      });
      return true;
    }

    if (result.sourceHeaders.length > 0 && missingCols.length > 0) {
      setPending({
        fileName,
        ingest: result,
        transactions: [],
        warnings: result.warnings,
        columnAssignments: {},
        thumbnailDataUrl
      });
      return true;
    }

    if (result.promptRoute) {
      setAwaitingPaste({
        fileName,
        reason: result.promptRoute.reason,
        extractedText: result.promptRoute.extractedText,
        diagnosticSummary: result.promptRoute.diagnosticSummary,
        suggestedSheetName: result.promptRoute.suggestedSheetName,
        thumbnailDataUrl
      });
      return true;
    }

    setError(
      `Could not read any rows from ${fileName}. ${result.warnings[0]?.message ?? ""}`.trim()
    );
    return false;
  }

  async function generatePdfThumbnail(file: File): Promise<string | undefined> {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return undefined;
    }
    try {
      const { renderPdfThumbnail } = await import("../ingest/pdfExtract");
      return await renderPdfThumbnail(await file.arrayBuffer());
    } catch {
      return undefined;
    }
  }

  async function processFile(file: File) {
    setParsing(true);
    let opened = false;
    try {
      const [result, thumbnailDataUrl] = await Promise.all([
        parseFile(file),
        generatePdfThumbnail(file)
      ]);
      opened = openReview(file.name, result, thumbnailDataUrl);
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

  function openExtractionResult(
    result: IngestResult,
    extractionMeta?: { modelUsed?: string }
  ): boolean {
    if (!awaitingPaste) {
      return false;
    }
    if (result.transactions.length > 0) {
      setPending({
        fileName: awaitingPaste.fileName,
        ingest: { ...result, suggestedSheetName: awaitingPaste.suggestedSheetName },
        transactions: result.transactions,
        warnings: result.warnings,
        columnAssignments: {},
        extractionModelUsed: extractionMeta?.modelUsed,
        thumbnailDataUrl: awaitingPaste.thumbnailDataUrl
      });
      setAwaitingPaste(null);
      setPasteText("");
      return true;
    }
    if (result.summaryFigures || result.netGainOnly || result.documentType || result.notes) {
      setSummaryGuidance({
        fileName: awaitingPaste.fileName,
        figures: result.summaryFigures,
        netGainOnly: Boolean(result.netGainOnly),
        documentType: result.documentType,
        notes: result.notes,
        extractionModelUsed: extractionMeta?.modelUsed
      });
      if (result.summaryFigures || result.netGainOnly) {
        onApplySummaryFigures?.(result.summaryFigures ?? {}, Boolean(result.netGainOnly));
      }
      setAwaitingPaste(null);
      setPasteText("");
      return true;
    }
    setError(
      result.warnings[0]?.message ??
        "Could not read that. Paste the whole JSON block the AI gave you."
    );
    return false;
  }

  function handlePasteSubmit() {
    if (!awaitingPaste) {
      return;
    }
    setError(null);
    openExtractionResult(parsePastedExtraction(pasteText, awaitingPaste.extractedText));
  }

  function chooseExtractionMethod(method: ExtractionMethod) {
    setStoredExtractionMethod(method);
    setExtractionMethod(method);
    setShowMethodPicker(false);
    setError(null);
    setExtractionError(null);
  }

  function showExtractionError(message: string, source?: ExtractionMethod) {
    setError(message);
    setExtractionError(makeExtractionError(message, source));
  }

  async function handleExtractHere() {
    if (!awaitingPaste?.extractedText || !extractionPrompt) {
      return;
    }
    setError(null);
    setExtracting(true);
    setExtractProgress(null);
    try {
      const { runInBrowserExtraction } = await import("../ingest/llmExtract");
      const rawText = await runInBrowserExtraction(
        awaitingPaste.extractedText,
        extractionPrompt,
        awaitingPaste.fileName,
        setExtractProgress
      );
      openExtractionResult(parsePastedExtraction(rawText, awaitingPaste.extractedText));
    } catch (extractError) {
      showExtractionError(
        extractError instanceof Error
          ? extractError.message
          : "In-browser extraction didn't work on this device. Use the copy-paste option below instead.",
        "browser"
      );
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  }

  async function handleOpenRouterExtract() {
    if (!awaitingPaste?.extractedText || !extractionPrompt) {
      return;
    }
    const key = openRouterApiKey.trim();
    if (!key) {
      setError("Enter your OpenRouter API key first (get one free at openrouter.ai/keys).");
      return;
    }
    setStoredOpenRouterApiKey(key);
    setError(null);
    setExtracting(true);
    setExtractProgress({ phase: "generating", progress: 0, message: "Sending to OpenRouter…" });
    try {
      const extraction = await runOpenRouterExtraction(
        awaitingPaste.extractedText,
        extractionPrompt,
        awaitingPaste.fileName,
        key,
        (message) => setExtractProgress({ phase: "generating", progress: 0, message })
      );
      setExtractProgress({
        phase: "generating",
        progress: 0,
        message: "Checking the extracted JSON…"
      });
      const parsed = parseExtractionJson(extraction.rawText, awaitingPaste.extractedText);
      const opened = openExtractionResult(parsed, {
        modelUsed: extraction.modelUsed
      });
      if (!opened) {
        showExtractionError(
          parsed.warnings[0]?.message ??
            "OpenRouter responded, but the app could not find usable JSON in the response. Try again or use Frontier AI copy-paste.",
          "openrouter"
        );
      }
    } catch (extractError) {
      showExtractionError(
        extractError instanceof Error
          ? extractError.message
          : "OpenRouter extraction didn't work. Try another method or paste the JSON manually.",
        "openrouter"
      );
    } finally {
      setExtracting(false);
      setExtractProgress(null);
    }
  }

  function copyPromptBundle() {
    if (!awaitingPaste?.extractedText) {
      return;
    }
    const bundle = `${extractionPrompt}\n\n== DOCUMENT TEXT (read from ${awaitingPaste.fileName} by this app) ==\n\n${awaitingPaste.extractedText}`;
    navigator.clipboard
      .writeText(bundle)
      .then(() => setCopyStatus("copied"))
      .catch(() =>
        setError(
          'Could not copy to clipboard. Use "Show the extraction prompt" below and copy manually.'
        )
      );
  }

  function copyPromptChunk(chunkIndex: number) {
    if (!awaitingPaste?.extractedText) {
      return;
    }
    const chunks = splitDocumentText(awaitingPaste.extractedText);
    const partNumber = chunkIndex + 1;
    const instructions =
      chunks.length === 1
        ? `== DOCUMENT TEXT (read from ${awaitingPaste.fileName} by this app) ==`
        : [
            `== DOCUMENT TEXT PART ${partNumber} OF ${chunks.length} (read from ${awaitingPaste.fileName} by this app) ==`,
            "The document is split because one model could not fit it all at once.",
            "If this is not the final part, read and remember this part but do not output JSON yet.",
            "After the final part, return one combined JSON object using the extraction prompt."
          ].join("\n");
    const bundle = `${extractionPrompt}\n\n${instructions}\n\n${chunks[chunkIndex]}`;
    navigator.clipboard
      .writeText(bundle)
      .then(() => setCopyStatus("copied"))
      .catch(() =>
        setError(
          'Could not copy to clipboard. Use "Show the extraction prompt" below and copy manually.'
        )
      );
  }

  function switchExtractionMethod(method: ExtractionMethod) {
    chooseExtractionMethod(method);
    setExtractionError(null);
  }

  const textChunks = awaitingPaste?.extractedText
    ? splitDocumentText(awaitingPaste.extractedText)
    : [];

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
      setError(
        result.warnings.find((w) => w.code === "missing_column")?.message ??
          "Still missing required columns."
      );
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
    onCommit(pending.transactions, pending.fileName, pending.ingest.suggestedSheetName);
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
    onCommitReference(
      pending.fileName,
      toRawSheet(pending.ingest.sourceHeaders, pending.ingest.sourceRecords),
      pending.ingest.suggestedSheetName
    );
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
    setPending((prev) =>
      prev ? { ...prev, transactions: prev.transactions.filter((_, i) => i !== index) } : prev
    );
  }

  const missingColumns = pending
    ? EXPECTED_TRANSACTION_COLUMNS.filter(
        (col) => !Object.values(pending.ingest.headerMap).includes(col)
      )
    : [];

  return (
    <div className="step-card">
      <h2>Add your documents</h2>
      <p className="step-lede">
        <span className="upload-lede-desktop">
          Add all your statements at once, or a few at a time. We'll walk through them one by one
          and show what we read before using anything. CSV, Excel, and saved webpages are read in
          your browser. PDFs can be extracted here (in-browser AI, OpenRouter, or copy-paste
          fallback).
        </span>
        <span className="upload-lede-mobile">
          Add your statements. Pick several at once if you like. We'll show what we read before
          using each.
        </span>
      </p>

      {parsing ? (
        <p className="upload-parsing-hint">
          Reading file{queue.length > 0 ? ` (${queue.length} more queued)` : ""}...
        </p>
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
          <InfoTooltip label="About adding documents" className="upload-info-tip align-right">
            Drop files here, or click to choose. You can pick several at once. Broker/AMC capital
            gains statements are the main thing this step is for; bank interest, dividend, and MF
            statements can be added too.
          </InfoTooltip>
          <label className="primary-button upload-button">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Choose Files
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
              Saving a copy of each document to <strong>{localFolderName}</strong> on your computer
              as you go.
            </p>
          ) : (
            <button type="button" className="text-button" onClick={onChooseLocalFolder}>
              Save To A Local Folder
            </button>
          )}
        </div>
      ) : null}

      {error ? <p className="inline-error">{error}</p> : null}

      {extracting && extractProgress ? (
        <div className="modal-backdrop">
          <div
            className="modal-card extraction-progress-modal"
            role="dialog"
            aria-live="polite"
            aria-labelledby="extraction-progress-title"
          >
            <h3 id="extraction-progress-title">
              {extractionMethod === "browser" ? "Extracting With Local Llama" : "Extracting Report"}
            </h3>
            <p>{extractProgress.message}</p>
            <div
              className="extraction-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(Math.max(extractProgress.progress, 0), 1) * 100)}
            >
              <span
                style={{
                  width: `${Math.round(Math.min(Math.max(extractProgress.progress, 0), 1) * 100)}%`
                }}
              />
            </div>
            <p className="extraction-progress-detail">
              {extractProgress.phase === "loading"
                ? "Loading the model on your device. This can take a few minutes the first time."
                : extractionMethod === "browser"
                  ? "Large reports are split into smaller pieces, extracted one by one, then combined before review."
                  : "Keep this tab open while extraction finishes."}
            </p>
          </div>
        </div>
      ) : null}

      {awaitingPaste ? (
        <div className="paste-panel">
          {awaitingPaste.thumbnailDataUrl ? (
            <img
              className="pdf-thumbnail"
              src={awaitingPaste.thumbnailDataUrl}
              alt={`Page 1 preview of ${awaitingPaste.fileName}`}
            />
          ) : null}
          <p>
            <strong>{awaitingPaste.fileName}</strong> needs the extraction step.
            {awaitingPaste.reason
              ? ` ${awaitingPaste.reason}`
              : " This app couldn't read it on its own."}
          </p>
          {awaitingPaste.diagnosticSummary ? (
            <p className="ingest-warnings">{awaitingPaste.diagnosticSummary}</p>
          ) : null}
          {awaitingPaste.extractedText ? (
            <>
              {extractionMethod ? (
                <>
                  <p className="extraction-choice-heading">
                    Extracting with:{" "}
                    {extractionMethod === "frontier"
                      ? "Frontier AI (copy-paste)"
                      : extractionMethod === "browser"
                        ? "Open-Source Llama 3.2 3B"
                        : "OpenRouter Free Selected Models"}
                    {" | "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setShowMethodPicker(true)}
                    >
                      Change extraction method
                    </button>
                  </p>

                  {extractionMethod === "browser" ? (
                    webGpuAvailable === false ? (
                      <p className="paste-steps">
                        In-browser extraction needs WebGPU (Chrome or Edge on a device with a GPU).{" "}
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setShowMethodPicker(true)}
                        >
                          Pick another method
                        </button>
                      </p>
                    ) : (
                      <>
                        <p className="paste-steps">
                          Uses Llama 3.2 3B on your device (WebGPU). First run downloads about 2 GB.
                          Nothing is sent to a server.
                        </p>
                        <div className="paste-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => void handleExtractHere()}
                            disabled={extracting || !extractionPrompt || webGpuAvailable === null}
                          >
                            {extracting ? "Extracting…" : "Extract Here In Your Browser"}
                          </button>
                        </div>
                        {extracting && extractProgress ? (
                          <p className="upload-parsing-hint">
                            {extractProgress.phase === "loading"
                              ? `Loading model (${Math.round(extractProgress.progress * 100)}%)… ${extractProgress.message}`
                              : extractProgress.message}
                          </p>
                        ) : null}
                      </>
                    )
                  ) : null}

                  {extractionMethod === "openrouter" ? (
                    <>
                      <p className="paste-steps">
                        Your OpenRouter API key stays in this browser only. Document text is sent
                        directly to OpenRouter and run with selected free models. Get a key at{" "}
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          openrouter.ai/keys
                        </a>
                        .
                      </p>
                      <label className="column-mapper-row">
                        <span>OpenRouter API key</span>
                        <input
                          type="password"
                          value={openRouterApiKey}
                          autoComplete="off"
                          placeholder="sk-or-…"
                          onChange={(event) => setOpenRouterApiKey(event.target.value)}
                        />
                      </label>
                      <div className="paste-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void handleOpenRouterExtract()}
                          disabled={extracting || !extractionPrompt || !openRouterApiKey.trim()}
                        >
                          {extracting ? "Extracting…" : "Extract With OpenRouter"}
                        </button>
                      </div>
                      {extracting && extractProgress ? (
                        <p className="upload-parsing-hint">{extractProgress.message}</p>
                      ) : null}
                    </>
                  ) : null}

                  {extractionMethod === "frontier" ? (
                    <>
                      <p className="paste-steps">
                        Copy the prompt and document text into ChatGPT, Claude, Gemini, or any AI
                        you trust. Paste the JSON it returns below.
                      </p>
                      <ol className="paste-steps">
                        <li>Copy the prompt and document text (one button does both).</li>
                        <li>Paste into your AI chat. No need to attach the file again.</li>
                        <li>Paste the JSON it gives you back here.</li>
                      </ol>
                      <div className="paste-actions">
                        <button type="button" className="primary-button" onClick={copyPromptBundle}>
                          {copyStatus === "copied" ? "Copied!" : "Copy Prompt + Document Text"}
                        </button>
                      </div>
                      {textChunks.length > 1 ? (
                        <div className="extraction-splitter">
                          <p>
                            This report is long. If your AI says its context window is too small,
                            copy these parts into the same chat in order, then paste the final
                            combined JSON back here.
                          </p>
                          <div className="extraction-chunk-actions">
                            {textChunks.map((_, index) => (
                              <button
                                type="button"
                                className="secondary-button"
                                key={index}
                                onClick={() => copyPromptChunk(index)}
                              >
                                Copy Part {index + 1} Of {textChunks.length}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  <details className="extraction-prompt">
                    <summary>Show the extraction prompt and document text separately</summary>
                    <pre>{extractionPrompt || "Loading prompt…"}</pre>
                    <pre>{awaitingPaste.extractedText}</pre>
                  </details>
                </>
              ) : null}
            </>
          ) : (
            <>
              <ol className="paste-steps">
                <li>Copy the prompt below.</li>
                <li>Paste it into your AI chat of choice, along with the document.</li>
                <li>Paste the JSON it gives you back here.</li>
              </ol>
              <details className="extraction-prompt">
                <summary>Show the extraction prompt</summary>
                <pre>{extractionPrompt || "Loading prompt…"}</pre>
              </details>
            </>
          )}
          <textarea
            className="paste-textarea"
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={
              extractionMethod === "frontier" || !awaitingPaste.extractedText
                ? "Paste the JSON here (a table still works if that's what you got back)."
                : "Or paste JSON here if automatic extraction didn't work."
            }
            rows={6}
          />
          <div className="paste-actions">
            <button
              type="button"
              className={
                extractionMethod === "frontier" || !awaitingPaste.extractedText
                  ? "primary-button"
                  : "text-button"
              }
              onClick={() => handlePasteSubmit()}
              disabled={!pasteText.trim() || extracting}
            >
              {extractionMethod === "frontier" || !awaitingPaste.extractedText
                ? "Read This"
                : "Read Pasted JSON"}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAwaitingPaste(null);
                setCopyStatus("idle");
                setExtractProgress(null);
                setExtracting(false);
                advanceQueue();
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {extractionError ? (
        <div className="modal-backdrop">
          <div className="modal-card" role="alertdialog" aria-labelledby="extraction-error-title">
            <h3 id="extraction-error-title">{extractionError.title}</h3>
            <p>{extractionError.message}</p>
            {extractionError.contextWindowTooSmall ? (
              <ul className="extraction-error-options">
                {extractionError.source !== "openrouter" ? (
                  <li>Try OpenRouter, which may route to a model with a larger context window.</li>
                ) : null}
                {extractionError.source !== "frontier" ? (
                  <li>Use the copy-paste option with ChatGPT, Claude, Gemini, or another AI.</li>
                ) : null}
                <li>
                  For very large reports, split the report or use the part-copy buttons shown in the
                  copy-paste option.
                </li>
              </ul>
            ) : null}
            {extractionError.details ? (
              <details className="extraction-error-details">
                <summary>Technical detail</summary>
                <p>{extractionError.details}</p>
              </details>
            ) : null}
            <div className="modal-actions">
              {extractionError.source !== "openrouter" ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => switchExtractionMethod("openrouter")}
                >
                  Try OpenRouter
                </button>
              ) : null}
              {extractionError.source !== "frontier" ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => switchExtractionMethod("frontier")}
                >
                  Use Copy-Paste
                </button>
              ) : null}
              {extractionError.source !== "browser" ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => switchExtractionMethod("browser")}
                >
                  Try In-Browser
                </button>
              ) : null}
              <button
                type="button"
                className="text-button"
                onClick={() => setExtractionError(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showMethodPicker ? <ExtractionMethodModal onChoose={chooseExtractionMethod} /> : null}

      {summaryGuidance ? (
        <div className="paste-panel">
          <p>
            <strong>{summaryGuidance.fileName}</strong>
            {summaryGuidance.documentType
              ? ` looks like a ${summaryGuidance.documentType}`
              : " looks like a summary statement"}
            . It has no per-transaction buy/sell rows, so there's nothing to tax-calculate from it
            directly.
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
                  <strong>"A few more numbers"</strong> on the Current Filing page. Open that
                  section and check them:
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
              This statement only gives a <strong>net realised capital gain</strong>, with no
              per-transaction buy/sell dates. This tool can't split short-term vs long-term from a
              net figure, so it is <strong>not being used in any calculation</strong>. Get the
              detailed per-transaction capital-gains statement from your broker/AMC/PMS (or enter
              the short-term/long-term split yourself), then add that here.
            </p>
          ) : null}
          {summaryGuidance.notes ? (
            <p className="paste-steps">What the AI noted: {summaryGuidance.notes}</p>
          ) : null}
          {summaryGuidance.extractionModelUsed ? (
            <p className="paste-steps">
              OpenRouter reported model used: {summaryGuidance.extractionModelUsed}.
            </p>
          ) : null}
          <div className="paste-actions">
            <button type="button" className="primary-button" onClick={dismissSummaryGuidance}>
              {summaryGuidance.figures ? "See These On Your Results" : "Got It, Continue"}
            </button>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="modal-backdrop">
          <div className="modal-card modal-card-wide" role="dialog" aria-labelledby="confirm-title">
            <h3 id="confirm-title">Here's what we read from {pending.fileName}</h3>
            <p>Fix anything that's wrong, or remove a row entirely, before it's used anywhere.</p>

            {pending.thumbnailDataUrl ? (
              <img
                className="pdf-thumbnail"
                src={pending.thumbnailDataUrl}
                alt={`Page 1 preview of ${pending.fileName}`}
              />
            ) : null}

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

            {pending.extractionModelUsed ? (
              <p className="paste-steps">
                OpenRouter reported model used: <strong>{pending.extractionModelUsed}</strong>.
              </p>
            ) : null}

            {missingColumns.length > 0 && pending.ingest.sourceHeaders.length > 0 ? (
              <div className="column-mapper">
                <p>
                  <strong>Map columns:</strong> we couldn't match every required column
                  automatically. Pick the right source column for each, then click Apply Mapping.
                </p>
                {pending.ingest.promptRoute ? (
                  <p className="column-mapper-alt">
                    Or{" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        setAwaitingPaste({
                          fileName: pending.fileName,
                          reason: pending.ingest.promptRoute?.reason,
                          extractedText: pending.ingest.promptRoute?.extractedText,
                          diagnosticSummary: pending.ingest.promptRoute?.diagnosticSummary,
                          suggestedSheetName:
                            pending.ingest.promptRoute?.suggestedSheetName ??
                            pending.ingest.suggestedSheetName,
                          thumbnailDataUrl: pending.thumbnailDataUrl
                        });
                        setPending(null);
                      }}
                    >
                      Use The AI Extraction Prompt
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
                      <option value="">Pick a column</option>
                      {pending.ingest.sourceHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <button type="button" className="text-button" onClick={applyColumnMap}>
                  Apply Mapping
                </button>
              </div>
            ) : null}

            {pending.transactions.length === 0 ? (
              <p className="checklist-empty">
                Every row has been removed. Discard, or go back and re-add the document.
              </p>
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
                            onChange={(event) =>
                              updatePendingRow(index, { scripName: event.target.value })
                            }
                          />
                        </td>
                        <td data-label="Purchase">
                          <input
                            type="text"
                            value={row.purchaseDate}
                            aria-label="Purchase date"
                            placeholder="DD-MMM-YYYY"
                            onChange={(event) =>
                              updatePendingRow(index, { purchaseDate: event.target.value })
                            }
                          />
                        </td>
                        <td data-label="Sell">
                          <input
                            type="text"
                            value={row.sellDate}
                            aria-label="Sell date"
                            placeholder="DD-MMM-YYYY"
                            onChange={(event) =>
                              updatePendingRow(index, { sellDate: event.target.value })
                            }
                          />
                        </td>
                        <td className="col-units" data-label="Units">
                          <input
                            type="number"
                            value={row.units}
                            aria-label="Units"
                            onChange={(event) =>
                              updatePendingRow(index, { units: Number(event.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="col-buy" data-label="Buy value">
                          <input
                            type="number"
                            value={row.buyValue}
                            aria-label="Buy value"
                            onChange={(event) =>
                              updatePendingRow(index, { buyValue: Number(event.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="col-sell" data-label="Sell value">
                          <input
                            type="number"
                            value={row.sellValue}
                            aria-label="Sell value"
                            onChange={(event) =>
                              updatePendingRow(index, {
                                sellValue: Number(event.target.value) || 0
                              })
                            }
                          />
                        </td>
                        <td className="col-price" data-label="Buy price">
                          <input
                            type="number"
                            value={row.buyPrice}
                            aria-label="Buy price"
                            onChange={(event) =>
                              updatePendingRow(index, { buyPrice: Number(event.target.value) || 0 })
                            }
                          />
                        </td>
                        <td className="col-price" data-label="Sell price">
                          <input
                            type="number"
                            value={row.sellPrice}
                            aria-label="Sell price"
                            onChange={(event) =>
                              updatePendingRow(index, {
                                sellPrice: Number(event.target.value) || 0
                              })
                            }
                          />
                        </td>
                        <td data-label="Gain">{row.gainLoss}</td>
                        <td data-label="Class">{row.taxClass}</td>
                        <td data-label="Action">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => removePendingRow(index)}
                          >
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
                Not a capital-gains statement (e.g. bank interest, dividends, or an MF holdings
                list)?{" "}
                <button type="button" className="text-button" onClick={addAsReference}>
                  Keep It As A Reference Sheet
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
                Looks Right, Add To My Filing
              </button>
              <button type="button" className="text-button" onClick={discardPending}>
                Discard This Document
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
        <button
          type="button"
          className="primary-button"
          onClick={onContinue}
          disabled={documents.length === 0}
        >
          Continue To Your Results
        </button>
      </div>
      {documents.length === 0 ? (
        <p className="upload-empty-hint">
          Add a document to continue. Or, if you didn't sell any shares or mutual funds this year,{" "}
          <button type="button" className="text-button" onClick={onContinue}>
            Skip This Step
          </button>{" "}
          and type your dividend/interest figures in on the results screen.
        </p>
      ) : null}
    </div>
  );
}
