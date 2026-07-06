import Papa from "papaparse";
import readXlsxFile from "read-excel-file/universal";
import {
  EXPECTED_TRANSACTION_COLUMNS,
  type ExtractionSummaryFigures,
  type IngestionKind,
  type IngestResult,
  type IngestWarning,
  type PromptRoute,
  type RawTransactionRow,
  type ResolvedHeader
} from "./types";
import { formatFixtureDate, normalizeRowsSoft, summarizeTransactions } from "./normalize";
import {
  buildHeaderMapFromAssignments,
  missingColumnsMessage,
  remapRecordKeys,
  resolveTransactionHeaders,
  type CanonicalTransactionColumn,
  type HeaderResolution
} from "./headerMatching";
import { postProcessExtractionRaw } from "./extractionPostProcess";

type Table = string[][];
type ExcelCell = string | number | Date | boolean | null;

const HEADER_SCAN_ROWS = 15;

/**
 * Finds the row most likely to be the header, scanning the first few rows.
 * Broker exports (Excel and CMOTS/ABML-style HTML) put title banners or a
 * decorative group row above the real column names, so row 0 isn't reliable.
 */
export function findHeaderRowIndex(rows: unknown[][]): number {
  const limit = Math.min(rows.length, HEADER_SCAN_ROWS);
  let bestIndex = 0;
  let bestMissing = EXPECTED_TRANSACTION_COLUMNS.length as number;

  for (let index = 0; index < limit; index += 1) {
    const headers = (rows[index] ?? []).map((cell) => String(cell ?? "").trim());
    const { missing } = resolveTransactionHeaders(headers);
    if (missing.length < bestMissing) {
      bestMissing = missing.length;
      bestIndex = index;
    }
    if (missing.length === 0) {
      return index;
    }
  }
  return bestIndex;
}

/** First occurrence wins, so duplicate broker headers (two "Buy Value" columns) keep the real one. */
function rowToRecord(
  headers: string[],
  values: (string | number | Date)[]
): Record<string, string | number | Date> {
  const record: Record<string, string | number | Date> = {};
  headers.forEach((header, index) => {
    if (!(header in record)) {
      record[header] = values[index] ?? "";
    }
  });
  return record;
}

