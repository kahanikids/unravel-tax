import { extractJsonBlock } from "./extractionPostProcess";

export type ExtractProgress = {
  phase: "loading" | "generating";
  progress: number;
  message: string;
};

type ChunkExtractionObject = {
  documentType?: unknown;
  capitalGainsTransactions?: unknown;
  annualFigures?: unknown;
  netRealisedCapitalGainNoDetail?: unknown;
  confidence?: unknown;
  notes?: unknown;
};

let worker: Worker | null = null;

const LLAMA_CHUNK_TARGET_CHARS = 4_500;
const LLAMA_CHUNK_OVERLAP_LINES = 3;
const LLAMA_GENERATION_TIMEOUT_MS = 180_000;
const LLAMA_STALLED_PROGRESS_MS = 60_000;

/** True when WebGPU is available - required for in-browser Llama extraction. */
export async function isWebGpuAvailable(): Promise<boolean> {
  if (!("gpu" in navigator)) {
    return false;
  }
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } })
    .gpu;
  if (!gpu) {
    return false;
  }
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./llmExtract.worker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

const TRANSACTION_KEYWORDS = [
  "purchase", "sell", "buy", "sale", "quantity", "isin", "gain", "loss", "folio", "units",
  "dividend", "interest", "speculative", "intraday", "stcg", "ltcg", "charges", "fees",
  "realised", "realized", "scrip", "mutual", "share"
];

export function filterPagesForExtraction(pages: string[]): { filteredPages: string[]; skippedPagesCount: number } {
  const filteredPages: string[] = [];
  let skippedPagesCount = 0;

  for (const page of pages) {
    const lower = page.toLowerCase();
    const hasKeyword = TRANSACTION_KEYWORDS.some((kw) => lower.includes(kw));
    // Always keep page 1 or page with summary totals, or if page has any keyword
    if (hasKeyword || filteredPages.length === 0 || lower.includes("summary") || lower.includes("annual")) {
      filteredPages.push(page);
    } else {
      skippedPagesCount++;
    }
  }

  return { filteredPages, skippedPagesCount };
}

export function chunkPagesForLlama(
  pages: string[],
  targetChars = 4500
): { text: string }[] {
  const chunks: { text: string }[] = [];
  let currentPages: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const pageNumber = i + 1;

    if (currentLength + pageText.length > targetChars && currentPages.length > 0) {
      chunks.push({
        text: currentPages.join("\n\n")
      });
      currentPages = [];
      currentLength = 0;
    }

    currentPages.push(`--- PAGE ${pageNumber} ---\n${pageText}`);
    currentLength += pageText.length;
  }

  if (currentPages.length > 0) {
    chunks.push({
      text: currentPages.join("\n\n")
    });
  }

  return chunks;
}

export function chunkPagesForOpenRouter(
  pages: string[],
  targetChars = 24000
): string[] {
  const chunks: string[] = [];
  let currentPages: string[] = [];
  let currentLength = 0;

  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i];
    const pageNumber = i + 1;

    if (currentLength + pageText.length > targetChars && currentPages.length > 0) {
      chunks.push(currentPages.join("\n\n"));
      currentPages = [];
      currentLength = 0;
    }

    currentPages.push(`--- PAGE ${pageNumber} ---\n${pageText}`);
    currentLength += pageText.length;
  }

  if (currentPages.length > 0) {
    chunks.push(currentPages.join("\n\n"));
  }

  return chunks;
}

/**
 * Runs Llama 3.2 3B extraction in a Web Worker so the UI stays responsive.
 * Weights download on first use (~2 GB). Long reports are split into sequential
 * chunks so they fit the small local context window, then merged into one JSON
 * object before the review step sees the result.
 */
