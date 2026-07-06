import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import readWorkbook from "read-excel-file/universal";
import {
  applyPreviousWorkbookToOrientation,
  buildCaSummaryCsvExport,
  buildCaSummaryWorkbookExport,
  buildFullWorkbookExport,
  parsePreviousWorkbook,
  rateInputsFromRule,
  type ExportState
} from "../src/lib";
import { calculationRows, fixtureTransactions } from "../src/demo/sampleState";
import { ruleCatalog } from "../src/rules";
import { BLANK_ORIENTATION, type OrientationAnswers } from "../src/state/types";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const dryRunDir = resolve(repoRoot, "dry-runs", "m1c");

type ReferenceRow = {
  Head: string;
  Amount: string;
};

export async function main() {
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
  assertAmountsMatch(
    reference,
    Object.fromEntries(caCsvRows.data.map((row) => [row.Head, normalizeAmount(row.Amount)]))
  );

  const caWorkbook = await buildCaSummaryWorkbookExport(calculationRows);
  const caSheets = await readWorkbook(caWorkbook.blob);
  const caSheet = sheetData(caSheets, "Sheet1");
  assertAmountsMatch(reference, rowsToAmountMap(caSheet));

  const fullWorkbook = await buildFullWorkbookExport(exportState);
  const fullSheets = await readWorkbook(fullWorkbook.blob);
  const sheetNames = (fullSheets as Array<{ sheet: string }>).map((s) => s.sheet);
  // Requested order: (1) CA Summary, (2) Detailed Summary, then one sheet per raw file.
  if (sheetNames[0] !== "CA Summary" || sheetNames[1] !== "Detailed Summary") {
    throw new Error(
      `Full workbook must start with CA Summary then Detailed Summary. Found: ${sheetNames.join(", ")}`
    );
  }
  if (sheetNames[2] !== "sample-broker-statement") {
    throw new Error(
      `Raw file sheet should follow the two summaries. Found: ${sheetNames.join(", ")}`
    );
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
    "Combined gain/(loss): sale minus cost"
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
      {
        name: "another-really-long-broker-statement-name-2025.xlsx",
        transactions: fixtureTransactions
      },
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
    throw new Error(
      `Expected 5 sheets (2 summaries + 3 raw files), found ${multiNames.length}: ${multiNames.join(", ")}`
    );
  }
  if (multiNames[0] !== "CA Summary" || multiNames[1] !== "Detailed Summary") {
    throw new Error(
      `Multi-file workbook must start with CA Summary then Detailed Summary. Found: ${multiNames.join(", ")}`
    );
  }
  const rawFileNames = multiNames.slice(2);
  if (rawFileNames.length !== 3) {
    throw new Error(
      `Expected one sheet per raw file after the two summaries. Found: ${rawFileNames.join(", ")}`
    );
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
    throw new Error(
      `Sheet names must be unique (case-insensitive). Found: ${multiNames.join(", ")}`
    );
  }

  // The reference sheet should preserve the raw rows verbatim (its header row
  // plus both data rows), and never feed the tax working.
  const referenceSheet = sheetData(multiSheets, rawFileNames[2]);
  const referenceHeaderRow = referenceSheet.find((row) => String(row[0]) === "Date");
  if (
    !referenceHeaderRow ||
    !referenceHeaderRow.some((cell) => String(cell) === "Interest Credited")
  ) {
    throw new Error(
      "Reference sheet should preserve the raw upload's header row (Date … Interest Credited)."
    );
  }
  if (!referenceSheet.some((row) => Number(row[2]) === 1234.5)) {
    throw new Error("Reference sheet should preserve the raw upload's data rows verbatim.");
  }

  // Internal round trip: a Full Workbook exported WITH a profile (synthetic,
  // never real data) must keep the profile and CA Summary rows readable
  // without evaluating any of the capital-gains formulas. This protects the
  // workbook structure even though previous-workbook import is not exposed in
  // the FY 2025-26 welcome flow.
  const syntheticOrientation: OrientationAnswers = {
    ...BLANK_ORIENTATION,
    residency: "nri",
    nriCountry: "United Arab Emirates",
    huf: false,
    seniorCitizen: true,
    singleParent: false,
    incomeSources: ["capital_gains", "dividends"],
    multipleEmployers: false,
    hraClaimed: null,
    foreignAssets: true
  };
  const exportWithOrientation = await buildFullWorkbookExport({
    ...exportState,
    orientation: syntheticOrientation
  });
  const importedBuffer = await exportWithOrientation.blob.arrayBuffer();
  const imported = await parsePreviousWorkbook(importedBuffer);
  if (!imported.foundAnything) {
    throw new Error(
      "Expected the round-tripped workbook import to find the orientation sheet and CA Summary figures."
    );
  }
  if (
    imported.orientation?.residency !== "nri" ||
    imported.orientation?.nriCountry !== "United Arab Emirates"
  ) {
    throw new Error(
      `Expected residency/nriCountry to round-trip, got ${JSON.stringify(imported.orientation)}.`
    );
  }
  if (imported.orientation?.seniorCitizen !== true || imported.orientation?.huf !== false) {
    throw new Error(
      `Expected boolean Yes/No answers to round-trip, got ${JSON.stringify(imported.orientation)}.`
    );
  }
  if (imported.orientation?.hraClaimed !== undefined) {
    throw new Error(
      "An unanswered (null) orientation field should round-trip as absent, not a guessed value."
    );
  }
  if (imported.orientation?.incomeSources?.join(",") !== "capital_gains,dividends") {
    throw new Error(
      `Expected income sources to round-trip, got ${JSON.stringify(imported.orientation?.incomeSources)}.`
    );
  }
  if (
    imported.dividends !== 4000 ||
    imported.interestOtherIncome !== 24000 ||
    imported.carryForwardLossesAvailable !== 500
  ) {
    throw new Error(
      `Expected the known synthetic figures to round-trip, got ${JSON.stringify(imported)}.`
    );
  }

  // The retained merge helper fills blank fields only; it must never clobber
  // already-entered answers.
  const mergedIntoBlank = applyPreviousWorkbookToOrientation(
    BLANK_ORIENTATION,
    imported.orientation
  );
  if (mergedIntoBlank.residency !== "nri" || mergedIntoBlank.seniorCitizen !== true) {
    throw new Error(
      `Expected merge into a blank orientation to fill every found field, got ${JSON.stringify(mergedIntoBlank)}.`
    );
  }
  const alreadyAnswered = { ...BLANK_ORIENTATION, residency: "resident" as const };
  const mergedIntoAnswered = applyPreviousWorkbookToOrientation(
    alreadyAnswered,
    imported.orientation
  );
  if (mergedIntoAnswered.residency !== "resident") {
    throw new Error(
      "Importing a workbook should never overwrite an orientation answer already given."
    );
  }
  if (mergedIntoAnswered.seniorCitizen !== true) {
    throw new Error("Importing a workbook should still fill in fields that are still blank.");
  }

  // A workbook exported without an orientation must degrade gracefully - no
  // profile record, but the CA Summary figures still come through.
  const exportWithoutOrientation = await buildFullWorkbookExport(exportState);
  const importedWithoutOrientation = await parsePreviousWorkbook(
    await exportWithoutOrientation.blob.arrayBuffer()
  );
  if (importedWithoutOrientation.orientation !== null) {
    throw new Error(
      "A workbook with no Orientation sheet should report orientation as null, not a guessed profile."
    );
  }
  if (importedWithoutOrientation.dividends !== 4000) {
    throw new Error("CA Summary figures should still import even without an Orientation sheet.");
  }

  // Schedule FA sheet: present with disclosure rows when at least one
  // foreign account or equity holding is entered, absent entirely when
  // there are none. Phase 2 equity/RSU holdings append their own section.
  const exportWithForeignAccounts = await buildFullWorkbookExport({
    ...exportState,
    foreignAccounts: [
      {
        id: "fa1",
        accountType: "depository",
        country: "United States",
        institutionName: "Chase",
        accountNumber: "1234",
        openingDate: "",
        peakBalanceInr: 500000,
        closingBalanceInr: 300000,
        grossInterestInr: 10000
      }
    ],
    foreignEquityHoldings: [
      {
        id: "fe1",
        entityName: "Acme Inc",
        isRsuOrEspp: true,
        acquisitionDate: "2023-01-01",
        costBasisInr: 500000,
        perquisiteValueInr: 500000,
        closingValueInr: 0,
        saleDate: "2025-06-01",
        saleProceedsInr: 650000,
        foreignTaxPaidOnGainInr: 15000
      }
    ],
    scheduleFaCalendarYear: 2025
  });
  const foreignAccountsSheets = await readWorkbook(exportWithForeignAccounts.blob);
  const scheduleFaSheetNames = (foreignAccountsSheets as Array<{ sheet: string }>).map(
    (s) => s.sheet
  );
  if (!scheduleFaSheetNames.includes("Schedule FA")) {
    throw new Error(`Expected a Schedule FA sheet, found: ${scheduleFaSheetNames.join(", ")}`);
  }
  const scheduleFaSheet = sheetData(foreignAccountsSheets, "Schedule FA");
  const scheduleFaText = JSON.stringify(scheduleFaSheet);
  if (!scheduleFaText.includes("Chase") || !scheduleFaText.includes("500000")) {
    throw new Error(
      `Expected the Schedule FA sheet to include the entered account's institution and peak balance, got: ${scheduleFaText}`
    );
  }
  if (!scheduleFaText.includes("Acme Inc") || !scheduleFaText.includes("650000")) {
    throw new Error(
      `Expected the Schedule FA sheet to include the equity holding's entity name and sale proceeds, got: ${scheduleFaText}`
    );
  }
  const exportWithoutForeignAccounts = await buildFullWorkbookExport(exportState);
  const withoutForeignAccountsSheets = await readWorkbook(exportWithoutForeignAccounts.blob);
  if (
    (withoutForeignAccountsSheets as Array<{ sheet: string }>).some(
      (s) => s.sheet === "Schedule FA"
    )
  ) {
    throw new Error(
      "A workbook with no foreign accounts/holdings entered should not have a Schedule FA sheet at all."
    );
  }

  console.log(
    "Validated webapp exports: CA Summary CSV/XLSX, full workbook ordering (CA Summary, Detailed Summary, one sheet per raw file), multi-file sheet naming + raw reference passthrough, internal workbook round trip (orientation profile, carry-forward losses, dividends, interest, never-clobber merge helper, and graceful no-Orientation-sheet fallback), and the Schedule FA sheet (Phase 1 accounts plus Phase 2 equity/RSU holdings both present when entered, absent entirely with none)."
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

function assertAmountsMatch(
  reference: Record<string, string | number>,
  actual: Record<string, string | number>
) {
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
  const sheet = (sheets as Array<{ sheet: string; data: unknown[][] }>).find(
    (item) => item.sheet === name
  );
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

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main();
}
