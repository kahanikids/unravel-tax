import {
  OPTIONAL_INSTRUMENT_TYPE_COLUMN,
  type IngestWarning,
  type InstrumentType,
  type NormalizedTransaction,
  type RawTransactionRow,
  type TaxClass,
  type TransactionSummary
} from "./types";
import { ruleCatalog } from "../rules";

// Sourced from rules/capital-gains-equity.json, never hardcoded here, so a
// listed-equity holding-period change lands in one place (the rule file) and
// row editing classifies exactly the same way as summarizeWithRules().
const LONG_TERM_HOLDING_DAYS_GT =
  ruleCatalog.capitalGainsEquity.values.listed_equity.long_term_holding_period_days_gt;

export type EditableTransactionFields = Pick<
  NormalizedTransaction,
  | "scripName"
  | "purchaseDate"
  | "sellDate"
  | "units"
  | "buyValue"
  | "sellValue"
  | "buyPrice"
  | "sellPrice"
  | "instrumentType"
>;

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

const MONTH_NAMES = Object.keys(MONTHS);

export function parseFixtureDate(value: string | number | Date): Date {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number" && value > 0 && value < 100_000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86_400_000);
  }

  const text = String(value).trim();
  const dmyMatch = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(text);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const monthIndex = MONTHS[month];
    if (monthIndex === undefined) {
      throw new Error(`Unsupported month value: ${month}`);
    }
    return new Date(Date.UTC(Number(year), monthIndex, Number(day)));
  }

  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  throw new Error(`Unsupported date value: ${text}`);
}

export function parseDateSoft(
  value: string | number | Date,
  rowIndex: number,
  column: string
): { text: string; warning?: IngestWarning } {
  try {
    const date = parseFixtureDate(value);
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = MONTH_NAMES.find((name) => MONTHS[name] === date.getUTCMonth()) ?? "Jan";
    return { text: `${day}-${month}-${date.getUTCFullYear()}` };
  } catch {
    const text = String(value).trim();
    if (!text) {
      return {
        text: "",
        warning: {
          code: "invalid_date",
          message: `Row ${rowIndex + 1}, ${column}: date is empty.`,
          rowIndex,
          column
        }
      };
    }
    return {
      text,
      warning: {
        code: "invalid_date",
        message: `Row ${rowIndex + 1}, ${column}: "${text}" is not a recognised date format.`,
        rowIndex,
        column
      }
    };
  }
}

