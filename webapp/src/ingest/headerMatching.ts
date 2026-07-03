import { EXPECTED_TRANSACTION_COLUMNS, OPTIONAL_INSTRUMENT_TYPE_COLUMN } from "./types";

export type CanonicalTransactionColumn =
  | (typeof EXPECTED_TRANSACTION_COLUMNS)[number]
  | typeof OPTIONAL_INSTRUMENT_TYPE_COLUMN;

/**
 * Real broker/AMC exports rarely use this exact wording. Each list covers the
 * synonyms, system field names, and rewordings we've actually seen, so a
 * column can be recognized even when it isn't spelled like
 * EXPECTED_TRANSACTION_COLUMNS. Keep entries lowercase and space-separated;
 * normalizeHeaderText() does the casing/punctuation work at match time.
 */
const HEADER_SYNONYMS: Record<CanonicalTransactionColumn, string[]> = {
  "Scrip Name": [
    "scrip",
    "scrip name",
    "security",
    "security name",
    "stock",
    "stock name",
    "symbol",
    "instrument",
    "instrument name",
    "company",
    "company name",
    "share name",
    "particulars",
    "isin"
  ],
  "Purchase Date": [
    "purchase date",
    "buy date",
    "acquisition date",
    "date of purchase",
    "date of acquisition",
    "purchased on",
    "trade date buy"
  ],
  "Sell Date": ["sell date", "sale date", "date of sale", "date of sell", "sold on", "trade date sell"],
  Units: ["units", "quantity", "qty", "no of units", "number of units", "shares", "no of shares"],
  "Buy Value": [
    "buy value",
    "purchase value",
    "purchase amount",
    "buy amount",
    "cost value",
    "cost of acquisition",
    "acquisition value",
    "total buy value",
    "purchase cost"
  ],
  "Sell Value": [
    "sell value",
    "sale value",
    "sale amount",
    "sell amount",
    "sale proceeds",
    "total sale value",
    "selling value",
    "sale consideration"
  ],
  "Buy Price": ["buy price", "purchase price", "purchase rate", "buy rate", "cost price", "buy nav", "buy rate per unit"],
  "Sell Price": ["sell price", "sale price", "sale rate", "sell rate", "selling price", "sell nav", "sell rate per unit"],
  "Instrument Type": ["instrument type", "asset type", "security type", "fund type", "category", "type"]
};

const ALL_COLUMNS: CanonicalTransactionColumn[] = [...EXPECTED_TRANSACTION_COLUMNS, OPTIONAL_INSTRUMENT_TYPE_COLUMN];

function normalizeHeaderText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Classic edit distance. Short and dependency-free; only used for the small typo-tolerance pass below. */
function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const distances: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let col = 1; col < cols; col += 1) {
    distances[0][col] = col;
  }
  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + cost
      );
    }
  }
  return distances[rows - 1][cols - 1];
}

function candidatesFor(column: CanonicalTransactionColumn): string[] {
  return [column, ...HEADER_SYNONYMS[column]].map(normalizeHeaderText);
}

export type HeaderResolution = {
  /** Raw header text -> canonical column name, for headers that were matched. */
  headerMap: Record<string, CanonicalTransactionColumn>;
  /** Required columns (EXPECTED_TRANSACTION_COLUMNS) that no header could be matched to. */
  missing: CanonicalTransactionColumn[];
};

/**
 * Matches a document's raw header row to the canonical transaction columns.
 * Runs three passes, cheapest and most confident first:
 *   1. Exact match (normalized) against the canonical name or a known synonym.
 *   2. Substring match, for headers with extra words like "Scrip Name (NSE)".
 *   3. Typo tolerance (small edit distance), for misspellings like "Purchse Date".
 * Deliberately stops here per ponytail: a value-shape fallback (e.g. "this
 * column parses as a date so it must be a date column") would add real
 * complexity for cases the synonym list doesn't already cover well.
 */
export function resolveTransactionHeaders(rawHeaders: string[]): HeaderResolution {
  const headerMap: Record<string, CanonicalTransactionColumn> = {};
  const matchedColumns = new Set<CanonicalTransactionColumn>();
  const unmatchedHeaders = () => rawHeaders.filter((header) => !(header in headerMap));

  for (const raw of unmatchedHeaders()) {
    const normalized = normalizeHeaderText(raw);
    const column = ALL_COLUMNS.find((candidate) => !matchedColumns.has(candidate) && candidatesFor(candidate).includes(normalized));
    if (column) {
      headerMap[raw] = column;
      matchedColumns.add(column);
    }
  }

  for (const raw of unmatchedHeaders()) {
    const normalized = normalizeHeaderText(raw);
    if (!normalized) continue;
    const column = ALL_COLUMNS.find(
      (candidate) =>
        !matchedColumns.has(candidate) &&
        candidatesFor(candidate).some((text) => normalized.includes(text) || text.includes(normalized))
    );
    if (column) {
      headerMap[raw] = column;
      matchedColumns.add(column);
    }
  }

  for (const raw of unmatchedHeaders()) {
    const normalized = normalizeHeaderText(raw);
    if (normalized.length < 3) continue;
    let bestColumn: CanonicalTransactionColumn | undefined;
    let bestDistance = Infinity;
    for (const candidate of ALL_COLUMNS) {
      if (matchedColumns.has(candidate)) continue;
      for (const text of candidatesFor(candidate)) {
        const distance = levenshteinDistance(normalized, text);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestColumn = candidate;
        }
      }
    }
    const tolerance = normalized.length <= 6 ? 1 : 2;
    if (bestColumn && bestDistance <= tolerance) {
      headerMap[raw] = bestColumn;
      matchedColumns.add(bestColumn);
    }
  }

  const missing = EXPECTED_TRANSACTION_COLUMNS.filter((column) => !matchedColumns.has(column));
  return { headerMap, missing };
}

export function missingColumnsMessage(missing: CanonicalTransactionColumn[]): string {
  return `Could not find a transaction table with the expected headers. Missing or unrecognized column(s): ${missing.join(", ")}. Check your document has a column for each of these (a similarly worded column name works too).`;
}

/** Renames each key in a raw record from its original header text to the matched canonical column, dropping unmatched columns. */
export function remapRecordKeys<T>(record: Record<string, T>, headerMap: Record<string, CanonicalTransactionColumn>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const [rawKey, value] of Object.entries(record)) {
    const canonical = headerMap[rawKey];
    if (canonical) {
      result[canonical] = value;
    }
  }
  return result;
}
