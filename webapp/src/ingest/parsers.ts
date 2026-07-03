import Papa from "papaparse";
import { readSheet } from "read-excel-file/universal";
import {
  EXPECTED_TRANSACTION_COLUMNS,
  type IngestionKind,
  type ParsedTransactionSource,
  type PromptRoute,
  type RawTransactionRow
} from "./types";
import { normalizeRows, summarizeTransactions } from "./normalize";
import { missingColumnsMessage, remapRecordKeys, resolveTransactionHeaders } from "./headerMatching";

type Table = string[][];
type ExcelCell = string | number | Date | boolean | null;

export function detectIngestionKind(fileName: string, mimeType = ""): IngestionKind {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (lowerName.endsWith(".csv") || lowerMime.includes("csv")) {
    return "csv";
  }
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    return "excel";
  }
  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm") || lowerMime.includes("html")) {
    return "html";
  }
  if (lowerName.endsWith(".tsv")) {
    return "structured_text";
  }
  return "pdf_or_freeform";
}

export function parseTextSource(fileName: string, text: string, mimeType = ""): ParsedTransactionSource | PromptRoute {
  const kind = detectIngestionKind(fileName, mimeType);

  if (kind === "csv") {
    return parseCsvText(text);
  }
  if (kind === "html") {
    return parseHtmlText(text);
  }
  if (kind === "structured_text") {
    return parseStructuredText(text);
  }
  if (hasExpectedHeader(text, "\t")) {
    return parseStructuredText(text);
  }
  if (hasExpectedHeader(text, ",")) {
    return parseCsvText(text);
  }

  return routePdfOrFreeform();
}

export function parseCsvText(text: string): ParsedTransactionSource {
  const parsed = Papa.parse<Record<string, string | number | Date>>(text, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }

  const { headerMap, missing } = resolveTransactionHeaders(parsed.meta.fields ?? []);
  if (missing.length > 0) {
    throw new Error(missingColumnsMessage(missing));
  }

  const records = parsed.data.map((row) => remapRecordKeys(row, headerMap)) as RawTransactionRow[];
  const transactions = normalizeRows(records);
  return { kind: "csv", transactions, summary: summarizeTransactions(transactions) };
}

export function parseStructuredText(text: string): ParsedTransactionSource {
  const parsed = Papa.parse<Record<string, string | number | Date>>(text, {
    delimiter: "\t",
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }

  const { headerMap, missing } = resolveTransactionHeaders(parsed.meta.fields ?? []);
  if (missing.length > 0) {
    throw new Error(missingColumnsMessage(missing));
  }

  const records = parsed.data.map((row) => remapRecordKeys(row, headerMap)) as RawTransactionRow[];
  const transactions = normalizeRows(records);
  return { kind: "structured_text", transactions, summary: summarizeTransactions(transactions) };
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParsedTransactionSource> {
  const rows = (await readSheet(new Blob([buffer]))) as ExcelCell[][];
  const headers = rows[0]?.map((cell: ExcelCell) => String(cell ?? "").trim()) ?? [];
  const { headerMap, missing } = resolveTransactionHeaders(headers);
  if (missing.length > 0) {
    throw new Error(missingColumnsMessage(missing));
  }

  const records = rows.slice(1).map((row: ExcelCell[]) =>
    remapRecordKeys(
      Object.fromEntries(headers.map((header: string, index: number) => [header, row[index] ?? ""])),
      headerMap
    )
  ) as RawTransactionRow[];

  const transactions = normalizeRows(records.filter((row) => Object.values(row).some((value) => value !== "")));
  return { kind: "excel", transactions, summary: summarizeTransactions(transactions) };
}

export function parseHtmlText(text: string): ParsedTransactionSource {
  const tables = extractTables(text);
  const candidates = tables.map((table) => ({ table, resolution: resolveTransactionHeaders(table[0] ?? []) }));
  const best = candidates.find((candidate) => candidate.resolution.missing.length === 0);

  if (!best) {
    // Report the fewest-missing-fields table's gaps, since that's the one the user most likely meant.
    const closest = candidates.sort((a, b) => a.resolution.missing.length - b.resolution.missing.length)[0];
    throw new Error(missingColumnsMessage(closest?.resolution.missing ?? EXPECTED_TRANSACTION_COLUMNS.slice()));
  }

  const headers = best.table[0];
  const records = best.table.slice(1).map((row) =>
    remapRecordKeys(
      Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])),
      best.resolution.headerMap
    )
  ) as RawTransactionRow[];

  const transactions = normalizeRows(records);
  return { kind: "html", transactions, summary: summarizeTransactions(transactions) };
}

