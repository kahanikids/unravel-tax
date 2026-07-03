import { caSummaryRows, reconciliationReport, summarizeWithRules } from "../lib";
import { parseCsvText } from "../ingest";
import { ruleCatalog, ruleVerificationSummary } from "../rules";
import type { ChecklistItem, TdsRow } from "../lib";

export const orientationAnswers = [
  { label: "Residency", value: "Resident fixture" },
  { label: "Profile flags", value: "No NRI, HUF, senior citizen, or single-parent flag" },
  { label: "Income sources", value: "Capital gains, dividends, bank interest" },
  { label: "Review trigger", value: "Speculative intraday income selects ITR-3" }
];

export const ingestionFormats = [
  { label: "CSV", value: "Parsed with PapaParse" },
  { label: "Excel", value: "Parsed with read-excel-file" },
  { label: "HTML", value: "Transaction table selected by expected headers" },
  { label: "Structured text", value: "Tab-separated rows normalized directly" },
  { label: "PDF/free-form", value: "Routed to prompts/01-extract-statement.md" }
];

export const fixtureCsv = [
  "Scrip Name,Purchase Date,Sell Date,Units,Buy Value,Sell Value,Buy Price,Sell Price",
  "Acme Industries,01-Apr-2025,15-Apr-2025,100,50000,51000,500,510",
  "Acme Industries,10-Jan-2024,20-May-2025,50,25000,27500,500,550",
  "Sample Metals Ltd,05-Jun-2025,05-Jun-2025,200,40000,40800,200,204",
  "Sample Metals Ltd,12-Feb-2023,18-Jun-2025,75,30000,33000,400,440",
  "Test Pharma Co,01-Aug-2025,30-Aug-2025,150,45000,43500,300,290"
].join("\n");

export const checklistItems: ChecklistItem[] = [
  {
    document: "Form 16 or pension statement",
    needed: "Yes",
    status: "Loaded",
    whyNeeded: "Salary/pension income"
  },
  {
    document: "AIS / Form 26AS",
    needed: "Yes",
    status: "Needed",
    whyNeeded: "TDS and reported transactions"
  },
  {
    document: "Bank interest certificates",
    needed: "Yes",
    status: "Needed",
    whyNeeded: "Other income and deductions"
  },
  {
    document: "Broker/AMC capital gains statement",
    needed: "Yes",
    status: "Sample loaded",
    whyNeeded: "Capital gains classification"
  },
  {
    document: "Dividend statement",
    needed: "Yes",
    status: "Loaded",
    whyNeeded: "Quarter-wise Schedule OS"
  },
  {
    document: "NRI documents",
    needed: "Profile-dependent",
    status: "Not applicable",
    whyNeeded: "TRC, 10F, NRE/NRO, TDS"
  }
];

export const reportedSummary = {
  "Speculative / Intraday income": 800,
  "Short-Term Capital Gains": -450,
  "Long-Term Capital Gains": 5500,
  Dividends: 4000,
  "Interest & other income": 24000,
  "Eligible interest deduction": 0,
  "Deductible transaction charges": 160,
  "Carry-forward losses available": 500
};

export const tdsRows: TdsRow[] = [
  { source: "Sample Bank", tdsPerDocument: 1800, tdsPerAis: 1800 },
  { source: "Sample Broker", tdsPerDocument: 1200, tdsPerAis: 900 }
];

export const fixtureTransactions = parseCsvText(fixtureCsv).transactions;
export const calculationSummary = summarizeWithRules(
  fixtureTransactions,
  ruleCatalog.capitalGainsEquity,
  ruleCatalog.itrFormSelection
);
export const calculationRows = caSummaryRows(
  fixtureTransactions,
  ruleCatalog.capitalGainsEquity,
  ruleCatalog.itrFormSelection
);
export const expectedFigures = Object.fromEntries(
  calculationRows
    // The sale/cost totals rows are derivation detail, not income heads the
    // reported CA summary would restate - keep the demo check to real heads.
    .filter((row) => typeof row.amount === "number" && row.ruleSection !== "Totals")
    .map((row) => [row.head, row.amount as number])
);
export const checksReport = reconciliationReport({
  checklistItems,
  expectedFigures,
  reportedFigures: reportedSummary,
  tdsRows
});
export const verificationSummary = ruleVerificationSummary([
  ruleCatalog.capitalGainsEquity,
  ruleCatalog.itrFormSelection
]);

export const calculationLedger = [
  { label: "Rows", value: String(calculationSummary.rows) },
  { label: "Intraday", value: formatAmount(calculationSummary.intradayGain) },
  { label: "STCG", value: formatAmount(calculationSummary.stcg) },
  { label: "LTCG", value: formatAmount(calculationSummary.ltcg) },
  { label: "Recommended form", value: calculationSummary.recommendedItrForm },
  { label: "Rule verification", value: `${verificationSummary.pendingCurrentSource}/${verificationSummary.total} pending` }
];

export function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value);
}