export function detectIngestionKind(fileName: string, mimeType = ""): IngestionKind {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (lowerName.endsWith(".pdf") || lowerMime.includes("pdf")) {
    return "pdf_or_freeform";
  }
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

export function routePdfOrFreeform(
  reason: string,
  extra?: { extractedText?: string; diagnosticSummary?: string; suggestedSheetName?: string }
): PromptRoute {
  return {
    kind: "pdf_or_freeform",
    route: "guided_prompt",
    prompt: "prompts/01-extract-statement.md",
    reason,
    ...extra
  };
}

function emptyResult(
  kind: IngestionKind,
  promptRoute?: PromptRoute,
  warnings: IngestWarning[] = []
): IngestResult {
  return {
    kind,
    transactions: [],
    summary: { rows: 0, intradayGain: 0, stcg: 0, ltcg: 0 },
    warnings,
    headerMap: {},
    headerDetails: [],
    sourceHeaders: [],
    sourceRecords: [],
    promptRoute
  };
}

function headerWarnings(resolution: HeaderResolution): IngestWarning[] {
  const warnings: IngestWarning[] = [];
  for (const detail of resolution.details) {
    if (detail.confidence === "substring" || detail.confidence === "typo") {
      warnings.push({
        code: "low_confidence_header",
        message: `Mapped "${detail.raw}" → ${detail.canonical} (${detail.confidence} match). Please verify.`,
        column: detail.canonical
      });
    }
  }
  for (const missing of resolution.missing) {
    warnings.push({
      code: "missing_column",
      message: missingColumnsMessage([missing]),
      column: missing
    });
  }
  return warnings;
}

function buildIngestResult(
  kind: IngestionKind,
  sourceHeaders: string[],
  sourceRecords: Record<string, string | number | Date>[],
  resolution: HeaderResolution
): IngestResult {
  const warnings = headerWarnings(resolution);
  const headerDetails: ResolvedHeader[] = resolution.details.map((d) => ({
    raw: d.raw,
    canonical: d.canonical,
    confidence: d.confidence
  }));

  if (resolution.missing.length > 0) {
    return {
      ...emptyResult(
        kind,
        routePdfOrFreeform(`Could not map required columns: ${resolution.missing.join(", ")}.`),
        warnings
      ),
      headerMap: resolution.headerMap,
      headerDetails,
      sourceHeaders,
      sourceRecords
    };
  }

  const hasInstrumentType = Object.values(resolution.headerMap).includes("Instrument Type");
  if (!hasInstrumentType) {
    warnings.push({
      code: "assumed_instrument_type",
      message: "No Instrument Type column found. All rows treated as equity."
    });
  }

  const mappedHeaderKeys = new Set(Object.keys(resolution.headerMap));
  const unmappedHeaders = sourceHeaders.filter((header) => !mappedHeaderKeys.has(header));

  const rowInputs = sourceRecords
    .map((record) => {
      const brokerColumns: Record<string, string | number> = {};
      for (const header of unmappedHeaders) {
        const value = record[header];
        if (value === undefined || value === null || String(value).trim() === "") {
          continue;
        }
        brokerColumns[header] =
          value instanceof Date ? formatFixtureDate(value) : (value as string | number);
      }
      const row = remapRecordKeys(record, resolution.headerMap) as RawTransactionRow;
      return { row, brokerColumns };
    })
    // A row with no scrip name isn't a transaction - drops subtotal/blank rows across every format.
    .filter(({ row }) => String(row["Scrip Name"] ?? "").trim() !== "");

  const { transactions, warnings: rowWarnings } = normalizeRowsSoft(rowInputs);
  return {
    kind,
    transactions,
    summary: summarizeTransactions(transactions),
    warnings: [...warnings, ...rowWarnings],
    headerMap: resolution.headerMap,
    headerDetails,
    sourceHeaders,
    sourceRecords
  };
}

function parseDelimitedText(
  text: string,
  delimiter: string,
  kind: "csv" | "structured_text"
): IngestResult {
  const parsed = Papa.parse<Record<string, string | number | Date>>(text, {
    delimiter,
    header: true,
    skipEmptyLines: true
  });

  // PapaParse errors are mostly row-level (a trailing disclaimer line, a
  // stray comma) and the rest of the file is fine. Surface them as warnings
  // in the review modal instead of rejecting the whole file - only a file
  // with no readable rows at all routes to the extraction prompt.
  const rowIssueWarnings: IngestWarning[] = parsed.errors.slice(0, 5).map((e) => ({
    code: "parse_error",
    message: typeof e.row === "number" ? `Line ${e.row + 2}: ${e.message}` : e.message,
    rowIndex: typeof e.row === "number" ? e.row : undefined
  }));
  if (parsed.errors.length > 5) {
    rowIssueWarnings.push({
      code: "parse_error",
      message: `...and ${parsed.errors.length - 5} more line(s) with the same kind of issue.`
    });
  }

  if (parsed.data.length === 0) {
    return emptyResult(
      kind,
      routePdfOrFreeform("Could not read delimited text."),
      rowIssueWarnings
    );
  }

  const sourceHeaders = parsed.meta.fields ?? [];
  const resolution = resolveTransactionHeaders(sourceHeaders);
  const result = buildIngestResult(kind, sourceHeaders, parsed.data, resolution);
  return { ...result, warnings: [...rowIssueWarnings, ...result.warnings] };
}

export function parseCsvText(text: string): IngestResult {
  return parseDelimitedText(text, ",", "csv");
}

export function parseStructuredText(text: string): IngestResult {
  return parseDelimitedText(text, "\t", "structured_text");
}

export async function parseExcelBuffer(buffer: ArrayBuffer): Promise<IngestResult> {
  // Broker workbooks often have several sheets (summary, equity, MF,
  // disclaimers). Read them all and use the sheet whose headers match the
  // transaction columns best, the same way HTML ingestion picks between
  // multiple tables on a page.
  const sheets = (await readXlsxFile(new Blob([buffer]))) as {
    sheet: string;
    data: ExcelCell[][];
  }[];
  const nonEmptySheets = sheets.filter((s) => s.data.length > 0);
  if (nonEmptySheets.length === 0) {
    return emptyResult("excel", routePdfOrFreeform("Excel file is empty."));
  }

  const candidates = nonEmptySheets.map(({ sheet, data }) => {
    const headerRowIndex = findHeaderRowIndex(data);
    const headers = data[headerRowIndex]?.map((cell: ExcelCell) => String(cell ?? "").trim()) ?? [];
    return { sheet, data, headerRowIndex, headers, resolution: resolveTransactionHeaders(headers) };
  });

  const best =
    candidates.find((candidate) => candidate.resolution.missing.length === 0) ??
    [...candidates].sort((a, b) => a.resolution.missing.length - b.resolution.missing.length)[0];

  const sourceRecords = best.data
    .slice(best.headerRowIndex + 1)
    .map((row: ExcelCell[]) => rowToRecord(best.headers, row.map(cellToFieldValue)));

  const result = buildIngestResult("excel", best.headers, sourceRecords, best.resolution);
  if (nonEmptySheets.length > 1) {
    result.warnings.unshift({
      code: "low_confidence_header",
      message: `This workbook has ${nonEmptySheets.length} sheets; read "${best.sheet}". If your transactions are on a different sheet, save that sheet as its own file and add it too.`
    });
  }
  return result;
}

export function parseHtmlText(text: string): IngestResult {
  const tables = extractTables(text);
  if (tables.length === 0) {
    return emptyResult("html", routePdfOrFreeform("No HTML tables found."));
  }

  // A broker page bundles many tables (layout, responsive duplicates, the real
  // one), and the real one may put its column names below a group-banner row -
  // so scan each table for its own best header row, then pick the best table.
  const candidates = tables.map((table) => {
    const headerIndex = findHeaderRowIndex(table);
    const headers = table[headerIndex] ?? [];
    return {
      headers,
      dataRows: table.slice(headerIndex + 1),
      resolution: resolveTransactionHeaders(headers)
    };
  });

  const best =
    candidates.find((candidate) => candidate.resolution.missing.length === 0) ??
    [...candidates].sort((a, b) => a.resolution.missing.length - b.resolution.missing.length)[0];

  const sourceRecords = best.dataRows.map((row) => rowToRecord(best.headers, row));
  return buildIngestResult("html", best.headers, sourceRecords, best.resolution);
}

export function parseTextSource(fileName: string, text: string, mimeType = ""): IngestResult {
  const kind = detectIngestionKind(fileName, mimeType);
  const trimmed = text.trim();

  if (!trimmed) {
    return emptyResult(
      kind === "pdf_or_freeform" ? "pdf_or_freeform" : kind,
      routePdfOrFreeform("File is empty.")
    );
  }

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

  return emptyResult(
    "pdf_or_freeform",
    routePdfOrFreeform(
      "PDF/free-form table reconstruction stays in the guided AI extraction prompt path.",
      { extractedText: text }
    )
  );
}

/**
 * Closes the Stage 4 handoff loop (BUILD_PLAN.md Section 3/7) for PDF and
 * free-form text: those formats route to prompts/01-extract-statement.md
 * outside this app, and the user pastes the returned table back in here.
 */
export function parsePastedExtraction(text: string, sourceText?: string): IngestResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return emptyResult("structured_text", undefined, [
      {
        code: "parse_error",
        message: "Paste the JSON block you got back from the extraction prompt."
      }
    ]);
  }
  // The extraction prompt now asks the AI for one standardised JSON object, so
  // that's the primary contract. A markdown/TSV table is still accepted as a
  // graceful fallback (older prompts, or a user who pastes a table by hand).
  if (trimmed.startsWith("{") || trimmed.startsWith("```")) {
    return parseExtractionJson(trimmed, sourceText);
  }
  if (trimmed.includes("|")) {
    return parseMarkdownTable(trimmed);
  }
  return parseStructuredText(trimmed);
}

