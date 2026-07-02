import writeXlsxFile from "write-excel-file/browser";
import type { SheetData } from "write-excel-file/browser";
import type { ChecklistItem, TdsRow } from "./reconciliation";
import type { CaSummaryRow, RuleBackedSummary } from "./calculations";
import type { NormalizedTransaction } from "../ingest";

export type ExportState = {
  caSummaryRows: CaSummaryRow[];
  transactions: NormalizedTransaction[];
  calculationSummary: RuleBackedSummary;
  checklistItems: ChecklistItem[];
  tdsRows: TdsRow[];
  openIssueCount: number;
};

export type ExportFile = {
  filename: string;
  mimeType: string;
  blob: Blob;
};

export const CA_SUMMARY_CSV_FILENAME = "UnravelTax-CA-Summary.csv";
export const CA_SUMMARY_XLSX_FILENAME = "UnravelTax-CA-Summary.xlsx";
export const FULL_WORKBOOK_XLSX_FILENAME = "UnravelTax-Full-Workbook.xlsx";

export function caSummaryCsv(rows: CaSummaryRow[]) {
  return [
    ["Head", "Rule/Section", "Amount", "Notes"],
    ...rows.map((row) => [row.head, row.ruleSection, row.amount, row.notes])
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function caSummarySheet(rows: CaSummaryRow[]): SheetData {
  return [
    ["Head", "Rule/Section", "Amount", "Notes"],
    ...rows.map((row) => [row.head, row.ruleSection, row.amount, row.notes])
  ];
}

export async function buildCaSummaryCsvExport(rows: CaSummaryRow[]): Promise<ExportFile> {
  return {
    filename: CA_SUMMARY_CSV_FILENAME,
    mimeType: "text/csv;charset=utf-8",
    blob: new Blob([caSummaryCsv(rows)], { type: "text/csv;charset=utf-8" })
  };
}

export async function buildCaSummaryWorkbookExport(rows: CaSummaryRow[]): Promise<ExportFile> {
  const blob = await writeXlsxFile(caSummarySheet(rows)).toBlob();
  return {
    filename: CA_SUMMARY_XLSX_FILENAME,
    mimeType: xlsxMimeType,
    blob
  };
}

export async function buildFullWorkbookExport(state: ExportState): Promise<ExportFile> {
  const blob = await writeXlsxFile([
    {
      sheet: "CA Summary",
      data: caSummarySheet(state.caSummaryRows)
    },
    {
      sheet: "Transactions",
      data: transactionsSheet(state.transactions)
    },
    {
      sheet: "Detailed Summary",
      data: detailedSummarySheet(state.calculationSummary)
    },
    {
      sheet: "Checklist State",
      data: checklistSheet(state.checklistItems)
    },
    {
      sheet: "TDS Reconciliation",
      data: tdsSheet(state.tdsRows)
    },
    {
      sheet: "Manifest",
      data: manifestSheet(state.openIssueCount)
    }
  ]).toBlob();

  return {
    filename: FULL_WORKBOOK_XLSX_FILENAME,
    mimeType: xlsxMimeType,
    blob
  };
}

export function downloadExport(file: ExportFile) {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function transactionsSheet(transactions: NormalizedTransaction[]): SheetData {
  return [
    [
      "Scrip Name",
      "Purchase Date",
      "Sell Date",
      "Units",
      "Buy Value",
      "Sell Value",
      "Buy Price",
      "Sell Price",
      "Hold Period (Days)",
      "Tax Class",
      "Gain/(Loss)"
    ],
    ...transactions.map((transaction) => [
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
    ])
  ];
}

function detailedSummarySheet(summary: RuleBackedSummary): SheetData {
  return [
    ["Metric", "Value", "Notes"],
    ["Rows parsed", summary.rows, "All lightweight fixture formats validate to this shape."],
    ["Intraday gain", summary.intradayGain, "Taxed as speculative/business income."],
    ["STCG", summary.stcg, "Section 111A bucket."],
    ["LTCG", summary.ltcg, "Section 112A bucket before exemption."],
    ["LTCG taxable after exemption", summary.ltcgTaxableAfterExemption, "Uses rule JSON exemption value."],
    ["Estimated STCG tax", summary.estimatedStcgTax, "Uses rule JSON STCG rate."],
    ["Estimated LTCG tax", summary.estimatedLtcgTax, "Uses rule JSON LTCG rate."],
    ["Recommended ITR form", summary.recommendedItrForm, "Selected from rule JSON."],
    ["CA review recommendation", summary.caReviewRecommendation, "Derived from selected form."]
  ];
}

function checklistSheet(items: ChecklistItem[]): SheetData {
  return [
    ["Document", "Needed?", "Status", "Why needed"],
    ...items.map((item) => [item.document, String(item.needed), item.status, item.whyNeeded])
  ];
}

function tdsSheet(rows: TdsRow[]): SheetData {
  return [
    ["Source", "TDS per Document", "TDS per AIS/26AS", "Difference"],
    ...rows.map((row) => [row.source, row.tdsPerDocument, row.tdsPerAis, row.tdsPerDocument - row.tdsPerAis])
  ];
}

function manifestSheet(openIssueCount: number): SheetData {
  return [
    ["Field", "Value"],
    ["Generated by", "Unravel Tax webapp"],
    ["Milestone", "M4E exports"],
    ["Source", "Synthetic fixtures only"],
    ["Open checklist/reconciliation issues", openIssueCount]
  ];
}

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const xlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