/**
 * Closes the Stage 4 handoff loop (BUILD_PLAN.md Section 3/7) for PDF and
 * free-form text: those formats route to prompts/01-extract-statement.md
 * outside this app, and the user pastes the returned table back in here.
 * Accepts either a markdown table or a tab-separated block, since the
 * prompt lets the model choose either.
 */
export function parsePastedExtraction(text: string): ParsedTransactionSource {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Paste the table you got back from the extraction prompt.");
  }
  if (trimmed.includes("|")) {
    return parseMarkdownTable(trimmed);
  }
  return parseStructuredText(trimmed);
}

function parseMarkdownTable(text: string): ParsedTransactionSource {
  const separatorPattern = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !separatorPattern.test(line));

  const rows = lines.map((line) =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim())
  );

  const [headers, ...dataRows] = rows;
  if (!headers) {
    throw new Error("Could not find a table in the pasted text.");
  }
  const { headerMap, missing } = resolveTransactionHeaders(headers);
  if (missing.length > 0) {
    throw new Error(missingColumnsMessage(missing));
  }

  const records = dataRows.map((row) =>
    remapRecordKeys(Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])), headerMap)
  ) as RawTransactionRow[];

  const transactions = normalizeRows(records);
  return { kind: "structured_text", transactions, summary: summarizeTransactions(transactions) };
}

export function routePdfOrFreeform(): PromptRoute {
  return {
    kind: "pdf_or_freeform",
    route: "guided_prompt",
    prompt: "prompts/01-extract-statement.md",
    reason: "PDF/free-form table reconstruction stays in the guided AI extraction prompt path."
  };
}

export async function parseFile(file: File): Promise<ParsedTransactionSource | PromptRoute> {
  const kind = detectIngestionKind(file.name, file.type);

  if (kind === "excel") {
    return parseExcelBuffer(await file.arrayBuffer());
  }

  return parseTextSource(file.name, await file.text(), file.type);
}

function extractTables(text: string): Table[] {
  if (typeof DOMParser !== "undefined") {
    return extractTablesWithDomParser(text);
  }
  return extractTablesWithRegex(text);
}

function extractTablesWithDomParser(text: string): Table[] {
  const document = new DOMParser().parseFromString(text, "text/html");
  return Array.from(document.querySelectorAll("table")).map((table) =>
    Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th,td")).map((cell) => normalizeCell(cell.textContent ?? ""))
    )
  );
}

function extractTablesWithRegex(text: string): Table[] {
  const tableMatches = text.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  return tableMatches.map((tableHtml) => {
    const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    return rowMatches.map((rowHtml) => {
      const cellMatches = rowHtml.match(/<(?:th|td)[^>]*>[\s\S]*?<\/(?:th|td)>/gi) ?? [];
      return cellMatches.map((cellHtml) => normalizeCell(cellHtml.replace(/<[^>]+>/g, "")));
    });
  });
}

function normalizeCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasExpectedHeader(text: string, delimiter: "," | "\t"): boolean {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return false;
  }

  const headers = firstLine.split(delimiter).map((header) => header.trim());
  return resolveTransactionHeaders(headers).missing.length === 0;
}
