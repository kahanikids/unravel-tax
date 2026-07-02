import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Papa from "papaparse";
import readWorkbook from "read-excel-file/universal";
import {
  buildCaSummaryCsvExport,
  buildCaSummaryWorkbookExport,
  buildFullWorkbookExport,
  caSummaryRows,
  type ExportState
} from "../src/lib";
import {
  calculationRows,
  calculationSummary,
  checksReport,
  checklistItems,
  fixtureTransactions,
  tdsRows
} from "../src/demo/sampleState";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const dryRunDir = resolve(repoRoot, "dry-runs", "m1c");

type ReferenceRow = {
  Head: string;
  Amount: string;
};

async function main() {
  const exportState: ExportState = {
    caSummaryRows: calculationRows,
    transactions: fixtureTransactions,
    calculationSummary,
    checklistItems,
    tdsRows,
    openIssueCount: checksReport.missingDocuments.length + checksReport.mismatches.length
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
  for (const expectedSheet of [
    "CA Summary",
    "Transactions",
    "Detailed Summary",
    "Checklist State",
    "TDS Reconciliation",
    "Manifest"
  ]) {
    sheetData(fullSheets, expectedSheet);
  }

  const transactionRows = sheetData(fullSheets, "Transactions");
  if (transactionRows.length !== fixtureTransactions.length + 1) {
    throw new Error(`Expected ${fixtureTransactions.length} transaction rows, found ${transactionRows.length - 1}.`);
  }
  assertAmountsMatch(reference, rowsToAmountMap(sheetData(fullSheets, "CA Summary")));

  console.log("Validated webapp exports: CA Summary CSV/XLSX and full workbook match fixture expectations.");
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
  return Object.fromEntries(rows.slice(1).map((row) => [String(row[0]), normalizeAmount(row[2])]));
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
