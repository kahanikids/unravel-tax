import type { CanonicalTransactionColumn } from "./headerMatching";

export const EXPECTED_TRANSACTION_COLUMNS = [
  "Scrip Name",
  "Purchase Date",
  "Sell Date",
  "Units",
  "Buy Value",
  "Sell Value",
  "Buy Price",
  "Sell Price"
] as const;

export type IngestionKind = "csv" | "excel" | "html" | "structured_text" | "pdf_or_freeform";

export type TaxClass = "Intraday" | "ST" | "LT";

/**
 * Optional column. Missing/unrecognized values default to "equity" so every
 * existing fixture and template stays backward-compatible. "debt_mutual_fund"
 * covers Section 50AA specified funds, which are always short-term-deemed and
 * taxed at slab rate regardless of holding period - see rules/capital-gains-mutual-funds.json.
 */
export type InstrumentType = "equity" | "debt_mutual_fund";

export const OPTIONAL_INSTRUMENT_TYPE_COLUMN = "Instrument Type";

export type RawTransactionRow = Record<(typeof EXPECTED_TRANSACTION_COLUMNS)[number], string | number | Date> &
  Partial<Record<typeof OPTIONAL_INSTRUMENT_TYPE_COLUMN, string | number | Date>>;

export type NormalizedTransaction = {
  scripName: string;
  purchaseDate: string;
  sellDate: string;
  units: number;
  buyValue: number;
  sellValue: number;
  buyPrice: number;
  sellPrice: number;
  holdPeriodDays: number;
  taxClass: TaxClass;
  instrumentType: InstrumentType;
  gainLoss: number;
};

export type TransactionSummary = {
  rows: number;
  intradayGain: number;
  stcg: number;
  ltcg: number;
};

export type IngestWarningCode =
  | "missing_column"
  | "low_confidence_header"
  | "invalid_date"
  | "invalid_number"
  | "assumed_instrument_type"
  | "parse_error";

export type IngestWarning = {
  code: IngestWarningCode;
  message: string;
  rowIndex?: number;
  column?: string;
};

export type HeaderMatchConfidence = "exact" | "substring" | "typo";

export type ResolvedHeader = {
  raw: string;
  canonical: CanonicalTransactionColumn;
  confidence: HeaderMatchConfidence;
};

export type PromptRoute = {
  kind: "pdf_or_freeform";
  route: "guided_prompt";
  prompt: "prompts/01-extract-statement.md";
  reason: string;
};

/** Unified ingest outcome: rows + warnings when parseable; promptRoute when not. */
export type IngestResult = {
  kind: IngestionKind;
  transactions: NormalizedTransaction[];
  summary: TransactionSummary;
  warnings: IngestWarning[];
  headerMap: Record<string, CanonicalTransactionColumn>;
  headerDetails: ResolvedHeader[];
  sourceHeaders: string[];
  sourceRecords: Record<string, string | number | Date>[];
  promptRoute?: PromptRoute;
};

/** @deprecated Use IngestResult — kept for scripts that only need transactions. */
export type ParsedTransactionSource = {
  kind: Exclude<IngestionKind, "pdf_or_freeform">;
  transactions: NormalizedTransaction[];
  summary: TransactionSummary;
};
