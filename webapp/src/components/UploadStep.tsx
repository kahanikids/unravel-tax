import { useEffect, useState } from "react";
import {
  deriveComputedFields,
  formatFixtureDate,
  parseFile,
  parseExtractionJson,
  parsePastedExtraction,
  reparseWithColumnMap,
  extractJsonBlock,
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
import { EXTRACTION_METHOD_OPTIONS, type ExtractionMethodOption } from "../lib/copy";
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

function splitDocumentTextWithLength(text: string, size: number): string[] {
  if (text.length <= size) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const hardEnd = Math.min(start + size, text.length);
    const newlineBreak = text.lastIndexOf("\n", hardEnd);
    const end = newlineBreak > start + size * 0.65 ? newlineBreak : hardEnd;
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

function mergeExtractionJsonObjects(rawResponses: string[]): string {
  const merged: any = {
    documentType: null,
    capitalGainsTransactions: [],
    annualFigures: {
      dividendIncome: null,
      interestIncome: null,
      tdsDeducted: null,
      deductibleCharges: null,
      speculativeGain: null,
      shortTermCapitalGains: null,
      longTermCapitalGains: null,
      debtOrSpecifiedMutualFundGains: null,
      totalCapitalGains: null
    },
    netRealisedCapitalGainNoDetail: null,
    confidence: "high",
    notes: ""
  };

  const notesList: string[] = [];
  const docTypes: string[] = [];
  const confidences: string[] = [];

  for (const raw of rawResponses) {
    try {
      const jsonText = extractJsonBlock(raw);
      const parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== "object") {
        continue;
      }

      if (parsed.documentType) {
        docTypes.push(parsed.documentType);
      }

      if (Array.isArray(parsed.capitalGainsTransactions)) {
        for (const tx of parsed.capitalGainsTransactions) {
          if (!tx || typeof tx !== "object") continue;
          const isDuplicate = merged.capitalGainsTransactions.some((existing: any) => {
            return (
              existing.scripName === tx.scripName &&
              existing.purchaseDate === tx.purchaseDate &&
              existing.sellDate === tx.sellDate &&
              existing.units === tx.units &&
              existing.buyValue === tx.buyValue &&
              existing.sellValue === tx.sellValue
            );
          });
          if (!isDuplicate) {
            merged.capitalGainsTransactions.push(tx);
          }
        }
      }

      if (parsed.annualFigures && typeof parsed.annualFigures === "object") {
        for (const key of Object.keys(merged.annualFigures)) {
          const val = parsed.annualFigures[key];
          if (val !== null && val !== undefined) {
            const numVal = Number(String(val).replace(/[₹,\s]/g, ""));
            if (!isNaN(numVal)) {
              const existing = merged.annualFigures[key];
              merged.annualFigures[key] = existing === null ? numVal : Math.max(existing, numVal);
            } else if (typeof val === "string" && val.trim() !== "") {
              merged.annualFigures[key] = val.trim();
            }
          }
        }
      }

      if (parsed.netRealisedCapitalGainNoDetail !== null && parsed.netRealisedCapitalGainNoDetail !== undefined) {
        const numVal = Number(String(parsed.netRealisedCapitalGainNoDetail).replace(/[₹,\s]/g, ""));
        if (!isNaN(numVal)) {
          const existing = merged.netRealisedCapitalGainNoDetail;
          merged.netRealisedCapitalGainNoDetail = existing === null ? numVal : Math.max(existing, numVal);
        }
      }

      if (parsed.confidence) {
        confidences.push(parsed.confidence.toLowerCase());
      }

      if (parsed.notes && typeof parsed.notes === "string" && parsed.notes.trim() !== "") {
        notesList.push(parsed.notes.trim());
      }
    } catch (e) {
      console.warn("Failed to parse chunk JSON text in merge:", e);
    }
  }

  if (docTypes.length > 0) {
    merged.documentType = docTypes[0];
  }
  if (confidences.includes("low")) {
    merged.confidence = "low";
  } else if (confidences.includes("medium")) {
    merged.confidence = "medium";
  } else {
    merged.confidence = "high";
  }
  if (notesList.length > 0) {
    merged.notes = Array.from(new Set(notesList)).join("; ");
  }

  return JSON.stringify(merged);
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
    extractedPages?: string[];
    diagnosticSummary?: string;
    suggestedSheetName?: string;
    thumbnailDataUrl?: string;
  } | null>(null);
  const [awaitingPdfPassword, setAwaitingPdfPassword] = useState<{
    file: File;
    message: string;
  } | null>(null);
  const [pdfPassword, setPdfPassword] = useState("");
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
      return;
    }
    const stored = getStoredExtractionMethod();
    if (stored) {
      setExtractionMethod(stored);
    } else {
      setExtractionMethod(null);
    }
  }, [awaitingPaste]);


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
  }, [awaitingPaste, extractionMethod]);

  /** Opens the right review UI for a file. Returns true when it needs the user
   * (a review modal or the paste panel), false when nothing interactive opened
   * (a hard error) so a queued batch can move on to the next file. */
  function openReview(fileName: string, result: IngestResult, thumbnailDataUrl?: string): boolean {
    if (result.pdfPasswordRequired) {
      return false;
    }

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
        extractedPages: result.promptRoute.extractedPages,
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

  async function generatePdfThumbnail(
    file: File,
    pdfPassword?: string
  ): Promise<string | undefined> {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return undefined;
    }
    try {
      const { renderPdfThumbnail } = await import("../ingest/pdfExtract");
      return await renderPdfThumbnail(await file.arrayBuffer(), 200, pdfPassword);
    } catch {
      return undefined;
    }
  }

  async function processFile(file: File, options?: { pdfPassword?: string }) {
    setParsing(true);
    let opened = false;
    try {
      const pdfPasswordAttempted = Boolean(options?.pdfPassword);
      const [result, thumbnailDataUrl] = await Promise.all([
        parseFile(file, { pdfPassword: options?.pdfPassword, pdfPasswordAttempted }),
        generatePdfThumbnail(file, options?.pdfPassword)
      ]);
      if (result.pdfPasswordRequired) {
        setAwaitingPdfPassword({
          file,
          message:
            result.warnings[0]?.message ??
            "This PDF is password-protected. Enter its password so the app can read it locally."
        });
        setPdfPassword("");
        opened = true;
        return;
      }
      setAwaitingPdfPassword(null);
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

  async function retryPasswordProtectedPdf() {
    if (!awaitingPdfPassword || !pdfPassword.trim()) {
      return;
    }
    setError(null);
    const file = awaitingPdfPassword.file;
    await processFile(file, { pdfPassword: pdfPassword.trim() });
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
        setExtractProgress,
        awaitingPaste.extractedPages
      );
      const parsed = parsePastedExtraction(rawText, awaitingPaste.extractedText);
      const opened = openExtractionResult(parsed);
      if (!opened) {
        showExtractionError(
          parsed.warnings[0]?.message ??
            "Local Llama finished, but the app could not find usable JSON in the response. Use OpenRouter or Frontier AI copy-paste instead.",
          "browser"
        );
      }
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

    try {
      let chunks: string[] = [];
      let filterMessage = "";

      if (awaitingPaste.extractedPages && awaitingPaste.extractedPages.length > 0) {
        const { filterPagesForExtraction, chunkPagesForOpenRouter } = await import("../ingest/llmExtract");
        const { filteredPages, skippedPagesCount } = filterPagesForExtraction(awaitingPaste.extractedPages);
        if (skippedPagesCount > 0) {
          filterMessage = `Filtered out ${skippedPagesCount} page(s) with no transactions. `;
        }
        chunks = chunkPagesForOpenRouter(filteredPages, 24000);
      } else {
        chunks = splitDocumentTextWithLength(awaitingPaste.extractedText, 24000);
      }

      const totalChunks = chunks.length;
      let completed = 0;

      setExtractProgress({
        phase: "generating",
        progress: 0,
        message: totalChunks > 1
          ? `${filterMessage}Splitting document into ${totalChunks} parts and processing in parallel…`
          : `${filterMessage}Sending to OpenRouter…`
      });

      const promises = chunks.map(async (chunk, index) => {
        const result = await runOpenRouterExtraction(
          chunk,
          extractionPrompt,
          totalChunks > 1 ? `${awaitingPaste.fileName} (Part ${index + 1})` : awaitingPaste.fileName,
          key,
          // Since they run in parallel, silence inner logs to prevent jumping UI text
          () => {}
        );
        completed++;
        setExtractProgress({
          phase: "generating",
          progress: Math.round((completed / totalChunks) * 100),
          message: totalChunks > 1
            ? `Extracted ${completed} of ${totalChunks} parts…`
            : "Received response from OpenRouter…"
        });
        return result;
      });

      const extractions = await Promise.all(promises);

      setExtractProgress({
        phase: "generating",
        progress: 100,
        message: "Checking and merging the extracted JSON…"
      });

      // Merge JSON from all chunks
      const mergedJsonText = mergeExtractionJsonObjects(extractions.map((e) => e.rawText));

      // Collect unique models used
      const modelsUsedSet = new Set(extractions.map((e) => e.modelUsed).filter(Boolean));
      const modelUsed = Array.from(modelsUsedSet).join(", ") || undefined;

      const parsed = parseExtractionJson(mergedJsonText, awaitingPaste.extractedText);
      const opened = openExtractionResult(parsed, {
        modelUsed
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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <h2>Add your documents</h2>
        <InfoTooltip label="About adding documents" className="align-right">
          Add any financial documents or statements—broker CG reports, mutual funds, bank interest, loan interest, dividends, insurance, property tax, etc. CSV, Excel, and HTML are read in your browser; PDFs use an LLM extraction step.
        </InfoTooltip>
      </div>
      <p className="step-lede">
        Add your statements, certificates, or reports. We'll extract and review each file before using anything.
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
          <div className="upload-format-pills" aria-hidden="true">
            {["CSV", "XLSX", "PDF", "HTML", "TXT"].map((fmt) => (
              <span key={fmt} className="upload-format-pill">{fmt}</span>
            ))}
          </div>
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

      {awaitingPdfPassword ? (
        <div className="paste-panel">
          <p>
            <strong>{awaitingPdfPassword.file.name}</strong> is password-protected.{" "}
            {awaitingPdfPassword.message}
          </p>
          <label className="column-mapper-row">
            <span>PDF password</span>
            <input
              type="password"
              value={pdfPassword}
              autoComplete="off"
              onChange={(event) => setPdfPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void retryPasswordProtectedPdf();
                }
              }}
            />
          </label>
          <div className="paste-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void retryPasswordProtectedPdf()}
              disabled={!pdfPassword.trim() || parsing}
            >
              Unlock And Read PDF
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setAwaitingPdfPassword(null);
                setPdfPassword("");
                advanceQueue();
              }}
            >
              Skip This File
            </button>
          </div>
        </div>
      ) : null}

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
          <div className="paste-stepper">
            {/* Step 1: File confirmed */}
            <div className="paste-stepper-step paste-stepper-step-done">
              <div className="paste-stepper-indicator">1</div>
              <div className="paste-stepper-content">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {awaitingPaste.thumbnailDataUrl ? (
                    <img
                      className="pdf-thumbnail"
                      src={awaitingPaste.thumbnailDataUrl}
                      alt={`Page 1 preview of ${awaitingPaste.fileName}`}
                    />
                  ) : null}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, margin: 0 }}>{awaitingPaste.fileName}</p>
                    <p style={{ color: "var(--muted)", fontSize: "0.88rem", margin: 0 }}>
                      {awaitingPaste.reason
                        ? awaitingPaste.reason
                        : "This file needs an extraction step to read the numbers."}
                    </p>
                  </div>
                </div>

                {/* Collapsed diagnostic — hidden by default */}
                {awaitingPaste.diagnosticSummary ? (
                  <details className="paste-diagnostic" style={{ marginTop: 12 }}>
                    <summary>Why can’t the app read this directly?</summary>
                    <div className="paste-diagnostic-body">{awaitingPaste.diagnosticSummary}</div>
                  </details>
                ) : null}
              </div>
            </div>

            {/* Step 2: Choose how to extract */}
            {awaitingPaste.extractedText ? (
              <div className="paste-stepper-step paste-stepper-step-current">
                <div className="paste-stepper-indicator">2</div>
                <div className="paste-stepper-content">
                  <h4 className="paste-stepper-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    Choose how to extract
                    <InfoTooltip label="Compare extraction methods" className="align-right info-tip-wide">
                      <div style={{ display: "grid", gridTemplateColumns: "70px repeat(3, 1fr)", gap: "8px 12px", padding: "4px 0" }}>
                        <div />
                        {EXTRACTION_METHOD_OPTIONS.map((opt) => (
                          <div key={opt.id} style={{ fontWeight: 800, fontSize: "0.8rem", textAlign: "center", color: "var(--accent-dark)" }}>
                            {opt.label.split(" (")[0]}
                          </div>
                        ))}
                        {[
                          { label: "Takes", key: "takes" },
                          { label: "Gives", key: "gives" },
                          { label: "Accuracy", key: "accuracy" },
                          { label: "Time", key: "time" },
                          { label: "Effort", key: "effort" },
                          { label: "Data", key: "data" }
                        ].map((attr) => (
                          <div key={attr.key} style={{ display: "contents" }}>
                            <div style={{ fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", color: "var(--muted)", alignSelf: "center" }}>
                              {attr.label === "Data" ? "Privacy" : attr.label}
                            </div>
                            {EXTRACTION_METHOD_OPTIONS.map((opt) => (
                              <div key={opt.id} style={{ fontSize: "0.78rem", textAlign: "center", padding: "6px 8px", background: "var(--surface-soft)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {opt[attr.key as keyof ExtractionMethodOption]}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </InfoTooltip>
                  </h4>
                  <div className="extraction-tabs" role="group" aria-label="Extraction method">
                    <button
                      type="button"
                      className={`extraction-tab${ extractionMethod === "browser" ? " extraction-tab-active" : ""}`}
                      onClick={() => chooseExtractionMethod("browser")}
                    >
                      <span className="extraction-tab-icon" aria-hidden="true">💻</span>
                      Llama (In-browser, free)
                    </button>
                    <button
                      type="button"
                      className={`extraction-tab${extractionMethod === "openrouter" ? " extraction-tab-active" : ""}`}
                      onClick={() => chooseExtractionMethod("openrouter")}
                    >
                      <span className="extraction-tab-icon" aria-hidden="true">🔗</span>
                      Openrouter (Free models)
                    </button>
                    <button
                      type="button"
                      className={`extraction-tab${extractionMethod === "frontier" ? " extraction-tab-active" : ""}`}
                      onClick={() => chooseExtractionMethod("frontier")}
                    >
                      <span className="extraction-tab-icon" aria-hidden="true">💬</span>
                      Frontier LLMs (copy-paste)
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Step 3: Review / paste result */}
            <div className={`paste-stepper-step${(!awaitingPaste.extractedText || extractionMethod) ? " paste-stepper-step-current" : ""}`}>
              <div className="paste-stepper-indicator">{awaitingPaste.extractedText ? "3" : "2"}</div>
              <div className="paste-stepper-content">
                <h4 className="paste-stepper-title">{awaitingPaste.extractedText ? "Review / paste result" : "Copy-Paste Extraction"}</h4>

                {awaitingPaste.extractedText ? (
                  <>
                    {/* Active method detail */}
                    {extractionMethod === "browser" ? (
                      webGpuAvailable === false ? (
                        <div className="extraction-tab-info">
                          <span className="extraction-tab-info-icon" aria-hidden="true">⚠️</span>
                          <p>
                            In-browser extraction needs WebGPU (Chrome or Edge on a device with a GPU).{" "}
                            <button type="button" className="text-button" onClick={() => chooseExtractionMethod("frontier")}>
                              Switch to copy-paste
                            </button>
                          </p>
                        </div>
                      ) : (
                        <>
                          {awaitingPaste.extractedPages && awaitingPaste.extractedPages.length > 8 ? (
                            <div className="extraction-tab-info" style={{ borderColor: "var(--flag)", background: "var(--flag-soft)", color: "var(--flag)" }}>
                              <span className="extraction-tab-info-icon" aria-hidden="true">⚠️</span>
                              <p style={{ color: "inherit", fontWeight: 500, margin: 0 }}>
                                <strong>Warning: Very long document ({awaitingPaste.extractedPages.length} pages).</strong> Running local Llama on devices with limited memory can slow down or freeze your browser. For files over 8 pages, we highly recommend using <strong>OpenRouter</strong> or <strong>Frontier LLMs (copy-paste)</strong>.
                              </p>
                            </div>
                          ) : null}
                          <div className="extraction-tab-info">
                            <span className="extraction-tab-info-icon" aria-hidden="true">🔒</span>
                            <p>
                        Runs Llama 3.2 3B locally via WebGPU — nothing leaves your device. First run
                        downloads ~2 GB.
                            </p>
                          </div>
                          <div className="paste-actions" style={{ marginTop: 14 }}>
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
                            <p className="upload-parsing-hint" style={{ marginTop: 8, textAlign: "left" }}>
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
                        <div className="extraction-tab-info">
                          <span className="extraction-tab-info-icon" aria-hidden="true">ℹ️</span>
                          <p>
                            Your API key stays in this browser. Document text is sent to OpenRouter and run
                            with selected free models.{" "}
                            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                              Get a free key
                            </a>
                            .
                          </p>
                        </div>
                        <label className="column-mapper-row" style={{ marginTop: 12 }}>
                          <span>API key</span>
                          <input
                            type="password"
                            value={openRouterApiKey}
                            autoComplete="off"
                            placeholder="sk-or-…"
                            onChange={(event) => setOpenRouterApiKey(event.target.value)}
                          />
                        </label>
                        <div className="paste-actions" style={{ marginTop: 14 }}>
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
                          <p className="upload-parsing-hint" style={{ marginTop: 8, textAlign: "left" }}>{extractProgress.message}</p>
                        ) : null}
                      </>
                    ) : null}

                    {extractionMethod === "frontier" ? (
                      <>
                        <div className="extraction-tab-info">
                          <span className="extraction-tab-info-icon" aria-hidden="true">💬</span>
                          <p>
                            Copy the prompt + document text into ChatGPT, Claude, or Gemini.
                            Paste the JSON it returns below.
                          </p>
                        </div>
                        <ol className="paste-steps" style={{ marginTop: 12 }}>
                          <li>Copy the prompt and document text (one button does both).</li>
                          <li>Paste into your AI chat. No need to attach the file again.</li>
                          <li>Paste the JSON it gives you back below.</li>
                        </ol>
                        <div className="paste-actions" style={{ marginTop: 14 }}>
                          <button type="button" className="secondary-button" onClick={copyPromptBundle}>
                            {copyStatus === "copied" ? "Copied!" : "Copy Prompt + Document Text"}
                          </button>
                        </div>
                        {textChunks.length > 1 ? (
                          <div className="extraction-splitter" style={{ marginTop: 14 }}>
                            <p className="paste-steps" style={{ paddingLeft: 0, marginTop: 0 }}>
                              This report is long. Copy these parts into the same chat in order, then paste
                              the final combined JSON back here.
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

                    {/* Prompt details — collapsed */}
                    {extractionMethod ? (
                      <details className="extraction-prompt" style={{ marginTop: 14 }}>
                        <summary>Show the extraction prompt and document text separately</summary>
                        <pre>{extractionPrompt || "Loading prompt…"}</pre>
                        <pre>{awaitingPaste.extractedText}</pre>
                      </details>
                    ) : null}

                    {/* Fallback paste textarea — always shown once a method is selected */}
                    {extractionMethod ? (
                      <div style={{ marginTop: 14 }}>
                        <textarea
                          className="paste-textarea"
                          style={{ width: "100%", boxSizing: "border-box" }}
                          value={pasteText}
                          onChange={(event) => setPasteText(event.target.value)}
                          placeholder={
                            extractionMethod === "frontier"
                              ? "Paste the JSON here (a table still works if that’s what you got back)."
                              : "Or paste JSON here if automatic extraction didn’t work."
                          }
                          rows={5}
                        />
                        <div className="paste-actions" style={{ marginTop: 14 }}>
                          <button
                            type="button"
                            className={extractionMethod === "frontier" ? "primary-button" : "secondary-button"}
                            onClick={() => handlePasteSubmit()}
                            disabled={!pasteText.trim() || extracting}
                          >
                            {extractionMethod === "frontier" ? "Read This JSON" : "Read Pasted JSON"}
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
                    ) : (
                      // No method chosen yet — show a prompt to pick one above
                      <p className="upload-parsing-hint" style={{ textAlign: "left", marginTop: 4 }}>Pick an extraction method above to continue.</p>
                    )}
                  </>
                ) : (
                  // No extracted text — full copy-paste flow
                  <>
                    <ol className="paste-steps" style={{ marginTop: 0 }}>
                      <li>Copy the prompt below.</li>
                      <li>Paste it into your AI chat of choice, along with the document.</li>
                      <li>Paste the JSON it gives you back here.</li>
                    </ol>
                    <details className="extraction-prompt" style={{ marginTop: 14 }}>
                      <summary>Show the extraction prompt</summary>
                      <pre>{extractionPrompt || "Loading prompt…"}</pre>
                    </details>
                    <div style={{ marginTop: 14 }}>
                      <textarea
                        className="paste-textarea"
                        style={{ width: "100%", boxSizing: "border-box" }}
                        value={pasteText}
                        onChange={(event) => setPasteText(event.target.value)}
                        placeholder="Paste the JSON here (a table still works if that’s what you got back)."
                        rows={5}
                      />
                      <div className="paste-actions" style={{ marginTop: 14 }}>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => handlePasteSubmit()}
                          disabled={!pasteText.trim()}
                        >
                          Read This JSON
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
                  </>
                )}
              </div>
            </div>
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
            const capitalGainsRows: [string, number][] = figures
              ? (
                  [
                    ["Speculative / intraday gain", figures.speculativeGain],
                    ["Short-term capital gains", figures.shortTermCapitalGains],
                    ["Long-term capital gains", figures.longTermCapitalGains],
                    ["Debt/specified mutual fund gains", figures.debtOrSpecifiedMutualFundGains],
                    ["Total capital gains", figures.totalCapitalGains]
                  ] as [string, number | undefined][]
                ).filter((row): row is [string, number] => typeof row[1] === "number")
              : [];
            return annualRows.length > 0 || capitalGainsRows.length > 0 ? (
              <div>
                {annualRows.length > 0 ? (
                  <>
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
                  </>
                ) : null}
                {capitalGainsRows.length > 0 ? (
                  <>
                    <p>
                      We also found these capital-gains summary totals. They are shown for review,
                      but not used in automatic calculations unless you enter/verify them:
                    </p>
                    <ul className="paste-steps">
                      {capitalGainsRows.map(([label, value]) => (
                        <li key={label}>
                          {label}: <strong>₹{value.toLocaleString("en-IN")}</strong>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
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
                          extractedPages: pending.ingest.promptRoute?.extractedPages,
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
          {documents.map((document, index) => {
            const ext = document.fileName.split(".").pop()?.toUpperCase() ?? "DOC";
            return (
              <div className="document-card" key={`${document.fileName}-${index}`}>
                <span className="document-card-icon" aria-hidden="true">{ext.slice(0, 4)}</span>
                <span className="document-card-name">{document.fileName}</span>
                <span className="document-card-count">{document.rowCount} rows</span>
                <button
                  type="button"
                  className="document-card-remove"
                  aria-label={`Remove ${document.fileName}`}
                  onClick={() => onRemove(index)}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="step-actions">
        <button
          type="button"
          className="primary-button"
          onClick={onContinue}
        >
          Continue To Your Results
        </button>
      </div>
    </div>
  );
}
