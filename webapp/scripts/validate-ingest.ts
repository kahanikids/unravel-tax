import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  deriveComputedFields,
  parseCsvText,
  parseExcelBuffer,
  parseHtmlText,
  parseTextSource,
  parseStructuredText,
  type NormalizedTransaction,
  type ParsedTransactionSource
} from "../src/ingest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const fixturesDir = resolve(repoRoot, "fixtures");

function comparableRows(result: ParsedTransactionSource): string[] {
  return result.transactions.map((transaction: NormalizedTransaction) =>
    [
      transaction.scripName,
      transaction.purchaseDate,
      transaction.sellDate,
      transaction.units,
      transaction.buyValue,
      transaction.sellValue,
      transaction.buyPrice,
      transaction.sellPrice,
      transaction.holdPeriodDays,
      transaction.taxClass,
      transaction.gainLoss
    ].join("|")
  );
}

async function main() {
  const csv = parseCsvText(await readFile(resolve(fixturesDir, "sample-broker-statement.csv"), "utf8"));
  const structuredText = parseStructuredText(
    await readFile(resolve(fixturesDir, "sample-broker-statement.tsv"), "utf8")
  );
  const html = parseHtmlText(await readFile(resolve(fixturesDir, "sample-broker-statement.html"), "utf8"));
  const excelBuffer = await readFile(resolve(fixturesDir, "sample-broker-statement.xlsx"));
  const excel = await parseExcelBuffer(
    excelBuffer.buffer.slice(excelBuffer.byteOffset, excelBuffer.byteOffset + excelBuffer.byteLength)
  );

  const baseline = comparableRows(csv);
  for (const result of [structuredText, html, excel]) {
    const rows = comparableRows(result);
    if (JSON.stringify(rows) !== JSON.stringify(baseline)) {
      throw new Error(`${result.kind} fixture does not match CSV baseline.`);
    }
  }

  // Fuzzy header matching: real broker exports rename, reorder, and sometimes
  // misspell these columns. This fixture uses synonyms ("Security Name" for
  // "Scrip Name", "Qty" for "Units"), reordered columns, extra whitespace
  // ("BUY  RATE"), and one deliberate typo ("Purchse Date"), and must still
  // resolve to the exact same transactions as the exact-header baseline.
  const fuzzyHeaders = parseCsvText(
    await readFile(resolve(fixturesDir, "sample-broker-statement-fuzzy-headers.csv"), "utf8")
  );
  if (JSON.stringify(comparableRows(fuzzyHeaders)) !== JSON.stringify(baseline)) {
    throw new Error("Fuzzy-header CSV fixture did not resolve to the same transactions as the exact-header baseline.");
  }

  // A document genuinely missing a required column (here, no Sell Price/Sale
  // Rate equivalent at all) must fail gracefully and name the missing field,
  // not just report a generic "expected headers" error.
  const missingColumnText = await readFile(resolve(fixturesDir, "sample-broker-statement-missing-column.csv"), "utf8");
  let missingColumnError: string | undefined;
  try {
    parseCsvText(missingColumnText);
  } catch (error) {
    missingColumnError = error instanceof Error ? error.message : String(error);
  }
  if (!missingColumnError || !missingColumnError.includes("Sell Price")) {
    throw new Error(
      `Expected a missing-column error naming "Sell Price", got: ${missingColumnError ?? "no error thrown"}`
    );
  }

  const pdfRoute = parseTextSource(
    "sample-pdf-extracted-text.txt",
    await readFile(resolve(fixturesDir, "sample-pdf-extracted-text.txt"), "utf8"),
    "text/plain"
  );
  if (
    pdfRoute.kind !== "pdf_or_freeform" ||
    pdfRoute.route !== "guided_prompt" ||
    pdfRoute.prompt !== "prompts/01-extract-statement.md"
  ) {
    throw new Error("PDF/free-form fixture did not route to the guided extraction prompt.");
  }

  if (csv.summary.rows !== 5 || csv.summary.intradayGain !== 800 || csv.summary.stcg !== -500 || csv.summary.ltcg !== 5500) {
    throw new Error(`Unexpected CSV summary: ${JSON.stringify(csv.summary)}`);
  }

  // Editable extraction review: hand-editing a row's fields must reclassify
  // it exactly like a freshly parsed one, not just patch the field in place.
  const original = csv.transactions[0];
  const stretchedToLongTerm = deriveComputedFields({ ...original, sellDate: "20-Jun-2026" });
  if (stretchedToLongTerm.taxClass !== "LT" || stretchedToLongTerm.holdPeriodDays <= 365) {
    throw new Error("Editing a row's sell date past 365 days should reclassify it as long-term.");
  }
  const correctedValues = deriveComputedFields({ ...original, buyValue: 1000, sellValue: 1500 });
  if (correctedValues.gainLoss !== 500) {
    throw new Error("Editing buy/sell value should recompute gain/loss, not keep the original figure.");
  }

  console.log(
    "Validated webapp ingestion: CSV, Excel, HTML, structured text match; PDF/free-form routes to prompt; edited rows reclassify correctly."
  );
}

main();