/**
 * Parses the standardised extraction JSON. Defensive by design: unknown fields
 * are ignored, missing/null fields are treated as absent, and numbers written
 * as strings with ₹/commas are tolerated (the normalizer already cleans those).
 * capitalGainsTransactions map straight onto the canonical row-shape and run
 * through the same normalizeRowsSoft/deriveComputedFields path as every other
 * format, so classification is identical. Annual figures and any net-realised
 * gain are surfaced for guidance only - never fed into the tax engine here.
 */
export function parseExtractionJson(text: string, sourceText?: string): IngestResult {
  const pasteHint =
    "That doesn't look like complete JSON. Paste the whole JSON block the AI gave you, starting with { and ending with }.";
  const normalizedText = postProcessExtractionRaw(text, sourceText);
  let data: unknown;
  try {
    data = JSON.parse(normalizedText);
  } catch {
    return emptyResult("structured_text", undefined, [{ code: "parse_error", message: pasteHint }]);
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return emptyResult("structured_text", undefined, [{ code: "parse_error", message: pasteHint }]);
  }

  const obj = data as Record<string, unknown>;
  const rawTransactions = Array.isArray(obj.capitalGainsTransactions)
    ? obj.capitalGainsTransactions
    : [];
  const rowInputs = rawTransactions
    .map((item) => ({ row: jsonTransactionToRow(item) }))
    // A row with no scrip name isn't a usable transaction - mirrors buildIngestResult.
    .filter(({ row }) => String(row["Scrip Name"] ?? "").trim() !== "");
  const { transactions, warnings } = normalizeRowsSoft(rowInputs);

  const summaryFigures = parseAnnualFigures(obj.annualFigures, obj.netRealisedCapitalGainNoDetail);
  const summary = summarizeTransactions(transactions);
  const sourceTotalWarnings = sourceText
    ? brokerSummaryTotalWarnings(sourceText, summary, summaryFigures)
    : [];

  return {
    kind: "structured_text",
    transactions,
    summary,
    warnings: [...sourceTotalWarnings, ...warnings],
    headerMap: {},
    headerDetails: [],
    sourceHeaders: [],
    sourceRecords: [],
    summaryFigures,
    // A net realised gain with no per-transaction rows can't be split ST/LT, so
    // it's a gap to flag, not a figure to use - only when no real rows came in.
    netGainOnly:
      summaryFigures?.netRealisedGainNoDetail !== undefined &&
      !hasCapitalGainsSummarySplit(summaryFigures) &&
      transactions.length === 0,
    documentType: optionalString(obj.documentType),
    confidence: optionalString(obj.confidence),
    notes: optionalString(obj.notes)
  };
}

