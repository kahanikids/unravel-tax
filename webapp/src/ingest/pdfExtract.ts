import type { TextItem } from "pdfjs-dist/types/src/display/api";

async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (typeof window === "undefined") {
    return import("pdfjs-dist/legacy/build/pdf.mjs");
  }

  const pdfjs = await import("pdfjs-dist");
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  return pdfjs;
}

/**
 * pdf.js gives text items with no inherent line breaks - joining them with a
 * space alone collapses an entire page into one line and destroys row
 * structure. Grouping by the item's y-coordinate (its vertical position on
 * the page) reconstructs line breaks the way the document actually laid
 * them out, which is what every downstream step (keyword scan, the
 * AI extraction prompt, a human skimming the paste panel) needs to make
 * sense of a statement.
 */
function groupItemsIntoLines(items: TextItem[]): string[] {
  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
  const Y_TOLERANCE = 2;

  for (const item of items) {
    if (!item.str) {
      continue;
    }
    const x = item.transform[4];
    const y = item.transform[5];
    let line = lines.find((candidate) => Math.abs(candidate.y - y) <= Y_TOLERANCE);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, str: item.str });
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((line) => line.length > 0);
}

/** Thrown instead of pdf.js's own PasswordException, so callers can show "remove the password" instead of a generic read failure without depending on pdf.js's error shape. */
export class PdfPasswordError extends Error {
  constructor() {
    super("This PDF is password-protected.");
    this.name = "PdfPasswordError";
  }
}

/**
 * Generic-sounding words that show up at the front of almost every statement
 * title ("Statement of...", "Annual Report", ...) and would make a useless
 * one-word sheet name if picked literally.
 */
const GENERIC_METADATA_WORDS = new Set([
  "statement",
  "report",
  "the",
  "a",
  "an",
  "annual",
  "consolidated",
  "account",
  "capital",
  "gains",
  "gain",
  "summary",
  "final",
  "document",
  "copy",
  "of",
  "for",
  "and",
  "acknowledgement",
  "form"
]);

/**
 * Picks one short, sheet-name-sized word or acronym out of a PDF metadata
 * string (Title/Subject), rather than the long descriptive sentence brokers
 * often put there. An ALL-CAPS token (CAMS, NSDL, CDSL, AIS...) is preferred
 * since that's usually the actual source/system name; otherwise the first
 * word that isn't generic filler.
 */
function pickShortLabel(value: string): string | undefined {
  const words = value
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const acronym = words.find((word) => /^[A-Z]{2,6}$/.test(word));
  if (acronym) {
    return acronym;
  }
  const meaningful = words.find(
    (word) => word.length > 2 && !GENERIC_METADATA_WORDS.has(word.toLowerCase())
  );
  return meaningful;
}

function deriveSheetNameHint(info: Record<string, unknown>): string | undefined {
  const title = typeof info.Title === "string" ? info.Title.trim() : "";
  const subject = typeof info.Subject === "string" ? info.Subject.trim() : "";
  return (title && pickShortLabel(title)) || (subject && pickShortLabel(subject)) || undefined;
}

/**
 * Bookmarks/outline entries and repeated "Page 1 of N" markers are both real,
 * structural signals (not a guess at table content) that several source
 * documents were merged into one PDF - each has its own page-1 restart and/or
 * its own bookmark. Surfaced as a heads-up only; this app never auto-splits
 * the file, since that would mean guessing where one statement ends and the
 * next begins.
 */
function detectMergedDocumentsNote(text: string, outlineTitles: string[]): string | undefined {
  const pageOneMarkers = text.match(/page\s*1\s*of\s*\d+/gi) ?? [];
  const distinctTitles = [...new Set(outlineTitles.filter(Boolean))];

  if (distinctTitles.length > 1) {
    const preview =
      distinctTitles.slice(0, 4).join(", ") + (distinctTitles.length > 4 ? ", ..." : "");
    return `This PDF's bookmarks suggest it contains ${distinctTitles.length} separate documents (${preview}). If the AI extraction step misses some transactions, try splitting this into separate files first (most PDF readers have an "extract pages" option) and uploading each on its own.`;
  }
  if (pageOneMarkers.length > 1) {
    return `This PDF restarts its page numbering ${pageOneMarkers.length} times, which usually means several statements were merged into one file. If the AI extraction step misses some transactions, try splitting this into separate files first and uploading each on its own.`;
  }
  return undefined;
}