export async function runInBrowserExtraction(
  documentText: string,
  extractionPrompt: string,
  fileName: string,
  onProgress: (progress: ExtractProgress) => void,
  extractedPages?: string[]
): Promise<string> {
  let chunks: { text: string }[] = [];
  let filterMessage = "";

  if (extractedPages && extractedPages.length > 0) {
    const { filteredPages, skippedPagesCount } = filterPagesForExtraction(extractedPages);
    if (skippedPagesCount > 0) {
      filterMessage = `Filtered out ${skippedPagesCount} page(s) with no transaction data. `;
    }
    chunks = chunkPagesForLlama(filteredPages, LLAMA_CHUNK_TARGET_CHARS);
  } else {
    chunks = splitForLlamaContext(documentText);
  }

  if (chunks.length === 1) {
    if (filterMessage) {
      onProgress({
        phase: "generating",
        progress: 0,
        message: `${filterMessage}Processing 1 optimized chunk…`
      });
    }
    return runWorkerExtraction(chunks[0].text, extractionPrompt, fileName, onProgress);
  }

  const chunkOutputs: ChunkExtractionObject[] = [];
  onProgress({
    phase: "generating",
    progress: 0,
    message: `${filterMessage}Splitting report into ${chunks.length} chunks for local Llama…`
  });

  for (const [index, chunk] of chunks.entries()) {
    const chunkNumber = index + 1;
    const startedAt = performance.now();
    onProgress({
      phase: "generating",
      progress: index / chunks.length,
      message: `Processing chunk ${chunkNumber} of ${chunks.length}…`
    });

    try {
      const rawText = await runWorkerExtraction(
        makeChunkDocumentText(chunk.text, fileName, chunkNumber, chunks.length),
        makeChunkPrompt(extractionPrompt, chunkNumber, chunks.length),
        fileName,
        (progress) => {
          if (progress.phase === "loading") {
            onProgress(progress);
            return;
          }
          onProgress({
            phase: "generating",
            progress: (index + Math.min(Math.max(progress.progress, 0), 0.9)) / chunks.length,
            message: progress.message || `Processing chunk ${chunkNumber} of ${chunks.length}…`
          });
        }
      );
      chunkOutputs.push(parseChunkJson(rawText, chunkNumber));
      onProgress({
        phase: "generating",
        progress: chunkNumber / chunks.length,
        message: `Chunk ${chunkNumber} of ${chunks.length} processed (${Math.round(
          (performance.now() - startedAt) / 1000
        )}s).`
      });
    } catch (error) {
      console.error("[Llama extraction] Chunk failed", {
        chunk: chunkNumber,
        chunks: chunks.length,
        error
      });
      throw new Error(
        `Local Llama failed on chunk ${chunkNumber} of ${chunks.length}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  onProgress({
    phase: "generating",
    progress: 1,
    message: "Combining chunk results into one report…"
  });
  return JSON.stringify(mergeChunkExtractions(chunkOutputs));
}

function runWorkerExtraction(
  documentText: string,
  extractionPrompt: string,
  fileName: string,
  onProgress: (progress: ExtractProgress) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const activeWorker = getWorker();
    let settled = false;

    const cleanup = () => {
      activeWorker.removeEventListener("message", handleMessage);
      activeWorker.removeEventListener("error", handleWorkerError);
      activeWorker.removeEventListener("messageerror", handleWorkerMessageError);
      window.clearTimeout(stalledProgressId);
      window.clearTimeout(timeoutId);
    };

    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      activeWorker.terminate();
      if (worker === activeWorker) {
        worker = null;
      }
      reject(error);
    };

    const finish = (rawText: string) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(rawText);
    };

    const handleMessage = (event: MessageEvent) => {
      const message = event.data as
        | { type: "progress"; phase: ExtractProgress["phase"]; progress: number; message: string }
        | { type: "done"; rawText: string }
        | { type: "error"; message: string };

      if (message.type === "progress") {
        onProgress({
          phase: message.phase,
          progress: message.progress,
          message: message.message
        });
        return;
      }

      if (message.type === "error") {
        fail(new Error(message.message));
        return;
      }

      finish(message.rawText);
    };

    const handleWorkerError = (event: ErrorEvent) => {
      fail(new Error(event.message || "Local Llama worker crashed."));
    };

    const handleWorkerMessageError = () => {
      fail(new Error("Local Llama worker returned a message the app could not read."));
    };

    activeWorker.addEventListener("message", handleMessage);
    activeWorker.addEventListener("error", handleWorkerError);
    activeWorker.addEventListener("messageerror", handleWorkerMessageError);

    const stalledProgressId = window.setTimeout(() => {
      if (!settled) {
        onProgress({
          phase: "generating",
          progress: 0,
          message:
            "Local Llama is still working. If this stays here, use OpenRouter or copy-paste instead."
        });
      }
    }, LLAMA_STALLED_PROGRESS_MS);

    const timeoutId = window.setTimeout(() => {
      fail(
        new Error(
          "Local Llama did not finish within 3 minutes. The browser model may be stuck on this report. Try OpenRouter or Frontier AI copy-paste."
        )
      );
    }, LLAMA_GENERATION_TIMEOUT_MS);

    activeWorker.postMessage({
      type: "extract",
      extractionPrompt,
      documentText,
      fileName
    });
  });
}

export function splitForLlamaContext(text: string): { text: string; startLine: number }[] {
  const lines = text.split(/\r?\n/);
  const chunks: { text: string; startLine: number }[] = [];
  let current: string[] = [];
  let currentStartLine = 1;
  let hasNewLinesSinceFlush = false;

  const flush = (nextLineIndex: number) => {
    const body = current.join("\n").trim();
    if (body) {
      chunks.push({ text: body, startLine: currentStartLine });
    }
    const overlap = current.slice(-LLAMA_CHUNK_OVERLAP_LINES);
    current = [...overlap];
    currentStartLine = Math.max(1, nextLineIndex - overlap.length + 1);
    hasNewLinesSinceFlush = false;
  };

  for (const [index, line] of lines.entries()) {
    current.push(line);
    hasNewLinesSinceFlush = true;
    if (current.join("\n").length >= LLAMA_CHUNK_TARGET_CHARS) {
      flush(index + 1);
    }
  }
  const finalBody = current.join("\n").trim();
  if (finalBody && hasNewLinesSinceFlush) {
    chunks.push({ text: finalBody, startLine: currentStartLine });
  }
  return chunks.length > 0 ? chunks : [{ text, startLine: 1 }];
}

function makeChunkPrompt(
  extractionPrompt: string,
  chunkNumber: number,
  totalChunks: number
): string {
  return `${extractionPrompt}

This is automatic chunk ${chunkNumber} of ${totalChunks}.
Return JSON for this chunk only. Do not mention other chunks.
If a transaction row is cut off and you cannot see all required values, omit that row.
Some boundary lines may repeat between chunks; extract visible complete rows only.
Return one complete minified JSON object with the same schema. No markdown. No prose.`;
}

function makeChunkDocumentText(
  chunkText: string,
  fileName: string,
  chunkNumber: number,
  totalChunks: number
): string {
  return `Document text chunk ${chunkNumber} of ${totalChunks} (read from ${fileName} by this app):\n\n${chunkText}`;
}

function parseChunkJson(rawText: string, chunkNumber: number): ChunkExtractionObject {
  const jsonText = extractJsonBlock(rawText);
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as ChunkExtractionObject;
    }
  } catch (error) {
    console.error("[Llama extraction] Could not parse chunk JSON", {
      chunk: chunkNumber,
      preview: previewText(rawText),
      error
    });
  }
  throw new Error(`chunk ${chunkNumber} did not return a complete JSON object`);
}

export function mergeChunkExtractions(chunks: ChunkExtractionObject[]): ChunkExtractionObject {
  const transactions: unknown[] = [];
  const seenTransactions = new Set<string>();
  const annualFigures: Record<string, unknown> = {};
  const notes: string[] = [];
  let documentType: unknown;
  let confidence: unknown;
  let netRealisedCapitalGainNoDetail: unknown;

  for (const chunk of chunks) {
    documentType ??= chunk.documentType;
    confidence = mergeConfidence(confidence, chunk.confidence);
    if (typeof chunk.notes === "string" && chunk.notes.trim()) {
      notes.push(chunk.notes.trim());
    }
    if (
      chunk.netRealisedCapitalGainNoDetail !== null &&
      chunk.netRealisedCapitalGainNoDetail !== undefined
    ) {
      netRealisedCapitalGainNoDetail ??= chunk.netRealisedCapitalGainNoDetail;
    }
    if (typeof chunk.annualFigures === "object" && chunk.annualFigures !== null) {
      for (const [key, value] of Object.entries(chunk.annualFigures as Record<string, unknown>)) {
        if (value !== null && value !== undefined && annualFigures[key] === undefined) {
          annualFigures[key] = value;
        }
      }
    }
    if (Array.isArray(chunk.capitalGainsTransactions)) {
      for (const tx of chunk.capitalGainsTransactions) {
        const key = stableTransactionKey(tx);
        if (!key || seenTransactions.has(key)) {
          continue;
        }
        seenTransactions.add(key);
        transactions.push(tx);
      }
    }
  }

  return {
    documentType,
    capitalGainsTransactions: transactions,
    annualFigures: Object.keys(annualFigures).length > 0 ? annualFigures : undefined,
    netRealisedCapitalGainNoDetail,
    confidence,
    notes: notes.length > 0 ? notes.join(" ").slice(0, 200) : "Extracted in chunks."
  };
}

function mergeConfidence(current: unknown, next: unknown): unknown {
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
  if (typeof current !== "string") {
    return next;
  }
  if (typeof next !== "string") {
    return current;
  }
  return (rank[next.toLowerCase()] ?? 0) < (rank[current.toLowerCase()] ?? 0) ? next : current;
}

function stableTransactionKey(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }
  const tx = value as Record<string, unknown>;
  return [
    tx.scripName,
    tx.purchaseDate,
    tx.sellDate,
    tx.units,
    tx.buyValue,
    tx.sellValue,
    tx.buyPrice,
    tx.sellPrice
  ]
    .map((part) =>
      String(part ?? "")
        .trim()
        .toLowerCase()
    )
    .join("|");
}

function previewText(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length <= 300 ? trimmed : `${trimmed.slice(0, 300)}…`;
}
