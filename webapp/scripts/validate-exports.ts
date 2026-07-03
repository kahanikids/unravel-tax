import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Papa from "papaparse";
import readWorkbook from "read-excel-file/universal";
import {
  buildCaSummaryCsvExport,
  buildCaSummaryWorkbookExport,
  buildFullWorkbookExport,
  caSummaryRows,
  rateInputsFromRule,
  type ExportState
} from "../src/lib";
import { calculationRows, fixtureTransactions } from "../src/demo/sampleState";
import { ruleCatalog } from "../src/rules";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const dryRunDir = resolve(repoRoot, "dry-runs", "m1c");

type ReferenceRow = {
  Head: string;
  Amount: string;
};

async function main() {
  const cgRule = ruleCatalog.capitalGainsEquity;
  const exportState: ExportState = {
    documents: [{ name: "sample-broker-statement.csv", transactions: fixtureTransactions }],
    caSummaryRows: calculationRows,
    rateInputs: rateInputsFromRule(cgRule),
    financialYear: `FY${cgRule.financial_year}`,
    assessmentYear: `AY${cgRule.assessment_year}`
  };

  const reference = await readM1Reference();
  const caCsv = await buildCaSummaryCsvExport(calculationRows);
  const caCsvRows = Papa.parse<ReferenceRow>(await caCsv.blob.text(), {
    header: true,
    skipEmptyLines: true
  });
  if (caCsvRows.errors.length > 0) {
    throw new Error(caCsvRows.errors.map((error) => error.message).join("; "));
  }
  assertAmountsMatch(reference, Object.fromEntries(caCsvRows.data.map((row) => [row.Head, normalizeAmount(row.Amount)])));

  const caWorkbook = await buildCaSummaryWorkbookExport(calculationRows);
  const caSheets = await readWorkbook(caWorkbook.blob);
  const caSheet = sheetData(caSheets, "Sheet1");
  assertAmountsMatch(reference, rowsToAmountMap(caSheet));

  const fullWorkbook = await buildFullWorkbookExport(exportState);
  const fullSheets = await readWorkbook(fullWorkbook.blob);
  const sheetNames = (fullSheets as Array<{ sheet: string }>).map((s) => s.sheet);
  for (const expectedSheet of ["sample-broker-statement", "Detailed Summary", "CA Summary"]) {
    if (!sheetNames.includes(expectedSheet)) {
      throw new Error(`Missing workbook sheet: ${expectedSheet}. Found: ${sheetNames.join(", ")}`);
    }
  }

  const brokerRows = sheetData(fullSheets, "sample-broker-statement");
  if (brokerRows.length !== fixtureTransactions.length + 4) {
    throw new Error(
      `Expected ${fixtureTransactions.length} broker data rows (plus title/header rows), found ${brokerRows.length}.`
    );
  }

  const detailedRows = sheetData(fullSheets, "Detailed Summary");
  if (detailedRows.length < 40) {
    throw new Error(`Detailed Summary sheet looks too short (${detailedRows.length} rows).`);
  }

  const linkedCa = sheetData(fullSheets, "CA Summary");
  const supplementalHeads = calculationRows
    .filter(
      (r) =>
        !r.head.includes("Speculative") &&
        !r.head.includes("Short-Term Capital") &&
        !r.head.includes("Long-Term Capital") &&
        !r.head.includes("Debt")
    )
    .map((r) => r.head);
  for (const head of supplementalHeads) {
    const row = linkedCa.find((r) => String(r[0]) === head);
    if (!row) {
      throw new Error(`CA Summary missing supplemental row: ${head}`);
    }
    const expected = calculationRows.find((r) => r.head === head)?.amount;
    const actual = normalizeAmount(row[2]);
    if (actual !== expected && String(actual) !== String(expected)) {
      throw new Error(`CA Summary mismatch for ${head}: ${actual} !== ${expected}`);
    }
  }

  console.log("Validated webapp exports: CA Summary CSV/XLSX and RKM-style full workbook structure.");
}

async function readM1Reference() {
  const csv = await readFile(resolve(dryRunDir, "UnravelTax-M1C-CA-Summary.csv"), "utf8");
  const parsed = Papa.parse<ReferenceRow>(csv, {
    header: true,
    skipEmptyLines: true
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }
  return Object.fromEntries(parsed.data.map((row) => [row.Head, normalizeAmount(row.Amount)]));
}

function assertAmountsMatch(reference: Record<string, string | number>, actual: Record<string, string | number>) {
  for (const key of [
    "Speculative / Intraday income",
    "Short-Term Capital Gains",
    "Long-Term Capital Gains",
    "Dividends",
    "Interest & other income",
    "Eligible interest deduction",
    "Deductible transaction charges",
    "Carry-forward losses available",
    "Recommended ITR form",
    "CA review recommendation"
  ]) {
    if (actual[key] !== reference[key]) {
      throw new Error(`Export mismatch for ${key}: ${actual[key]} !== ${reference[key]}`);
    }
  }
}

function rowsToAmountMap(rows: unknown[][]) {
  return Object.fromEntries(
    rows
      .filter((row) => row[0] && row[2] !== undefined && String(row[0]) !== "Head")
      .map((row) => [String(row[0]), normalizeAmount(row[2])])
  );
}

function sheetData(sheets: unknown, name: string) {
  const sheet = (sheets as Array<{ sheet: string; data: unknown[][] }>).find((item) => item.sheet === name);
  if (!sheet) {
    throw new Error(`Missing workbook sheet: ${name}`);
  }
  return sheet.data;
}

function normalizeAmount(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }
  const number = Number(value);
  return Number.isNaN(number) ? String(value) : number;
}

main();