export function formatFixtureDate(value: string | number | Date): string {
  if (typeof value === "string") {
    return value.trim();
  }

  const date = parseFixtureDate(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTH_NAMES.find((name) => MONTHS[name] === date.getUTCMonth());
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

export function parseNumber(value: string | number | Date): number {
  if (value instanceof Date) {
    throw new Error("Date value cannot be parsed as a number.");
  }
  if (typeof value === "number") {
    return value;
  }
  const cleaned = value.replace(/[₹,\s]/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned.toLowerCase() === "n/a") {
    return NaN;
  }
  // Broker statements often write losses in accounting style: (1,234.56).
  const parenMatch = /^\((.+)\)$/.exec(cleaned);
  if (parenMatch) {
    const inner = Number(parenMatch[1]);
    return Number.isNaN(inner) ? NaN : -inner;
  }
  return Number(cleaned);
}

export function parseNumberSoft(
  value: string | number | Date,
  rowIndex: number,
  column: string
): { number: number; userWarning?: IngestWarning } {
  try {
    const number = parseNumber(value);
    if (Number.isNaN(number)) {
      return {
        number: 0,
        userWarning: {
          code: "invalid_number",
          message: `Row ${rowIndex + 1}, ${column}: "${String(value)}" is not a valid number.`,
          rowIndex,
          column
        }
      };
    }
    return { number };
  } catch {
    return {
      number: 0,
      userWarning: {
        code: "invalid_number",
        message: `Row ${rowIndex + 1}, ${column}: could not read as a number.`,
        rowIndex,
        column
      }
    };
  }
}

export function parseInstrumentType(value: string | number | Date | undefined): InstrumentType {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    text === "debt_mutual_fund" ||
    text === "debt mutual fund" ||
    text === "debt fund" ||
    text === "debt"
  ) {
    return "debt_mutual_fund";
  }
  if (
    text === "listed_equity" ||
    text === "listed equity" ||
    text === "listed" ||
    text === "listed_shares" ||
    text === "listed shares"
  ) {
    return "listed_equity";
  }
  if (
    text === "unlisted_equity" ||
    text === "unlisted equity" ||
    text === "unlisted" ||
    text === "unlisted_shares" ||
    text === "unlisted shares"
  ) {
    return "unlisted_equity";
  }
  if (
    text === "equity_mutual_fund" ||
    text === "equity mutual fund" ||
    text === "equity_mf" ||
    text === "equity mf" ||
    text === "mutual fund" ||
    text === "mutual_fund" ||
    text === "mf"
  ) {
    return "equity_mutual_fund";
  }
  if (text === "other") {
    return "other";
  }
  return "equity";
}

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

  let taxClass: TaxClass;
  if (fields.instrumentType === "debt_mutual_fund") {
    taxClass = "ST";
  } else if (holdPeriodDays === 0) {
    taxClass = "Intraday";
  } else {
    const threshold = fields.instrumentType === "unlisted_equity" ? 730 : LONG_TERM_HOLDING_DAYS_GT;
    if (holdPeriodDays > threshold) {
      taxClass = "LT";
    } else {
      taxClass = "ST";
    }
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

function parseRowSoft(
  row: RawTransactionRow,
  rowIndex: number
): { fields: EditableTransactionFields; warnings: IngestWarning[] } {
  const warnings: IngestWarning[] = [];
  const purchase = parseDateSoft(row["Purchase Date"], rowIndex, "Purchase Date");
  const sell = parseDateSoft(row["Sell Date"], rowIndex, "Sell Date");
  if (purchase.warning) warnings.push(purchase.warning);
  if (sell.warning) warnings.push(sell.warning);

  const units = parseNumberSoft(row.Units, rowIndex, "Units");
  const buyValue = parseNumberSoft(row["Buy Value"], rowIndex, "Buy Value");
  const sellValue = parseNumberSoft(row["Sell Value"], rowIndex, "Sell Value");
  const buyPrice = parseNumberSoft(row["Buy Price"], rowIndex, "Buy Price");
  const sellPrice = parseNumberSoft(row["Sell Price"], rowIndex, "Sell Price");
  for (const w of [units, buyValue, sellValue, buyPrice, sellPrice]) {
    if (w.userWarning) warnings.push(w.userWarning);
  }

  const instrumentType = parseInstrumentType(row[OPTIONAL_INSTRUMENT_TYPE_COLUMN]);

  return {
    fields: {
      scripName: String(row["Scrip Name"] ?? "").trim(),
      purchaseDate: purchase.text,
      sellDate: sell.text,
      units: units.number,
      buyValue: buyValue.number,
      sellValue: sellValue.number,
      buyPrice: buyPrice.number,
      sellPrice: sellPrice.number,
      instrumentType
    },
    warnings
  };
}

export type NormalizeRowInput = {
  row: RawTransactionRow;
  brokerColumns?: Record<string, string | number>;
};

export function normalizeRows(rows: RawTransactionRow[]): NormalizedTransaction[] {
  return normalizeRowsSoft(rows.map((row) => ({ row }))).transactions;
}

export function normalizeRowsSoft(inputs: NormalizeRowInput[] | RawTransactionRow[]): {
  transactions: NormalizedTransaction[];
  warnings: IngestWarning[];
} {
  const transactions: NormalizedTransaction[] = [];
  const warnings: IngestWarning[] = [];
  const normalizedInputs: NormalizeRowInput[] =
    inputs.length > 0 && "row" in (inputs[0] as NormalizeRowInput)
      ? (inputs as NormalizeRowInput[])
      : (inputs as RawTransactionRow[]).map((row) => ({ row }));

  normalizedInputs.forEach(({ row, brokerColumns }, rowIndex) => {
    const { fields, warnings: rowWarnings } = parseRowSoft(row, rowIndex);
    warnings.push(...rowWarnings);
    try {
      const transaction = deriveComputedFields(fields);
      if (brokerColumns && Object.keys(brokerColumns).length > 0) {
        transaction.brokerColumns = brokerColumns;
      }
      transactions.push(transaction);
    } catch {
      warnings.push({
        code: "invalid_date",
        message: `Row ${rowIndex + 1}: could not compute tax class. Check dates.`,
        rowIndex
      });
    }
  });

  return { transactions, warnings };
}

export function summarizeTransactions(transactions: NormalizedTransaction[]): TransactionSummary {
  let intradayGain = 0;
  let stcg = 0;
  let ltcg = 0;
  for (const transaction of transactions) {
    if (transaction.taxClass === "Intraday") intradayGain += transaction.gainLoss;
    else if (transaction.taxClass === "ST") stcg += transaction.gainLoss;
    else ltcg += transaction.gainLoss;
  }
  return { rows: transactions.length, intradayGain, stcg, ltcg };
}
