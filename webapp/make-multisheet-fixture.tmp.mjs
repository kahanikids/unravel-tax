// Generates fixtures/sample-broker-statement-multi-sheet.xlsx:
// sheet 1 is a summary/disclaimer sheet with no transaction table,
// sheet 2 holds the same rows as sample-broker-statement.csv.
import writeXlsxFile from "write-excel-file/node";
import { resolve } from "node:path";

const repoRoot = process.argv[2];

const summarySheet = [
  [{ value: "Acme Broking Ltd — Capital Gains Report" }],
  [{ value: "FY 2025-26. See the Equity sheet for transaction detail." }],
  [{ value: "Disclaimer: figures are indicative." }]
];

const header = ["Scrip Name", "Purchase Date", "Sell Date", "Units", "Buy Value", "Sell Value", "Buy Price", "Sell Price"];
const rows = [
  ["Acme Industries", "01-Apr-2025", "15-Apr-2025", 100, 50000, 51000, 500, 510],
  ["Acme Industries", "10-Jan-2024", "20-May-2025", 50, 25000, 27500, 500, 550],
  ["Sample Metals Ltd", "05-Jun-2025", "05-Jun-2025", 200, 40000, 40800, 200, 204],
  ["Sample Metals Ltd", "12-Feb-2023", "18-Jun-2025", 75, 30000, 33000, 400, 440],
  ["Test Pharma Co", "01-Aug-2025", "30-Aug-2025", 150, 45000, 43500, 300, 290]
];

const equitySheet = [
  header.map((value) => ({ value })),
  ...rows.map((row) => row.map((value) => (typeof value === "number" ? { value, type: Number } : { value })))
];

await writeXlsxFile(
  [
    { sheet: "Summary", data: summarySheet },
    { sheet: "Equity", data: equitySheet }
  ],
  { filePath: resolve(repoRoot, "fixtures", "sample-broker-statement-multi-sheet.xlsx") }
);
console.log("Wrote fixtures/sample-broker-statement-multi-sheet.xlsx");
