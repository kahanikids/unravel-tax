import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
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

  console.log(
    "Validated webapp ingestion: CSV, Excel, HTML, structured text match; PDF/free-form routes to prompt."
  );
}

main();
