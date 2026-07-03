import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readSheet } from "read-excel-file/universal";
import {
  deriveComputedFields,
  findHeaderRowIndex,
  parseCsvText,
  parseExcelBuffer,
  parseHtmlText,
  parseTextSource,
  parseStructuredText,
  type IngestResult,
  type NormalizedTransaction
} from "../src/ingest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const fixturesDir = resolve(repoRoot, "fixtures");

function comparableRows(result: IngestResult): string[] {
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

  const fuzzyHeaders = parseCsvText(
    await readFile(resolve(fixturesDir, "sample-broker-statement-fuzzy-headers.csv"), "utf8")
  );
  if (JSON.stringify(comparableRows(fuzzyHeaders)) !== JSON.stringify(baseline)) {
    throw new Error("Fuzzy-header CSV fixture did not resolve to the same transactions as the exact-header baseline.");
  }

  const altDates = parseCsvText(
    await readFile(resolve(fixturesDir, "sample-broker-statement-alt-dates.csv"), "utf8")
  );
  if (JSON.stringify(comparableRows(altDates)) !== JSON.stringify(baseline)) {
    throw new Error("DD/MM/YYYY date fixture did not resolve to the same transactions as the baseline.");
  }

  // CMOTS/ABML-style HTML: group-banner header row above the real column names,
  // duplicate Buy Value/Realized Gain columns, and a blank-scrip subtotal row.
  const groupedHeader = parseHtmlText(
    await readFile(resolve(fixturesDir, "sample-broker-statement-grouped-header.html"), "utf8")
  );
  if (JSON.stringify(comparableRows(groupedHeader)) !== JSON.stringify(baseline)) {
    throw new Error(
      `Grouped-header HTML fixture did not resolve to the baseline transactions. Got ${groupedHeader.transactions.length} rows: ${JSON.stringify(comparableRows(groupedHeader))}`
    );
  }

  const missingColumn = parseCsvText(
    await readFile(resolve(fixturesDir, "sample-broker-statement-missing-column.csv"), "utf8")
  );
  if (missingColumn.transactions.length !== 0) {
    throw new Error("Missing-column fixture should not produce transactions until columns are mapped.");
  }
  if (!missingColumn.promptRoute || missingColumn.promptRoute.route !== "guided_prompt") {
    throw new Error("Missing-column fixture should route to the guided extraction prompt.");
  }
  if (!missingColumn.warnings.some((warning) => warning.code === "missing_column" && warning.message.includes("Sell Price"))) {
    throw new Error('Missing-column fixture should warn about "Sell Price".');
  }
  if (missingColumn.sourceHeaders.length === 0) {
    throw new Error("Missing-column fixture should keep source headers for manual column mapping.");
  }

  const pdfRoute = parseTextSource(
    "sample-pdf-extracted-text.txt",
    await readFile(resolve(fixturesDir, "sample-pdf-extracted-text.txt"), "utf8"),
    "text/plain"
  );
  if (
    pdfRoute.promptRoute?.route !== "guided_prompt" ||
    pdfRoute.promptRoute.prompt !== "prompts/01-extract-statement.md"
  ) {
    throw new Error("PDF/free-form fixture did not route to the guided extraction prompt.");
  }

  const excelRows = (await readSheet(new Blob([excelBuffer]))) as (string | number | Date | boolean | null)[][];
  const headerIndex = findHeaderRowIndex(excelRows);
  if (headerIndex !== 0) {
    throw new Error(`Expected Excel header row at index 0 for the baseline fixture, got ${headerIndex}.`);
  }

  const promptTxt = await readFile(resolve(import.meta.dirname, "..", "public", "extraction-prompt.txt"), "utf8");
  const canonicalPrompt = await readFile(resolve(repoRoot, "prompts", "01-extract-statement.md"), "utf8");
  if (promptTxt.trim() !== canonicalPrompt.trim()) {
    throw new Error("webapp/public/extraction-prompt.txt is out of sync with prompts/01-extract-statement.md.");
  }

  if (csv.summary.rows !== 5 || csv.summary.intradayGain !== 800 || csv.summary.stcg !== -500 || csv.summary.ltcg !== 5500) {
    throw new Error(`Unexpected CSV summary: ${JSON.stringify(csv.summary)}`);
  }

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
    "Validated webapp ingestion: CSV, Excel, HTML, structured text match; fuzzy/alt-date headers parse; missing columns warn + route; PDF/free-form routes to prompt; edited rows reclassify correctly."
  );
}

main();
