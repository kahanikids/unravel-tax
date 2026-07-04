import writeXlsxFile from "write-excel-file/browser";
import type { SheetData } from "write-excel-file/browser";
import type { CaSummaryRow } from "./calculations";
import type { NormalizedTransaction } from "../ingest";
import type { CapitalGainsEquityRule } from "../rules";
import {
  buildBrokerSheet,
  buildDetailedSummarySheet,
  buildLinkedCaSummarySheet,
  buildRawSheet,
  buildStandaloneCaSummarySheet,
  uniqueSheetNames,
  type BrokerSheetMeta,
  type ExportDocument,
  type RateInputs,
  type RawSheet
} from "./workbookExport";

export type { ExportDocument, RateInputs, RawSheet };

export type ExportState = {
  documents: ExportDocument[];
  caSummaryRows: CaSummaryRow[];
  rateInputs: RateInputs;
  financialYear: string;
  assessmentYear: string;
};

export type ExportFile = {
  filename: string;
  mimeType: string;
  blob: Blob;
};

export const CA_SUMMARY_CSV_FILENAME = "UnravelTax-CA-Summary.csv";
export const CA_SUMMARY_XLSX_FILENAME = "UnravelTax-CA-Summary.xlsx";
export const FULL_WORKBOOK_XLSX_FILENAME = "UnravelTax-Full-Workbook.xlsx";

export function rateInputsFromRule(rule: CapitalGainsEquityRule): RateInputs {
  const eq = rule.values.listed_equity;
  return {
    ltHoldingDays: eq.long_term_holding_period_days_gt,
    stcgRate: eq.stcg_rate,
    ltcgRate: eq.ltcg_rate,
    ltcgExemptionInr: eq.ltcg_exemption_inr,
    surchargeCapRate: eq.surcharge_cap_rate,
    healthEducationCessRate: eq.health_education_cess_rate
  };
}

export function transactionsCsv(transactions: NormalizedTransaction[]) {
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
      "Instrument Type",
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
      transaction.instrumentType,
      transaction.taxClass,
      transaction.gainLoss
    ])
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function caSummaryCsv(rows: CaSummaryRow[]) {
  return [
    ["Head", "Rule/Section", "Amount", "Notes"],
    ...rows.map((row) => [row.head, row.ruleSection, row.amount, row.notes])
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

/** @deprecated Use buildStandaloneCaSummarySheet via buildCaSummaryWorkbookExport */
export function caSummarySheet(rows: CaSummaryRow[]): SheetData {
  return buildStandaloneCaSummarySheet(rows, "FY2025-26", "AY2026-27");
}

export async function buildCaSummaryCsvExport(rows: CaSummaryRow[]): Promise<ExportFile> {
  return {
    filename: CA_SUMMARY_CSV_FILENAME,
    mimeType: "text/csv;charset=utf-8",
    blob: new Blob([caSummaryCsv(rows)], { type: "text/csv;charset=utf-8" })
  };
}

export async function buildCaSummaryWorkbookExport(
  rows: CaSummaryRow[],
  financialYear = "FY2025-26",
  assessmentYear = "AY2026-27"
): Promise<ExportFile> {
  const blob = await writeXlsxFile(buildStandaloneCaSummarySheet(rows, financialYear, assessmentYear)).toBlob();
  return {
    filename: CA_SUMMARY_XLSX_FILENAME,
    mimeType: xlsxMimeType,
    blob
  };
}

export async function buildFullWorkbookExport(state: ExportState): Promise<ExportFile> {
  const documents = state.documents.length > 0 ? state.documents : [{ name: "Transactions", transactions: [] }];
  const sheetNames = uniqueSheetNames(documents.map((doc) => doc.sheetNameHint || doc.name));

  // One sheet per raw uploaded document, kept in upload order. A document that
  // couldn't be parsed into capital-gains transactions (bank/dividend/MF
  // statements) is emitted as a verbatim reference sheet and contributes no
  // broker meta, so it never feeds the tax working on the summary sheets.
  const brokerMetas: BrokerSheetMeta[] = [];
  const docSheets = documents.map((doc, index) => {
    if (doc.rawSheet && doc.transactions.length === 0) {
      return buildRawSheet(doc.name, doc.rawSheet, sheetNames[index]);
    }
    const broker = buildBrokerSheet(doc.name, doc.transactions, state.financialYear, sheetNames[index]);
    brokerMetas.push(broker.meta);
    return { sheet: broker.sheet, data: broker.data, columns: broker.columns };
  });

  const detailed = buildDetailedSummarySheet(
    brokerMetas,
    state.rateInputs,
    state.financialYear,
    state.assessmentYear
  );

  // Order requested by the user: (1) CA Summary, (2) Detailed Summary, then one
  // sheet per raw uploaded file. Summary formulas reference other sheets by
  // name, so the sheet order is purely presentational.
  const sheets = [
    {
      sheet: "CA Summary",
      data: buildLinkedCaSummarySheet(state.caSummaryRows, state.financialYear, state.assessmentYear),
      columns: [{ width: 34 }, { width: 14 }, { width: 18 }, { width: 40 }]
    },
    {
      sheet: "Detailed Summary",
      data: detailed.data,
      columns: detailed.columns
    },
    ...docSheets
  ];

  const blob = await writeXlsxFile(sheets).toBlob();

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

function csvCell(value: string | number) {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

const xlsxMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