function brokerSummaryTotalWarnings(
  sourceText: string,
  summary: ReturnType<typeof summarizeTransactions>,
  summaryFigures?: ExtractionSummaryFigures
): IngestWarning[] {
  const sourceTotals = extractBrokerSummaryTotals(sourceText);
  if (!sourceTotals) {
    return [];
  }
  const extractedSpeculative =
    summary.rows > 0 ? summary.intradayGain : summaryFigures?.speculativeGain;
  const extractedSt = summary.rows > 0 ? summary.stcg : summaryFigures?.shortTermCapitalGains;
  const extractedLt = summary.rows > 0 ? summary.ltcg : summaryFigures?.longTermCapitalGains;
  const checks: { label: string; source: number; extracted: number }[] = [
    {
      label: "Speculative / Intraday income",
      source: sourceTotals.speculativeGain,
      extracted: extractedSpeculative ?? 0
    },
    { label: "Short-Term Capital Gains", source: sourceTotals.stGain, extracted: extractedSt ?? 0 },
    { label: "Long-Term Capital Gains", source: sourceTotals.ltGain, extracted: extractedLt ?? 0 }
  ];
  return checks
    .filter((check) => check.source !== 0 || check.extracted !== 0)
    .filter((check) => Math.abs(check.source - check.extracted) > 5)
    .map((check) => ({
      code: "source_total_mismatch",
      message: `The report summary says ${check.label} is ${formatSignedInr(check.source)}, but the extracted rows add up to ${formatSignedInr(check.extracted)}. This extraction is probably incomplete. Use Frontier AI copy-paste or upload the broker Excel/XLSX instead.`
    }));
}

