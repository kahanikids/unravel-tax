/**
 * Deterministic cleanup for LLM extraction JSON before parseExtractionJson().
 * Fixes common model mistakes (string "null", broken-line date confusion) using
 * the source document text when available.
 */

const DATE_TOKEN =
  /\b(\d{1,2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/](\d{4})\b/gi;

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

const NOTES_MAX_LENGTH = 200;

export function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    return fenced[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text.trim();
}

function isNullishString(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "n/a";
}

function normalizeDateToken(day: string, month: string, year: string): string {
  const monthKey = month.slice(0, 3).toLowerCase();
  const monthIndex = MONTHS[monthKey];
  if (monthIndex === undefined) {
    return `${day.padStart(2, "0")}-${month}-${year}`;
  }
  const monthLabel = Object.keys(MONTHS).find((key) => MONTHS[key] === monthIndex) ?? monthKey;
  const monthFormatted = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  return `${String(Number(day)).padStart(2, "0")}-${monthFormatted}-${year}`;
}

export function parseExtractionDate(value: string): number {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) {
    return 0;
  }
  const month = MONTHS[match[2].toLowerCase()];
  if (month === undefined) {
    return 0;
  }
  return new Date(Number(match[3]), month, Number(match[1])).getTime();
}

function collectDatesInText(text: string): string[] {
  const normalized = text.replace(/(\d{1,2}-[A-Za-z]{3}-)\s+(\d{4})/g, "$1$2");
  const found: string[] = [];
  for (const match of normalized.matchAll(DATE_TOKEN)) {
    found.push(normalizeDateToken(match[1], match[2], match[3]));
  }
  return found;
}

function windowHasToken(window: string, value: number): boolean {
  return new RegExp(`\\b${value}\\b`).test(window);
}

function findDatesNearTransaction(
  sourceText: string,
  units: number,
  buyValue: number,
  sellValue: number
): string[] {
  const lines = sourceText.split(/\r?\n/);
  let best: { span: number; dates: string[] } | undefined;

  for (let start = 0; start < lines.length; start += 1) {
    for (let end = start; end < Math.min(start + 4, lines.length); end += 1) {
      const window = lines.slice(start, end + 1).join(" ");
      if (
        !windowHasToken(window, units) ||
        !windowHasToken(window, buyValue) ||
        !windowHasToken(window, sellValue)
      ) {
        continue;
      }
      const dates = [...new Set(collectDatesInText(window))];
      const span = end - start + 1;
      if (
        !best ||
        dates.length > best.dates.length ||
        (dates.length === best.dates.length && span < best.span)
      ) {
        best = { span, dates };
      }
    }
  }

  return best?.dates ?? [];
}

function assignPurchaseAndSellDates(dates: string[]): { purchaseDate?: string; sellDate?: string } {
  const unique = [...new Set(dates.filter(Boolean))];
  if (unique.length === 0) {
    return {};
  }
  const sorted = unique.sort((a, b) => parseExtractionDate(a) - parseExtractionDate(b));
  if (sorted.length === 1) {
    return { purchaseDate: sorted[0] };
  }
  return { purchaseDate: sorted[0], sellDate: sorted[sorted.length - 1] };
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const cleaned = value.replace(/[₹,\s]/g, "").replace(/[^0-9.-]/g, "");
  if (!cleaned) {
    return undefined;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : undefined;
}

type RawTransaction = Record<string, unknown>;

function sanitizeTransactionField(value: unknown): unknown {
  if (isNullishString(value)) {
    return null;
  }
  return value;
}

function repairTransactionDates(transaction: RawTransaction, sourceText: string): RawTransaction {
  const units = coerceNumber(transaction.units);
  const buyValue = coerceNumber(transaction.buyValue);
  const sellValue = coerceNumber(transaction.sellValue);
  if (units === undefined || buyValue === undefined || sellValue === undefined) {
    return transaction;
  }

  const nearbyDates = findDatesNearTransaction(sourceText, units, buyValue, sellValue);
  if (nearbyDates.length === 0) {
    return transaction;
  }

  const assigned = assignPurchaseAndSellDates(nearbyDates);
  let nextPurchase = isNullishString(transaction.purchaseDate)
    ? ""
    : String(transaction.purchaseDate).trim();
  let nextSell = isNullishString(transaction.sellDate) ? "" : String(transaction.sellDate).trim();
  const canonicalPurchase = nextPurchase
    ? normalizeDateTokenFromCanonical(nextPurchase)
    : "";

  if (
    !nextSell &&
    canonicalPurchase &&
    nearbyDates.length === 2 &&
    nearbyDates.includes(canonicalPurchase)
  ) {
    const otherDate = nearbyDates.find((date) => date !== canonicalPurchase);
    if (otherDate) {
      return {
        ...transaction,
        purchaseDate: otherDate,
        sellDate: canonicalPurchase
      };
    }
  }

  if (nearbyDates.length >= 2 && !nextSell) {
    return {
      ...transaction,
      purchaseDate: assigned.purchaseDate ?? (nextPurchase || null),
      sellDate: assigned.sellDate ?? null
    };
  }

  if (
    nextPurchase &&
    nextSell &&
    parseExtractionDate(nextPurchase) > parseExtractionDate(nextSell)
  ) {
    [nextPurchase, nextSell] = [nextSell, nextPurchase];
  }

  if (!nextPurchase && assigned.purchaseDate) {
    nextPurchase = assigned.purchaseDate;
  }
  if (!nextSell && assigned.sellDate) {
    nextSell = assigned.sellDate;
  }

  return {
    ...transaction,
    purchaseDate: nextPurchase || null,
    sellDate: nextSell || null
  };
}

function normalizeDateTokenFromCanonical(value: string): string {
  const match = value.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) {
    return value.trim();
  }
  return normalizeDateToken(match[1], match[2], match[3]);
}

function sanitizeExtractionObject(data: Record<string, unknown>, sourceText?: string): Record<string, unknown> {
  const rawTransactions = Array.isArray(data.capitalGainsTransactions)
    ? data.capitalGainsTransactions
    : [];

  const capitalGainsTransactions = rawTransactions.map((item) => {
    if (typeof item !== "object" || item === null) {
      return item;
    }
    const transaction = item as RawTransaction;
    const sanitized: RawTransaction = {
      ...transaction,
      scripName: sanitizeTransactionField(transaction.scripName),
      purchaseDate: sanitizeTransactionField(transaction.purchaseDate),
      sellDate: sanitizeTransactionField(transaction.sellDate),
      buyPrice: sanitizeTransactionField(transaction.buyPrice),
      sellPrice: sanitizeTransactionField(transaction.sellPrice),
      instrumentType: sanitizeTransactionField(transaction.instrumentType)
    };
    return sourceText ? repairTransactionDates(sanitized, sourceText) : sanitized;
  });

  let notes = data.notes;
  if (typeof notes === "string" && notes.length > NOTES_MAX_LENGTH) {
    notes = `${notes.slice(0, NOTES_MAX_LENGTH - 1).trim()}…`;
  }

  return {
    ...data,
    capitalGainsTransactions,
    notes
  };
}

/** Cleans raw LLM output (optionally using source text) and returns JSON text for parseExtractionJson(). */
export function postProcessExtractionRaw(rawText: string, sourceText?: string): string {
  const jsonText = extractJsonBlock(rawText);
  let data: unknown;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return jsonText;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return jsonText;
  }
  return JSON.stringify(sanitizeExtractionObject(data as Record<string, unknown>, sourceText));
}