export type PdfTextExtraction = {
  text: string;
  pageCount: number;
  /** A short word/acronym pulled from the PDF's own Title/Subject metadata, for naming a workbook sheet - never used for anything else. */
  sheetNameHint?: string;
  /** Set when bookmarks or repeated pagination suggest this PDF is several statements merged together. */
  mergedDocumentsNote?: string;
};

export async function extractPdfText(
  buffer: ArrayBuffer,
  password?: string
): Promise<PdfTextExtraction> {
  const pdfjs = await loadPdfJs();

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: buffer, password }).promise;
  } catch (error) {
    // pdf.js doesn't export its PasswordException class from the public API
    // (only PasswordResponses), so the documented way to recognise it is by
    // name: https://github.com/mozilla/pdf.js/blob/master/src/shared/util.js
    if (error instanceof Error && error.name === "PasswordException") {
      throw new PdfPasswordError();
    }
    throw error;
  }

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.filter((item): item is TextItem => "str" in item);
    pages.push(groupItemsIntoLines(items).join("\n"));
  }
  const text = pages.join("\n\n");

  let sheetNameHint: string | undefined;
  try {
    const { info } = await pdf.getMetadata();
    sheetNameHint = deriveSheetNameHint(info as Record<string, unknown>);
  } catch {
    // Metadata is a nice-to-have for sheet naming - never worth failing the whole read over.
  }

  let outlineTitles: string[] = [];
  try {
    const outline = await pdf.getOutline();
    outlineTitles = (outline ?? []).map((node) => node.title).filter(Boolean);
  } catch {
    // Same as above - outline is only used for an advisory note.
  }

  return {
    text,
    pageCount: pdf.numPages,
    sheetNameHint,
    mergedDocumentsNote: detectMergedDocumentsNote(text, outlineTitles)
  };
}

/**
 * Renders page 1 at a small scale for the review UI, so a non-technical user
 * can visually confirm "yes, this is my broker statement" before it's used
 * anywhere (BUILD_PLAN Section 1.4's confirm-before-commit principle). Best
 * effort only: returns undefined rather than throwing when no canvas 2D
 * context is available (e.g. under test, or an unsupported browser), since a
 * missing thumbnail should never block the actual extraction.
 */
export async function renderPdfThumbnail(
  buffer: ArrayBuffer,
  maxWidth = 200,
  password?: string
): Promise<string | undefined> {
  if (typeof document === "undefined") {
    return undefined;
  }
  try {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: buffer, password }).promise;
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = maxWidth / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      return undefined;
    }
    await page.render({ canvasContext, viewport }).promise;
    return canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

export type PdfTextDiagnostic = {
  pageCount: number;
  wordCount: number;
  /** Very little extractable text usually means a scanned/image PDF with no text layer - the AI step can't read that either. */
  looksScanned: boolean;
  /** Loose keyword check for capital-gains-statement vocabulary, just to tell the user what we noticed - never used to decide classification. */
  mentionsTransactionTerms: boolean;
  summary: string;
};

const TRANSACTION_KEYWORDS = [
  "purchase date",
  "sale date",
  "sell date",
  "quantity",
  "isin",
  "capital gain",
  "short term",
  "long term",
  "cost of acquisition"
];

export function diagnosePdfText(
  text: string,
  pageCount: number,
  mergedDocumentsNote?: string
): PdfTextDiagnostic {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wordsPerPage = pageCount > 0 ? wordCount / pageCount : wordCount;
  const looksScanned = wordsPerPage < 20;
  const lowerText = text.toLowerCase();
  const mentionsTransactionTerms = TRANSACTION_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword)
  );

  let summary: string;
  if (looksScanned) {
    summary = `We found almost no text in this PDF (${wordCount} word(s) across ${pageCount} page(s)) - it's likely a scanned image with no text layer. An AI chat that can read images may still help; a text-only extraction step can't.`;
  } else if (mentionsTransactionTerms) {
    summary = `We found ${wordCount} word(s) across ${pageCount} page(s), including wording that looks like a capital-gains statement. We can't reconstruct the table ourselves, but the AI extraction step below should have enough to work with.`;
  } else {
    summary = `We found ${wordCount} word(s) across ${pageCount} page(s), but nothing that clearly looks like transaction detail. It may still work with the AI extraction step - check its "notes" field once you try.`;
  }

  if (mergedDocumentsNote) {
    summary = `${summary} ${mergedDocumentsNote}`;
  }

  return { pageCount, wordCount, looksScanned, mentionsTransactionTerms, summary };
}