function extractBrokerSummaryTotals(sourceText: string):
  | {
      speculativeGain: number;
      stGain: number;
      ltGain: number;
    }
  | undefined {
  const compact = sourceText.replace(/\s+/g, " ").trim();
  if (!/\bST\s+GAIN\b/i.test(compact) || !/\bLT\s+GAIN\b/i.test(compact)) {
    return undefined;
  }
  const equityRow = compact.match(/\bEquity\b\s+((?:-?\(?[\d,]+(?:\.\d+)?\)?\s+){5,12})/i);
  if (!equityRow) {
    return undefined;
  }
  const numbers = [...equityRow[1].matchAll(/-?\(?[\d,]+(?:\.\d+)?\)?/g)]
    .map((match) => coerceAmount(match[0]))
    .filter((value): value is number => value !== undefined);
  if (numbers.length < 6) {
    return undefined;
  }
  return {
    speculativeGain: numbers[3],
    stGain: numbers[4],
    ltGain: numbers[5]
  };
}

function formatSignedInr(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}₹${Math.abs(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Maps one JSON transaction object onto the canonical RawTransactionRow keys. Values pass through as-is; the normalizer cleans dates/numbers. */
function jsonTransactionToRow(item: unknown): RawTransactionRow {
  const t = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
  const cell = (value: unknown): string | number => {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || trimmed.toLowerCase() === "null" || trimmed.toLowerCase() === "undefined") {
        return "";
      }
      return trimmed;
    }
    return "";
  };
  return {
    "Scrip Name": cell(t.scripName),
    "Purchase Date": cell(t.purchaseDate),
    "Sell Date": cell(t.sellDate),
    Units: cell(t.units),
    "Buy Value": cell(t.buyValue),
    "Sell Value": cell(t.sellValue),
    "Buy Price": cell(t.buyPrice),
    "Sell Price": cell(t.sellPrice),
    "Instrument Type": cell(t.instrumentType)
  };
}

function parseAnnualFigures(
  annual: unknown,
  netRealisedGain: unknown
): ExtractionSummaryFigures | undefined {
  const figures: ExtractionSummaryFigures = {};
  const source = (typeof annual === "object" && annual !== null ? annual : {}) as Record<
    string,
    unknown
  >;
  const assign = (key: keyof ExtractionSummaryFigures, value: unknown) => {
    const amount = coerceAmount(value);
    if (amount !== undefined) {
      figures[key] = amount;
    }
  };
  assign("dividendIncome", source.dividendIncome);
  assign("interestIncome", source.interestIncome);
  assign("tdsDeducted", source.tdsDeducted);
  assign("deductibleCharges", source.deductibleCharges);
  assign("speculativeGain", source.speculativeGain);
  assign("shortTermCapitalGains", source.shortTermCapitalGains);
  assign("longTermCapitalGains", source.longTermCapitalGains);
  assign("debtOrSpecifiedMutualFundGains", source.debtOrSpecifiedMutualFundGains);
  assign("totalCapitalGains", source.totalCapitalGains);
  assign("netRealisedGainNoDetail", netRealisedGain);
  return Object.keys(figures).length > 0 ? figures : undefined;
}

