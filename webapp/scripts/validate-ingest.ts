import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readSheet } from "read-excel-file/universal";
import {
  deriveComputedFields,
  findHeaderRowIndex,
  parseCsvText,
  parseExcelBuffer,
  parseHtmlText,
  parsePastedExtraction,
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

  // Multi-sheet workbook: sheet 1 is a summary/disclaimer page; the real
  // transaction table lives on sheet 2 and must still be found.
  const multiSheetBuffer = await readFile(resolve(fixturesDir, "sample-broker-statement-multi-sheet.xlsx"));
  const multiSheet = await parseExcelBuffer(
    multiSheetBuffer.buffer.slice(multiSheetBuffer.byteOffset, multiSheetBuffer.byteOffset + multiSheetBuffer.byteLength)
  );
  if (JSON.stringify(comparableRows(multiSheet)) !== JSON.stringify(baseline)) {
    throw new Error("Multi-sheet Excel fixture did not resolve to the baseline transactions from its Equity sheet.");
  }
  if (!multiSheet.warnings.some((warning) => warning.message.includes('read "Equity"'))) {
    throw new Error("Multi-sheet Excel fixture should note which sheet was read.");
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

  // The extraction prompt now returns one standardised JSON object. A JSON paste
  // with transaction rows must map onto the same NormalizedTransaction shape as
  // every other format (dates classified, gain/loss computed). Synthetic values
  // only (111/222 style), tolerant of ₹/commas in numeric strings - never real data.
  const jsonWithTransactions = parsePastedExtraction(
    JSON.stringify({
      documentType: "broker capital gains statement",
      capitalGainsTransactions: [
        {
          scripName: "Dummy Equity Ltd",
          purchaseDate: "01-Apr-2024",
          sellDate: "01-Aug-2024",
          units: 10,
          buyValue: "₹1,110",
          sellValue: 2220,
          buyPrice: 111,
          sellPrice: 222
        }
      ],
      confidence: "high",
      notes: "One synthetic transaction."
    })
  );
  if (jsonWithTransactions.transactions.length !== 1) {
    throw new Error("JSON paste with one transaction should map to exactly one NormalizedTransaction.");
  }
  const jsonTx = jsonWithTransactions.transactions[0];
  if (jsonTx.scripName !== "Dummy Equity Ltd" || jsonTx.gainLoss !== 1110 || jsonTx.taxClass !== "ST") {
    throw new Error(`JSON transaction did not normalize as expected: ${JSON.stringify(jsonTx)}`);
  }
  if (jsonWithTransactions.documentType !== "broker capital gains statement") {
    throw new Error("JSON paste should surface documentType.");
  }
  if (jsonWithTransactions.netGainOnly) {
    throw new Error("A JSON paste with real transaction rows should not be flagged net-gain-only.");
  }

  // A summary-only / net-gain-only JSON paste (PMS annual report shape): empty
  // transactions plus annualFigures and a net realised gain with no per-trade detail.
  const jsonSummaryOnly = parsePastedExtraction(
    JSON.stringify({
      documentType: "PMS annual report",
      capitalGainsTransactions: [],
      annualFigures: {
        dividendIncome: "₹1,111",
        interestIncome: null,
        tdsDeducted: 222,
        deductibleCharges: 333
      },
      netRealisedCapitalGainNoDetail: "4,444",
      confidence: "medium",
      notes: "Only a net realised gain is stated; detailed per-transaction statement needed."
    })
  );
  if (jsonSummaryOnly.transactions.length !== 0) {
    throw new Error("Summary-only JSON paste should not produce any transaction rows.");
  }
  const sf = jsonSummaryOnly.summaryFigures;
  if (!sf) {
    throw new Error("Summary-only JSON paste should recognise annualFigures.");
  }
  if (sf.dividendIncome !== 1111 || sf.tdsDeducted !== 222 || sf.deductibleCharges !== 333 || sf.netRealisedGainNoDetail !== 4444) {
    throw new Error(`Unexpected recognised summary figures: ${JSON.stringify(sf)}`);
  }
  if (sf.interestIncome !== undefined) {
    throw new Error("A null annual figure should be left unrecognised, not parsed as a figure.");
  }
  if (jsonSummaryOnly.netGainOnly !== true) {
    throw new Error("A net-realised-gain-only JSON paste with no rows should set netGainOnly.");
  }

  // Indian-grouped INR amounts (lakh-style "1,23,456" grouping, ₹ sign, and
  // decimals) must parse to their full value, not truncate at the first comma.
  // Synthetic figures only. This is a real correctness bug guard for INR.
  const indianGrouped = parsePastedExtraction(
    JSON.stringify({
      documentType: "PMS annual report",
      capitalGainsTransactions: [],
      annualFigures: {
        dividendIncome: "₹1,23,456.78",
        interestIncome: "₹4,459.5",
        tdsDeducted: "₹83,493.85",
        deductibleCharges: "₹1,37,827.48"
      }
    })
  );
  const grouped = indianGrouped.summaryFigures;
  if (!grouped) {
    throw new Error("Indian-grouped annualFigures should be recognised.");
  }
  if (grouped.dividendIncome !== 123456.78) {
    throw new Error(`"₹1,23,456.78" should parse to 123456.78, got ${grouped.dividendIncome}.`);
  }
  if (grouped.interestIncome !== 4459.5) {
    throw new Error(`"₹4,459.5" should parse to 4459.5, got ${grouped.interestIncome}.`);
  }
  if (grouped.tdsDeducted !== 83493.85) {
    throw new Error(`"₹83,493.85" should parse to 83493.85, got ${grouped.tdsDeducted}.`);
  }
  if (grouped.deductibleCharges !== 137827.48) {
    throw new Error(`"₹1,37,827.48" should parse to 137827.48 (not truncated at the first comma), got ${grouped.deductibleCharges}.`);
  }

  // Invalid JSON must not dead-end silently: it comes back with a plain-language
  // parse_error telling the user to paste the whole JSON block.
  const brokenJson = parsePastedExtraction("{ not valid json");
  if (brokenJson.transactions.length !== 0 || !brokenJson.warnings.some((w) => w.code === "parse_error")) {
    throw new Error("Invalid JSON paste should surface a parse_error, not transactions.");
  }

  // The markdown-table fallback must still work for a hand-pasted table.
  const tableFallback = parsePastedExtraction(
    [
      "Scrip Name | Purchase Date | Sell Date | Units | Buy Value | Sell Value | Buy Price | Sell Price",
      "Dummy Equity Ltd | 01-Apr-2024 | 01-Aug-2024 | 10 | 1110 | 2220 | 111 | 222"
    ].join("\n")
  );
  if (tableFallback.transactions.length !== 1 || tableFallback.transactions[0].gainLoss !== 1110) {
    throw new Error("Markdown-table fallback should still parse a pasted table into one transaction.");
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
    "Validated webapp ingestion: CSV, Excel, HTML, structured text match; fuzzy/alt-date headers parse; missing columns warn + route; PDF/free-form routes to prompt; JSON extraction paste maps transactions + recognises annual figures (incl. Indian lakh-grouped ₹ amounts) + flags net-gain-only + errors on invalid JSON, markdown-table fallback still parses; edited rows reclassify correctly."
  );
}

main();
