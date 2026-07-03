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
  // Requested order: (1) CA Summary, (2) Detailed Summary, then one sheet per raw file.
  if (sheetNames[0] !== "CA Summary" || sheetNames[1] !== "Detailed Summary") {
    throw new Error(`Full workbook must start with CA Summary then Detailed Summary. Found: ${sheetNames.join(", ")}`);
  }
  if (sheetNames[2] !== "sample-broker-statement") {
    throw new Error(`Raw file sheet should follow the two summaries. Found: ${sheetNames.join(", ")}`);
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
  const assetClassHeader = detailedRows.find((row) => String(row[0]) === "Asset Class");
  if (!assetClassHeader) {
    throw new Error("Detailed Summary should have the asset-class table header row.");
  }
  for (const expectedColumn of ["Total Sale Value", "Total Cost", "Broker-reported", "Variance"]) {
    if (!assetClassHeader.some((cell) => String(cell).includes(expectedColumn))) {
      throw new Error(`Detailed Summary asset-class table missing column: ${expectedColumn}`);
    }
  }

  const linkedCa = sheetData(fullSheets, "CA Summary");

  // The Totals & check section links to the Detailed Summary's Sale/Cost
  // columns by formula (no literal values), so assert presence, not amounts.
  for (const totalsHead of [
    "Total sale value (all documents)",
    "Total cost of purchase (all documents)",
    "Combined gain/(loss) — sale minus cost"
  ]) {
    if (!linkedCa.some((r) => String(r[0]) === totalsHead)) {
      throw new Error(`CA Summary missing totals/check row: ${totalsHead}`);
    }
  }

  const supplementalHeads = calculationRows
    .filter(
      (r) =>
        !r.head.includes("Speculative") &&
        !r.head.includes("Short-Term Capital") &&
        !r.head.includes("Long-Term Capital") &&
        !r.head.includes("Debt") &&
        r.ruleSection !== "Totals"
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

  // Multiple raw files: two capital-gains statements plus a bank-interest
  // statement kept as a reference sheet. Each should get its own sheet, in
  // upload order, after CA Summary + Detailed Summary, with short/unique/legal
  // names (Excel caps sheet names at 31 chars and forbids : \ / ? * [ ]).
  const multiFileState: ExportState = {
    ...exportState,
    documents: [
      { name: "sample-broker-statement.csv", transactions: fixtureTransactions },
      { name: "another-really-long-broker-statement-name-2025.xlsx", transactions: fixtureTransactions },
      {
        name: "hdfc-bank-interest.csv",
        transactions: [],
        rawSheet: {
          headers: ["Date", "Description", "Interest Credited"],
          records: [
            { Date: "30-Jun-2025", Description: "Savings interest", "Interest Credited": 1234.5 },
            { Date: "30-Sep-2025", Description: "Savings interest", "Interest Credited": 1310 }
          ]
        }
      }
    ]
  };
  const multiWorkbook = await buildFullWorkbookExport(multiFileState);
  const multiSheets = await readWorkbook(multiWorkbook.blob);
  const multiNames = (multiSheets as Array<{ sheet: string }>).map((s) => s.sheet);

  if (multiNames.length !== 5) {
    throw new Error(`Expected 5 sheets (2 summaries + 3 raw files), found ${multiNames.length}: ${multiNames.join(", ")}`);
  }
  if (multiNames[0] !== "CA Summary" || multiNames[1] !== "Detailed Summary") {
    throw new Error(`Multi-file workbook must start with CA Summary then Detailed Summary. Found: ${multiNames.join(", ")}`);
  }
  const rawFileNames = multiNames.slice(2);
  if (rawFileNames.length !== 3) {
    throw new Error(`Expected one sheet per raw file after the two summaries. Found: ${rawFileNames.join(", ")}`);
  }
  const illegal = /[:\\/?*[\]]/;
  for (const name of rawFileNames) {
    if (name.length === 0 || name.length > 31) {
      throw new Error(`Raw file sheet name must be 1-31 chars: "${name}" (${name.length}).`);
    }
    if (illegal.test(name)) {
      throw new Error(`Raw file sheet name has an illegal character: "${name}".`);
    }
  }
  if (new Set(multiNames.map((n) => n.toLowerCase())).size !== multiNames.length) {
    throw new Error(`Sheet names must be unique (case-insensitive). Found: ${multiNames.join(", ")}`);
  }

  // The reference sheet should preserve the raw rows verbatim (its header row
  // plus both data rows), and never feed the tax working.
  const referenceSheet = sheetData(multiSheets, rawFileNames[2]);
  const referenceHeaderRow = referenceSheet.find((row) => String(row[0]) === "Date");
  if (!referenceHeaderRow || !referenceHeaderRow.some((cell) => String(cell) === "Interest Credited")) {
    throw new Error("Reference sheet should preserve the raw upload's header row (Date … Interest Credited).");
  }
  if (!referenceSheet.some((row) => Number(row[2]) === 1234.5)) {
    throw new Error("Reference sheet should preserve the raw upload's data rows verbatim.");
  }

  console.log(
    "Validated webapp exports: CA Summary CSV/XLSX, full workbook ordering (CA Summary, Detailed Summary, one sheet per raw file), and multi-file sheet naming + raw reference passthrough."
  );
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
