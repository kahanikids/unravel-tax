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

export type RawTransactionRow = Record<(typeof EXPECTED_TRANSACTION_COLUMNS)[number], string | number | Date>;

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
  gainLoss: number;
};

export type TransactionSummary = {
  rows: number;
  intradayGain: number;
  stcg: number;
  ltcg: number;
};

export type ParsedTransactionSource = {
  kind: Exclude<IngestionKind, "pdf_or_freeform">;
  transactions: NormalizedTransaction[];
  summary: TransactionSummary;
};

export type PromptRoute = {
  kind: "pdf_or_freeform";
  route: "guided_prompt";
  prompt: "prompts/01-extract-statement.md";
  reason: string;
};

export type IngestionResult = ParsedTransactionSource | PromptRoute;
