import {
  EXPECTED_TRANSACTION_COLUMNS,
  type NormalizedTransaction,
  type RawTransactionRow,
  type TaxClass,
  type TransactionSummary
} from "./types";

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

export function assertTransactionColumns(headers: string[]): void {
  const missing = EXPECTED_TRANSACTION_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new Error(`Missing transaction column(s): ${missing.join(", ")}`);
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

export function normalizeRows(rows: RawTransactionRow[]): NormalizedTransaction[] {
  return rows.map((row) => {
    const purchaseDate = parseFixtureDate(row["Purchase Date"]);
    const sellDate = parseFixtureDate(row["Sell Date"]);
    const holdPeriodDays = Math.round((sellDate.getTime() - purchaseDate.getTime()) / 86_400_000);
    let taxClass: TaxClass = "ST";
    if (holdPeriodDays === 0) {
      taxClass = "Intraday";
    } else if (holdPeriodDays > 365) {
      taxClass = "LT";
    }

    const buyValue = parseNumber(row["Buy Value"]);
    const sellValue = parseNumber(row["Sell Value"]);

    return {
      scripName: String(row["Scrip Name"]).trim(),
      purchaseDate: formatFixtureDate(row["Purchase Date"]),
      sellDate: formatFixtureDate(row["Sell Date"]),
      units: parseNumber(row.Units),
      buyValue,
      sellValue,
      buyPrice: parseNumber(row["Buy Price"]),
      sellPrice: parseNumber(row["Sell Price"]),
      holdPeriodDays,
      taxClass,
      gainLoss: sellValue - buyValue
    };
  });
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
