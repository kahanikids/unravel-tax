import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workbookPath = path.join(repoRoot, "templates", "excel-export", "UnravelTax-Template.xlsx");

const requiredSheets = [
  "Profile",
  "Raw Data - Sample Broker",
  "Working - Sample Broker",
  "Dividends",
  "Interest & Other Income",
  "Transaction Charges",
  "Carry Forward Losses",
  "Checklist State",
  "CA Summary",
  "Detailed Summary",
  "ITR Form Guide",
  "NRE-NRO Tracker",
  "TDS Reconciliation",
  "DTAA & Residency",
  "Repatriation Log",
  "Coparceners & Members",
  "Transfers Without Consideration",
  "Partition Log",
  "Interest Deduction Tracker",
  "Regime & Advance Tax Flags",
  "Minor's Income (Clubbing)",
  "Alimony/Maintenance Log",
];

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheetInspect = await workbook.inspect({
  kind: "sheet",
  include: "name",
  maxChars: 10000,
});
const sheetText = sheetInspect.ndjson;
const missing = requiredSheets.filter((name) => !sheetText.includes(`"name":"${name}"`));
if (missing.length) {
  throw new Error(`Missing required sheets: ${missing.join(", ")}`);
}

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 200 },
  summary: "template formula error scan",
});
if (formulaErrors.ndjson.includes("#REF!") || formulaErrors.ndjson.includes("#DIV/0!") || formulaErrors.ndjson.includes("#VALUE!") || formulaErrors.ndjson.includes("#NAME?") || formulaErrors.ndjson.includes("#N/A")) {
  console.log(formulaErrors.ndjson);
  throw new Error("Formula error markers found in template.");
}

console.log(`Verified ${requiredSheets.length} sheets.`);
process.exit(0);