function hasCapitalGainsSummarySplit(figures: ExtractionSummaryFigures | undefined): boolean {
  return Boolean(
    figures &&
    (figures.speculativeGain !== undefined ||
      figures.shortTermCapitalGains !== undefined ||
      figures.longTermCapitalGains !== undefined ||
      figures.debtOrSpecifiedMutualFundGains !== undefined)
  );
}

/** Tolerant number coercion: plain numbers, or strings with ₹/commas; null/undefined/"not stated" -> absent. */
function coerceAmount(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const cleaned = value.replace(/[₹,\s]/g, "").replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") {
    return undefined;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : undefined;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseMarkdownTable(text: string): IngestResult {
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
    return emptyResult(
      "structured_text",
      routePdfOrFreeform("Could not find a table in the pasted text.")
    );
  }

  const sourceRecords = dataRows.map((row) => rowToRecord(headers, row));
  const resolution = resolveTransactionHeaders(headers);
  return buildIngestResult("structured_text", headers, sourceRecords, resolution);
}

export function reparseWithColumnMap(
  kind: IngestionKind,
  sourceHeaders: string[],
  sourceRecords: Record<string, string | number | Date>[],
  assignments: Partial<Record<CanonicalTransactionColumn, string>>
): IngestResult {
  const manualMap = buildHeaderMapFromAssignments(sourceHeaders, assignments);
  const auto = resolveTransactionHeaders(sourceHeaders.filter((h) => !(h in manualMap)));
  const headerMap = { ...auto.headerMap, ...manualMap };
  const matched = new Set(Object.values(headerMap));
  const missing = EXPECTED_TRANSACTION_COLUMNS.filter((col) => !matched.has(col));
  const resolution = {
    headerMap,
    missing,
    details: [
      ...auto.details.filter((d) => !(d.raw in manualMap)),
      ...Object.entries(manualMap).map(([raw, canonical]) => ({
        raw,
        canonical,
        confidence: "exact" as const
      }))
    ]
  };
  return buildIngestResult(kind, sourceHeaders, sourceRecords, resolution);
}

export async function parseFile(file: File): Promise<IngestResult> {
  const kind = detectIngestionKind(file.name, file.type);

  if (kind === "excel") {
    return parseExcelBuffer(await file.arrayBuffer());
  }

  if (kind === "pdf_or_freeform" && file.name.toLowerCase().endsWith(".pdf")) {
    try {
      const { extractPdfText, diagnosePdfText } = await import("./pdfExtract");
      const { text, pageCount, sheetNameHint, mergedDocumentsNote } = await extractPdfText(
        await file.arrayBuffer()
      );
      const diagnostic = diagnosePdfText(text, pageCount, mergedDocumentsNote);
      const result = parseTextSource(file.name, text, file.type);
      if (result.transactions.length > 0) {
        return { ...result, kind: "pdf_or_freeform", suggestedSheetName: sheetNameHint };
      }
      const promptRoute = routePdfOrFreeform(
        result.promptRoute?.reason ?? "Could not find a transaction table in this PDF.",
        {
          extractedText: text,
          diagnosticSummary: diagnostic.summary,
          suggestedSheetName: sheetNameHint
        }
      );
      return { ...result, kind: "pdf_or_freeform", promptRoute };
    } catch (error) {
      const { PdfPasswordError } = await import("./pdfExtract");
      if (error instanceof PdfPasswordError) {
        return emptyResult(
          "pdf_or_freeform",
          routePdfOrFreeform(
            "This PDF is password-protected. Open it, save/print an unprotected copy (most PDF readers and phone apps can do this), and upload that instead."
          )
        );
      }
      return emptyResult(
        "pdf_or_freeform",
        routePdfOrFreeform("Could not read text from this PDF.")
      );
    }
  }

  return parseTextSource(file.name, await file.text(), file.type);
}

function cellToFieldValue(cell: ExcelCell): string | number | Date {
  if (cell === null || cell === undefined || typeof cell === "boolean") {
    return "";
  }
  return cell;
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
