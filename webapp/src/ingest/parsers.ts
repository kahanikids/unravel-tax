import Papa from "papaparse";
import { readSheet } from "read-excel-file/universal";
import {
  EXPECTED_TRANSACTION_COLUMNS,
  type IngestionKind,
  type ParsedTransactionSource,
  type PromptRoute,
  type RawTransactionRow
} from "./types";
import { assertTransactionColumns, normalizeRows, summarizeTransactions } from "./normalize";

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
  const parsed = Papa.parse<RawTransactionRow>(text, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }

  assertTransactionColumns(parsed.meta.fields ?? []);
  const transactions = normalizeRows(parsed.data);
  return { kind: "csv", transactions, summary: summarizeTransactions(transactions) };
}

export function parseStructuredText(text: string): ParsedTransactionSource {
  const parsed = Papa.parse<RawTransactionRow>(text, {
    delimiter: "\t",
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }

  assertTransactionColumns(parsed.meta.fields ?? []);
  const transactions = normalizeRows(parsed.data);
  return { kind: "structured_text", transactions, summary: summarizeTransactions(transactions) };
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<ParsedTransactionSource> {
  const rows = (await readSheet(new Blob([buffer]))) as ExcelCell[][];
  const headers = rows[0]?.map((cell: ExcelCell) => String(cell ?? "").trim()) ?? [];
  assertTransactionColumns(headers);

  const records = rows.slice(1).map((row: ExcelCell[]) =>
    Object.fromEntries(headers.map((header: string, index: number) => [header, row[index] ?? ""]))
  ) as RawTransactionRow[];

  const transactions = normalizeRows(records.filter((row) => Object.values(row).some((value) => value !== "")));
  return { kind: "excel", transactions, summary: summarizeTransactions(transactions) };
}

export function parseHtmlText(text: string): ParsedTransactionSource {
  const tables = extractTables(text);
  const transactionTable = tables.find((table) => {
    const headers = table[0] ?? [];
    return EXPECTED_TRANSACTION_COLUMNS.every((column) => headers.includes(column));
  });

  if (!transactionTable) {
    throw new Error("Could not find a transaction table with the expected headers.");
  }

  const headers = transactionTable[0];
  assertTransactionColumns(headers);
  const records = transactionTable.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  ) as RawTransactionRow[];

  const transactions = normalizeRows(records);
  return { kind: "html", transactions, summary: summarizeTransactions(transactions) };
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
  return EXPECTED_TRANSACTION_COLUMNS.every((column) => headers.includes(column));
}
