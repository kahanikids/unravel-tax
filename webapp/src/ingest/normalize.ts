import {
  OPTIONAL_INSTRUMENT_TYPE_COLUMN,
  type InstrumentType,
  type NormalizedTransaction,
  type RawTransactionRow,
  type TaxClass,
  type TransactionSummary
} from "./types";
import { missingColumnsMessage, resolveTransactionHeaders } from "./headerMatching";

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11
};

/**
 * Kept for backward compatibility with anything checking for exact headers.
 * Parsers in parsers.ts call resolveTransactionHeaders() directly instead,
 * since they also need the header map to remap fuzzy-matched columns.
 */
export function assertTransactionColumns(headers: string[]): void {
  const { missing } = resolveTransactionHeaders(headers);
  if (missing.length > 0) {
    throw new Error(missingColumnsMessage(missing));
  }
}

export function parseFixtureDate(value: string | number | Date): Date {
  if (value instanceof Date) {
    return value;
  }

  const text = String(value).trim();
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
  if (!match) {
    throw new Error(`Unsupported date value: ${text}`);
  }

  const [, day, month, year] = match;
  const monthIndex = MONTHS[month];
  if (monthIndex === undefined) {
    throw new Error(`Unsupported month value: ${month}`);
  }

  return new Date(Date.UTC(Number(year), monthIndex, Number(day)));
}

export function formatFixtureDate(value: string | number | Date): string {
  if (typeof value === "string") {
    return value.trim();
  }

  const date = parseFixtureDate(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = Object.entries(MONTHS).find(([, index]) => index === date.getUTCMonth())?.[0];
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

export function parseNumber(value: string | number | Date): number {
  if (value instanceof Date) {
    throw new Error("Date value cannot be parsed as a number.");
  }
  if (typeof value === "number") {
    return value;
  }
  return Number(value.replace(/,/g, "").trim());
}

export function parseInstrumentType(value: string | number | Date | undefined): InstrumentType {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "debt_mutual_fund" || text === "debt mutual fund" || text === "debt fund" || text === "debt") {
    return "debt_mutual_fund";
  }
  return "equity";
}

export type EditableTransactionFields = Pick<
  NormalizedTransaction,
  "scripName" | "purchaseDate" | "sellDate" | "units" | "buyValue" | "sellValue" | "buyPrice" | "sellPrice" | "instrumentType"
>;

/**
 * Recomputes holdPeriodDays/taxClass/gainLoss from the editable fields. Used
 * both when first parsing a document and when a user corrects a row during
 * the extraction review step, so a hand-edited row is classified exactly the
 * same way a freshly parsed one would be.
 */
export function deriveComputedFields(fields: EditableTransactionFields): NormalizedTransaction {
  const purchaseDate = parseFixtureDate(fields.purchaseDate);
  const sellDate = parseFixtureDate(fields.sellDate);
  const holdPeriodDays = Math.round((sellDate.getTime() - purchaseDate.getTime()) / 86_400_000);

  // Section 50AA specified (debt) mutual funds are always short-term-deemed,
  // regardless of holding period - see rules/capital-gains-mutual-funds.json.
  let taxClass: TaxClass;
  if (fields.instrumentType === "debt_mutual_fund") {
    taxClass = "ST";
  } else if (holdPeriodDays === 0) {
    taxClass = "Intraday";
  } else if (holdPeriodDays > 365) {
    taxClass = "LT";
  } else {
    taxClass = "ST";
  }

  return {
    ...fields,
    purchaseDate: formatFixtureDate(fields.purchaseDate),
    sellDate: formatFixtureDate(fields.sellDate),
    holdPeriodDays,
    taxClass,
    gainLoss: fields.sellValue - fields.buyValue
  };
}

export function normalizeRows(rows: RawTransactionRow[]): NormalizedTransaction[] {
  return rows.map((row) =>
    deriveComputedFields({
      scripName: String(row["Scrip Name"]).trim(),
      purchaseDate: formatFixtureDate(row["Purchase Date"]),
      sellDate: formatFixtureDate(row["Sell Date"]),
      units: parseNumber(row.Units),
      buyValue: parseNumber(row["Buy Value"]),
      sellValue: parseNumber(row["Sell Value"]),
      buyPrice: parseNumber(row["Buy Price"]),
      sellPrice: parseNumber(row["Sell Price"]),
      instrumentType: parseInstrumentType(row[OPTIONAL_INSTRUMENT_TYPE_COLUMN])
    })
  );
}

export function summarizeTransactions(transactions: NormalizedTransaction[]): TransactionSummary {
  return {
    rows: transactions.length,
    intradayGain: transactions
      .filter((transaction) => transaction.taxClass === "Intraday")
      .reduce((total, transaction) => total + transaction.gainLoss, 0),
    stcg: transactions
      .filter((transaction) => transaction.taxClass === "ST")
      .reduce((total, transaction) => total + transaction.gainLoss, 0),
    ltcg: transactions
      .filter((transaction) => transaction.taxClass === "LT")
      .reduce((total, transaction) => total + transaction.gainLoss, 0)
  };
}
