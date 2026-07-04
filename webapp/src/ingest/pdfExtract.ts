/**
 * pdf.js gives text items with no inherent line breaks - joining them with a
 * space alone collapses an entire page into one line and destroys row
 * structure. Grouping by the item's y-coordinate (its vertical position on
 * the page) reconstructs line breaks the way the document actually laid
 * them out, which is what every downstream step (keyword scan, the
 * AI extraction prompt, a human skimming the paste panel) needs to make
 * sense of a statement.
 */
import type { TextItem } from "pdfjs-dist/types/src/display/api";

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

export type PdfTextExtraction = {
  text: string;
  pageCount: number;
};

/** Thrown instead of pdf.js's own PasswordException, so callers can show "remove the password" instead of a generic read failure without depending on pdf.js's error shape. */
export class PdfPasswordError extends Error {
  constructor() {
    super("This PDF is password-protected.");
    this.name = "PdfPasswordError";
  }
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfTextExtraction> {
  const pdfjs = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  }

  let pdf;
  try {
    pdf = await pdfjs.getDocument({ data: buffer }).promise;
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
  return { text: pages.join("\n\n"), pageCount: pdf.numPages };
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

export function diagnosePdfText(text: string, pageCount: number): PdfTextDiagnostic {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const wordsPerPage = pageCount > 0 ? wordCount / pageCount : wordCount;
  const looksScanned = wordsPerPage < 20;
  const lowerText = text.toLowerCase();
  const mentionsTransactionTerms = TRANSACTION_KEYWORDS.some((keyword) => lowerText.includes(keyword));

  let summary: string;
  if (looksScanned) {
    summary = `We found almost no text in this PDF (${wordCount} word(s) across ${pageCount} page(s)) - it's likely a scanned image with no text layer. An AI chat that can read images may still help; a text-only extraction step can't.`;
  } else if (mentionsTransactionTerms) {
    summary = `We found ${wordCount} word(s) across ${pageCount} page(s), including wording that looks like a capital-gains statement. We can't reconstruct the table ourselves, but the AI extraction step below should have enough to work with.`;
  } else {
    summary = `We found ${wordCount} word(s) across ${pageCount} page(s), but nothing that clearly looks like transaction detail. It may still work with the AI extraction step - check its "notes" field once you try.`;
  }

  return { pageCount, wordCount, looksScanned, mentionsTransactionTerms, summary };
}
