import type { Cell, Row, SheetData } from "write-excel-file/browser";
import { findBrokerSpeculativeColumn, findBrokerTaxableColumn, type CaSummaryRow } from "./calculations";
import type { NormalizedTransaction } from "../ingest";
import { parseFixtureDate } from "../ingest/normalize";
import type { OrientationAnswers } from "../state/types";
import type { ForeignAccount } from "./scheduleFa";

export type ExportDocument = {
  name: string;
  transactions: NormalizedTransaction[];
  /**
   * Rows preserved verbatim from a raw upload that isn't a capital-gains
   * statement (bank interest, dividends, MF holdings). When present and there
   * are no transactions, the workbook emits a reference-only sheet for it
   * instead of the formula-driven broker sheet.
   */
  rawSheet?: RawSheet;
  /** Short word/acronym pulled from a PDF's own Title/Subject metadata - preferred over `name` for the sheet tab so it stays readable within Excel's 31-char limit. `name` (the full filename) still appears in the sheet's own "Source:" line either way. */
  sheetNameHint?: string;
};

/** A raw upload kept as-is for reference: header names plus already-normalized primitive cell values. */
export type RawSheet = {
  headers: string[];
  records: Record<string, string | number>[];
};

export type RateInputs = {
  ltHoldingDays: number;
  stcgRate: number;
  ltcgRate: number;
  ltcgExemptionInr: number;
  surchargeCapRate: number;
  healthEducationCessRate: number;
};

export type BrokerSheetMeta = {
  name: string;
  dataStartRow: number;
  dataEndRow: number;
  classCol: string;
  gainCol: string;
  brokerTaxableCol?: string;
  /** Brokers often report intraday in a separate speculative column, kept out of the taxable-gain column. */
  brokerSpeculativeCol?: string;
};

const DETAILED_SHEET = "Detailed Summary";
const BROKER_DATA_START = 5;
const BROKER_HEADER_ROW = 4;

const DS_INTRADAY_ROW = 6;
const DS_STCG_ROW = 7;
const DS_LTCG_ROW = 8;
const DS_DEBT_ROW = 9;
const DS_LT_DAYS_ROW = 12;
const DS_STCG_RATE_ROW = 13;
const DS_LTCG_RATE_ROW = 14;
const DS_LTCG_EXEMPT_ROW = 15;
const DS_SURCHARGE_ROW = 16;
const DS_CESS_ROW = 17;
const DS_NET_LTCG_ROW = 37;
const DS_TAXABLE_LTCG_ROW = 39;
const DS_LTCG_LOSS_ROW = 40;
const DS_LTCG_TAX_ROW = 42;
const DS_NET_STCG_ROW = 44;
const DS_TAXABLE_STCG_ROW = 45;
const DS_STCG_LOSS_ROW = 46;
const DS_STCG_TAX_ROW = 48;
const DS_SPEC_GAIN_ROW = 50;
const DS_SPEC_NET_ROW = 51;
const DS_SLAB_RATE_ROW = 52;
const DS_SPEC_TAX_ROW = 53;
const DS_SUBTOTAL_TAX_ROW = 55;
const DS_SURCHARGE_AMT_ROW = 57;
const DS_CESS_AMT_ROW = 59;
const DS_TOTAL_TAX_ROW = 60;

const FMT_CURRENCY = '\\₹#,##0.00;("₹"#,##0.00);\\-';
const FMT_PERCENT = "0.0%";
const FMT_DATE = "dd\\-mmm\\-yyyy";

const tdBase: Partial<Cell> = {
  fontFamily: "Arial",
  fontSize: 11,
  borderStyle: "thin",
  borderColor: "#BFBFBF"
};

function currencyStyle(gain?: number): Partial<Cell> {
  return {
    ...tdBase,
    format: FMT_CURRENCY,
    textColor: gain === undefined ? "#000000" : gain > 0 ? "#006100" : gain < 0 ? "#C00000" : "#000000"
  };
}

function currencyBoldStyle(gain?: number): Partial<Cell> {
  return { ...currencyStyle(gain), fontWeight: "bold" };
}

const C = {
  title: { fontFamily: "Arial", fontSize: 16, fontWeight: "bold" as const },
  subtitle: { fontFamily: "Arial", fontSize: 10, fontStyle: "italic" as const, wrap: true },
  section: {
    fontFamily: "Arial",
    fontSize: 12,
    fontWeight: "bold" as const,
    backgroundColor: "#D9E1F2",
    indent: 1
  },
  th: {
    fontFamily: "Arial",
    fontSize: 11,
    fontWeight: "bold" as const,
    textColor: "#FFFFFF",
    backgroundColor: "#1F4E78",
    align: "center" as const,
    alignVertical: "center" as const,
    wrap: true,
    borderStyle: "thin" as const,
    borderColor: "#BFBFBF"
  },
  td: tdBase,
  tdWrap: {
    ...tdBase,
    wrap: true,
    alignVertical: "top" as const
  },
  currency: currencyStyle,
  currencyBold: currencyBoldStyle,
  inputNum: {
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#0000FF",
    backgroundColor: "#FFF2CC",
    borderStyle: "thin" as const,
    borderColor: "#BFBFBF"
  },
  inputPct: {
    fontFamily: "Arial",
    fontSize: 11,
    textColor: "#0000FF",
    backgroundColor: "#FFF2CC",
    format: FMT_PERCENT,
    borderStyle: "thin" as const,
    borderColor: "#BFBFBF"
  },
  date: {
    ...tdBase,
    format: FMT_DATE
  },
  note: {
    fontFamily: "Arial",
    fontSize: 9,
    fontStyle: "italic" as const,
    wrap: true,
    alignVertical: "top" as const
  },
  total: {
    fontFamily: "Arial",
    fontSize: 11,
    fontWeight: "bold" as const,
    borderStyle: "thin" as const,
    borderColor: "#BFBFBF"
  }
};

function colLetter(index: number): string {
  let n = index;
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function cellRef(sheet: string, col: string, row: number): string {
  return `${quoteSheet(sheet)}!$${col}$${row}`;
}

function f(value: string, style: Partial<Cell> = {}): Cell {
  return { type: "Formula", value, ...style };
}

function txt(value: string, style: Partial<Cell> = {}): Cell {
  return { value, ...style };
}

function num(value: number, style: Partial<Cell> = {}): Cell {
  return { value, type: Number, ...style };
}

function mergeTitle(row: Row, text: string, span = 6): Row {
  const out: Row = [...row];
  out[0] = txt(text, { ...C.title, columnSpan: span });
  return out;
}

function emptyRow(cols: number): Row {
  return Array.from({ length: cols }, () => null);
}

function sanitizeSheetName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[[\]:*?/\\]/g, "");
  return (base || "Broker").slice(0, 31);
}

const RESERVED_SHEET_NAMES = new Set([DETAILED_SHEET.toLowerCase(), "ca summary"]);

/**
 * Excel rejects a workbook with two identically named sheets, and Excel
 * sheet-name comparison is case-insensitive. Two uploads of "statement.csv"
 * and "statement.xlsx" (or a file literally named "CA Summary") must not
 * produce a corrupt export, so suffix duplicates with (2), (3), ...
 */
export function uniqueSheetNames(fileNames: string[]): string[] {
  const used = new Set<string>(RESERVED_SHEET_NAMES);
  return fileNames.map((fileName) => {
    const base = sanitizeSheetName(fileName);
    let candidate = base;
    let counter = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${counter})`;
      candidate = base.slice(0, 31 - suffix.length) + suffix;
      counter += 1;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

function brokerColumnKeys(transactions: NormalizedTransaction[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const tx of transactions) {
    if (!tx.brokerColumns) continue;
    for (const key of Object.keys(tx.brokerColumns)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

function classificationFormula(row: number, instCol: string, holdCol: string): string {
  const ltDays = cellRef(DETAILED_SHEET, "B", DS_LT_DAYS_ROW);
  return `IF(${instCol}${row}="debt_mutual_fund","Debt-MF",IF(${holdCol}${row}=0,"Intraday",IF(${holdCol}${row}>${ltDays},"LT","ST")))`;
}

function treatmentFormula(classCol: string, row: number): string {
  const c = `${classCol}${row}`;
  return `IF(${c}="Intraday","Slab rate (speculative business income, Sec 43(5))",IF(${c}="ST","20% flat (Sec 111A)",IF(${c}="Debt-MF","Slab rate (debt/specified MF, Sec 50AA)","12.5% flat, no indexation (Sec 112A)")))`;
}

function ruleFlagFormula(classCol: string, row: number): string {
  const c = `${classCol}${row}`;
  return `IF(${c}="Intraday","Business income — taxed with other income at slab rate; losses ring-fenced to speculative gains only (Sec 73)",IF(${c}="ST","Rate raised 15%->20% eff 23-Jul-2024 (FA 2024); no 87A rebate vs this income from AY2026-27 (FA 2025)",IF(${c}="Debt-MF","Short-term-deemed debt MF gain — slab rate (Sec 50AA)","Rate raised 10%->12.5% & exemption Rs1L->Rs1.25L eff 23-Jul-2024 (FA 2024); no 87A rebate vs this income from AY2026-27 (FA 2025)")))`;
}

function toExcelDate(dateText: string): Date | string {
  try {
    return parseFixtureDate(dateText);
  } catch {
    return dateText;
  }
}

function brokerCellValue(value: string | number | undefined): Cell {
  if (value === undefined || value === "") return txt("", C.td);
  if (typeof value === "number") return num(value, C.currency(value));
  const parsed = Number(String(value).replace(/[₹,\s]/g, ""));
  if (!Number.isNaN(parsed) && /^-?[\d₹,.\s]+$/.test(String(value).trim())) {
    return num(parsed, C.currency(parsed));
  }
  return txt(String(value), C.td);
}

export function buildBrokerSheet(
  documentName: string,
  transactions: NormalizedTransaction[],
  financialYear: string,
  sheetNameOverride?: string
): { sheet: string; data: SheetData; meta: BrokerSheetMeta; columns: { width: number }[] } {
  const sheetName = sheetNameOverride ?? sanitizeSheetName(documentName);
  const brokerKeys = brokerColumnKeys(transactions);
  const brokerTaxableKey = findBrokerTaxableColumn(brokerKeys);
  const brokerSpeculativeKey = findBrokerSpeculativeColumn(brokerKeys);
  const nBroker = brokerKeys.length;
  const classColIdx = 11 + nBroker;
  const gainColIdx = classColIdx + 1;
  const varianceColIdx = gainColIdx + 1;
  const treatmentColIdx = varianceColIdx + 1;
  const flagColIdx = treatmentColIdx + 1;
  const classCol = colLetter(classColIdx);
  const gainCol = colLetter(gainColIdx);
  const varianceCol = colLetter(varianceColIdx);
  const treatmentCol = colLetter(treatmentColIdx);
  const flagCol = colLetter(flagColIdx);
  const brokerTaxableCol = brokerTaxableKey
    ? colLetter(11 + brokerKeys.indexOf(brokerTaxableKey))
    : undefined;
  const brokerSpeculativeCol = brokerSpeculativeKey
    ? colLetter(11 + brokerKeys.indexOf(brokerSpeculativeKey))
    : undefined;

  const totalCols = flagColIdx;
  const data: SheetData = [];
  data.push(mergeTitle(emptyRow(totalCols), `${documentName} — Realised Capital Gains, ${financialYear}`, totalCols));
  data.push(
    mergeTitle(
      emptyRow(totalCols),
      `Source: ${documentName} | Columns A–J extracted by Unravel Tax; broker-reported columns preserved; formula columns added for tax working.`,
      totalCols
    )
  );
  data.push(emptyRow(totalCols));

  const headerRow: Row = [
    txt("Scrip Name", C.th),
    txt("Purchase Date", C.th),
    txt("Sell Date", C.th),
    txt("Units", C.th),
    txt("Hold Period (Days)", C.th),
    txt("Buy Value", C.th),
    txt("Sell Value", C.th),
    txt("Buy Price", C.th),
    txt("Sell Price", C.th),
    txt("Instrument Type", C.th),
    ...brokerKeys.map((key) => txt(key, C.th)),
    txt("Classification\n(LT/ST/Intraday)", C.th),
    txt("Computed Gain\n(Sell Value - Buy Value)", C.th),
    txt("Variance vs Broker\nfigure (QA check)", C.th),
    txt("Applicable Tax Treatment", C.th),
    txt("Rule/Law Change Flag", C.th)
  ];
  data.push(headerRow);

  transactions.forEach((tx, i) => {
    const rowNum = BROKER_DATA_START + i;
    // Intraday rows check against the speculative column when the broker
    // reports it separately from taxable capital gains.
    const brokerFigure =
      brokerTaxableCol && brokerSpeculativeCol
        ? `IF(${classCol}${rowNum}="Intraday",${brokerSpeculativeCol}${rowNum},${brokerTaxableCol}${rowNum})`
        : brokerTaxableCol
          ? `${brokerTaxableCol}${rowNum}`
          : undefined;
    const varianceCell: Cell = brokerFigure
      ? f(`${gainCol}${rowNum}-(${brokerFigure})`, C.currency())
      : txt("", C.td);

    const row: Row = [
      txt(tx.scripName, C.td),
      { value: toExcelDate(tx.purchaseDate), type: Date, ...C.date },
      { value: toExcelDate(tx.sellDate), type: Date, ...C.date },
      num(tx.units, C.td),
      num(tx.holdPeriodDays, C.td),
      num(tx.buyValue, C.currency()),
      num(tx.sellValue, C.currency()),
      num(tx.buyPrice, C.currency()),
      num(tx.sellPrice, C.currency()),
      txt(tx.instrumentType, C.td),
      ...brokerKeys.map((key) => brokerCellValue(tx.brokerColumns?.[key])),
      f(classificationFormula(rowNum, "J", "E"), C.td),
      f(`G${rowNum}-F${rowNum}`, C.currency()),
      varianceCell,
      f(treatmentFormula(classCol, rowNum), { ...C.tdWrap }),
      f(ruleFlagFormula(classCol, rowNum), { ...C.tdWrap })
    ];
    data.push(row);
  });

  const dataEndRow = transactions.length > 0 ? BROKER_DATA_START + transactions.length - 1 : BROKER_DATA_START;

  const columns = [
    { width: 26 },
    { width: 13 },
    { width: 13 },
    { width: 9 },
    { width: 10 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    ...brokerKeys.map(() => ({ width: 14 })),
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 34 },
    { width: 52 }
  ];

  return {
    sheet: sheetName,
    data,
    columns,
    meta: {
      name: sheetName,
      dataStartRow: BROKER_DATA_START,
      dataEndRow,
      classCol,
      gainCol,
      brokerTaxableCol,
      brokerSpeculativeCol
    }
  };
}

/**
 * A verbatim reference sheet for a raw upload the tax engine doesn't parse
 * (bank interest, dividend, or MF-holding statements). Rows are preserved as
 * uploaded and no tax working is applied — the sheet exists so the full
 * workbook holds a copy of every document the user gave us.
 */
export function buildRawSheet(
  documentName: string,
  raw: RawSheet,
  sheetNameOverride?: string
): { sheet: string; data: SheetData; columns: { width: number }[] } {
  const sheetName = sheetNameOverride ?? sanitizeSheetName(documentName);
  const headers =
    raw.headers.length > 0
      ? raw.headers
      : Array.from(new Set(raw.records.flatMap((record) => Object.keys(record))));
  const totalCols = Math.max(headers.length, 1);

  const data: SheetData = [];
  data.push(mergeTitle(emptyRow(totalCols), `${documentName} — Reference Copy (not tax-calculated)`, totalCols));
  data.push(
    mergeTitle(
      emptyRow(totalCols),
      `Source: ${documentName} | Rows preserved exactly as uploaded. This is a reference only — no tax working is applied to it.`,
      totalCols
    )
  );
  data.push(emptyRow(totalCols));
  data.push(headers.map((header) => txt(header, C.th)));
  for (const record of raw.records) {
    data.push(headers.map((header) => brokerCellValue(record[header])));
  }

  return {
    sheet: sheetName,
    data,
    columns: headers.map(() => ({ width: 18 }))
  };
}

function sumifAcrossBrokersOn(
  brokers: BrokerSheetMeta[],
  classValue: string,
  valueColOf: (broker: BrokerSheetMeta) => string | undefined
): string {
  const parts = brokers.flatMap((b) => {
    const valueCol = valueColOf(b);
    if (!valueCol) return [];
    const rangeClass = `$${b.classCol}$${b.dataStartRow}:$${b.classCol}$${b.dataEndRow}`;
    const rangeValue = `$${valueCol}$${b.dataStartRow}:$${valueCol}$${b.dataEndRow}`;
    return [`SUMIF(${quoteSheet(b.name)}!${rangeClass},"${classValue}",${quoteSheet(b.name)}!${rangeValue})`];
  });
  return parts.length > 0 ? parts.join("+") : "0";
}

function sumifAcrossBrokers(brokers: BrokerSheetMeta[], classValue: string): string {
  return sumifAcrossBrokersOn(brokers, classValue, (b) => b.gainCol);
}

export function buildDetailedSummarySheet(
  brokers: BrokerSheetMeta[],
  rates: RateInputs,
  financialYear: string,
  assessmentYear: string
): { data: SheetData; columns: { width: number }[] } {
  const data: SheetData = [];
  const cols = 9;
  const anyBrokerReported = brokers.some((b) => b.brokerTaxableCol);
  // Broker sheets keep extracted values in fixed columns: F = Buy Value
  // (cost), G = Sell Value (sale proceeds).
  const classRow = (
    assetClass: string,
    incomeHead: string,
    section: string,
    classValue: string,
    treatment: string,
    rowNum: number
  ): Row => [
    txt(assetClass, C.td),
    txt(incomeHead, C.td),
    txt(section, C.td),
    f(sumifAcrossBrokersOn(brokers, classValue, () => "G"), C.currency()),
    f(sumifAcrossBrokersOn(brokers, classValue, () => "F"), C.currency()),
    f(`D${rowNum}-E${rowNum}`, C.currencyBold()),
    anyBrokerReported
      ? f(
          sumifAcrossBrokersOn(brokers, classValue, (b) =>
            classValue === "Intraday" ? b.brokerSpeculativeCol ?? b.brokerTaxableCol : b.brokerTaxableCol
          ),
          C.currency()
        )
      : txt("—", C.td),
    anyBrokerReported ? f(`F${rowNum}-G${rowNum}`, C.currency()) : txt("—", C.td),
    txt(treatment, { ...C.tdWrap })
  ];

  data.push(mergeTitle(emptyRow(cols), "Unravel Tax — Detailed Tax Working (Internal)", cols));
  data.push(
    mergeTitle(
      emptyRow(cols),
      `${financialYear} (${assessmentYear}). Rates seeded from rules JSON — edit yellow cells to override. Gain/(Loss) is always Total Sale Value minus Total Cost; the Variance column checks it against the broker's own reported figure and should be zero (or explainable, e.g. the broker netting charges).`,
      cols
    )
  );
  data.push(emptyRow(cols));
  data.push(mergeTitle(emptyRow(cols), "By Asset Class & Income Head", cols));
  data.push([
    txt("Asset Class", C.th),
    txt("Income Head", C.th),
    txt("Section", C.th),
    txt("Total Sale Value ₹", C.th),
    txt("Total Cost ₹", C.th),
    txt("Gain/(Loss) ₹\n(Sale − Cost)", C.th),
    txt("Broker-reported ₹\n(check value)", C.th),
    txt("Variance ₹\n(should be 0)", C.th),
    txt("Treatment this FY", C.th)
  ]);
  data.push(
    classRow(
      "Equity",
      "Speculative / Intraday",
      "43(5)",
      "Intraday",
      "Business income — taxed at your slab rate with other income.",
      DS_INTRADAY_ROW
    )
  );
  data.push(
    classRow(
      "Equity",
      "Short-Term Capital Gains",
      "111A",
      "ST",
      "20% flat if net gain. Net loss carries forward 8 AYs if ITR filed on time.",
      DS_STCG_ROW
    )
  );
  data.push(
    classRow(
      "Equity",
      "Long-Term Capital Gains",
      "112A",
      "LT",
      "12.5% flat above exemption if net gain. Net loss carries forward 8 AYs for future LTCG only.",
      DS_LTCG_ROW
    )
  );
  data.push(
    classRow(
      "Mutual Funds / Debt",
      "Debt/specified MF (Sec 50AA)",
      "50AA",
      "Debt-MF",
      "Short-term-deemed, taxed at slab rate — not the equity 111A/112A rates.",
      DS_DEBT_ROW
    )
  );
  data.push(emptyRow(cols));
  data.push(mergeTitle(emptyRow(cols), "Rate inputs (from rules)", cols));
  data.push([txt("LT holding period (days >)", C.td), num(rates.ltHoldingDays, C.inputNum), null, null, null, null]);
  data.push([txt("STCG rate (Sec 111A)", C.td), num(rates.stcgRate, C.inputPct), null, null, null, null]);
  data.push([txt("LTCG rate (Sec 112A)", C.td), num(rates.ltcgRate, C.inputPct), null, null, null, null]);
  data.push([txt("LTCG exemption (INR)", C.td), num(rates.ltcgExemptionInr, { ...C.inputNum, format: FMT_CURRENCY }), null, null, null, null]);
  data.push([txt("Surcharge cap on 111A/112A gains", C.td), num(rates.surchargeCapRate, C.inputPct), null, null, null, null]);
  data.push([txt("Health & Education Cess rate", C.td), num(rates.healthEducationCessRate, C.inputPct), null, null, null, null]);

  while (data.length < DS_NET_LTCG_ROW - 2) data.push(emptyRow(cols));
  data.push(mergeTitle(emptyRow(cols), "Tax Estimate — Equity (all brokers)", cols));

  const dLtcg = `F${DS_LTCG_ROW}`;
  const dStcg = `F${DS_STCG_ROW}`;
  const dIntra = `F${DS_INTRADAY_ROW}`;
  const bExempt = `B${DS_LTCG_EXEMPT_ROW}`;
  const bLtcgRate = `B${DS_LTCG_RATE_ROW}`;
  const bStcgRate = `B${DS_STCG_RATE_ROW}`;
  const bSurcharge = `B${DS_SURCHARGE_ROW}`;
  const bCess = `B${DS_CESS_ROW}`;

  data.push([txt("Net LTCG this year — Equity", C.td), f(dLtcg, C.currency()), null, null, null, null]);
  data.push([txt("LTCG exemption available (Sec 112A)", C.td), f(bExempt, { ...C.inputNum, format: FMT_CURRENCY }), null, null, null, null]);
  data.push([txt("Taxable LTCG", C.td), f(`MAX(0,${dLtcg}-${bExempt})`, C.currency()), null, null, null, null]);
  data.push([txt("LTCG loss arising this year (carry forward)", C.td), f(`IF(${dLtcg}<0,-${dLtcg},0)`, C.currency()), null, null, null, null]);
  data.push([txt("LTCG tax rate", C.td), f(bLtcgRate, C.inputPct), null, null, null, null]);
  data.push([txt("LTCG tax (before cess/surcharge)", C.td), f(`B${DS_TAXABLE_LTCG_ROW}*${bLtcgRate}`, C.currency()), null, null, null, null]);
  data.push(emptyRow(cols));
  data.push([txt("Net STCG this year — Equity", C.td), f(dStcg, C.currency()), null, null, null, null]);
  data.push([txt("Taxable STCG", C.td), f(`MAX(0,${dStcg})`, C.currency()), null, null, null, null]);
  data.push([txt("STCG loss arising this year (carry forward)", C.td), f(`IF(${dStcg}<0,-${dStcg},0)`, C.currency()), null, null, null, null]);
  data.push([txt("STCG tax rate", C.td), f(bStcgRate, C.inputPct), null, null, null, null]);
  data.push([txt("STCG tax (before cess/surcharge)", C.td), f(`B${DS_TAXABLE_STCG_ROW}*${bStcgRate}`, C.currency()), null, null, null, null]);
  data.push(emptyRow(cols));
  data.push([txt("Speculative/intraday gain — Equity", C.td), f(dIntra, C.currency()), null, null, null, null]);
  data.push([txt("Net speculative income (indicative)", C.td), f(dIntra, C.currency()), null, null, null, null]);
  data.push([
    txt("Applicable slab rate — enter once total income is known", C.td),
    num(0, C.inputPct),
    txt("Broker reports often assume ~30% — enter your real marginal slab rate.", C.note),
    null,
    null,
    null
  ]);
  data.push([txt("Speculative income tax (indicative)", C.td), f(`MAX(0,B${DS_SPEC_NET_ROW})*B${DS_SLAB_RATE_ROW}`, C.currency()), null, null, null, null]);
  data.push(emptyRow(cols));
  data.push([
    txt("Subtotal — LTCG + STCG + Speculative tax", C.total),
    f(`B${DS_LTCG_TAX_ROW}+B${DS_STCG_TAX_ROW}+B${DS_SPEC_TAX_ROW}`, C.currencyBold()),
    null,
    null,
    null,
    null
  ]);
  data.push([txt("Surcharge rate (capped on 111A/112A)", C.td), f(bSurcharge, C.inputPct), null, null, null, null]);
  data.push([txt("Surcharge amount", C.td), f(`(B${DS_LTCG_TAX_ROW}+B${DS_STCG_TAX_ROW})*${bSurcharge}`, C.currency()), null, null, null, null]);
  data.push([txt("Health & Education Cess rate", C.td), f(bCess, C.inputPct), null, null, null, null]);
  data.push([txt("Health & Education Cess", C.td), f(`(B${DS_SUBTOTAL_TAX_ROW}+B${DS_SURCHARGE_AMT_ROW})*${bCess}`, C.currency()), null, null, null, null]);
  data.push([
    txt("ESTIMATED TOTAL TAX — Equity only", { ...C.total, backgroundColor: "#FCE4EC" }),
    f(`B${DS_SUBTOTAL_TAX_ROW}+B${DS_SURCHARGE_AMT_ROW}+B${DS_CESS_AMT_ROW}`, { ...C.currencyBold(), backgroundColor: "#FCE4EC" }),
    null,
    null,
    null,
    null
  ]);

  return {
    data,
    columns: [
      { width: 34 },
      { width: 24 },
      { width: 10 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 44 }
    ]
  };
}

function caAmountCell(amount: number | string, linked = false): Cell {
  if (linked && typeof amount === "number") {
    return num(amount, { ...C.currency(amount), format: FMT_CURRENCY });
  }
  if (typeof amount === "number") {
    return num(amount, { ...C.currency(amount), format: FMT_CURRENCY });
  }
  return txt(amount, C.td);
}

export function buildLinkedCaSummarySheet(
  rows: CaSummaryRow[],
  financialYear: string,
  assessmentYear: string
): SheetData {
  const data: SheetData = [];
  const span = 4;
  data.push(mergeTitle(emptyRow(span), `Unravel Tax — ${financialYear} (${assessmentYear}) — Summary of Income for Filing`, span));
  data.push(
    mergeTitle(
      emptyRow(span),
      "Prepared for CA review — capital gains figures link to Detailed Summary; other heads from your entries in the app.",
      span
    )
  );
  data.push(emptyRow(span));
  data.push(mergeTitle(emptyRow(span), "Capital Gains — Equity", span));
  data.push([txt("Head", C.th), txt("Section", C.th), txt("Amount ₹", C.th), null]);

  const equityHeads: { label: string; section: string; row: number }[] = [
    { label: "Speculative / Intraday (business income)", section: "43(5)", row: DS_INTRADAY_ROW },
    { label: "Short-Term Capital Gains", section: "111A", row: DS_STCG_ROW },
    { label: "Long-Term Capital Gains", section: "112A", row: DS_LTCG_ROW }
  ];
  const equityStart = data.length + 1;
  for (const h of equityHeads) {
    data.push([
      txt(h.label, C.td),
      txt(h.section, C.td),
      f(cellRef(DETAILED_SHEET, "F", h.row), C.currency()),
      null
    ]);
  }
  const equityEnd = data.length;
  data.push([
    txt("Equity Total", C.total),
    txt("", C.total),
    f(`SUM(C${equityStart}:C${equityEnd})`, C.currencyBold()),
    null
  ]);
  data.push(emptyRow(span));

  const debtRow = rows.find((r) => r.head.includes("Debt"));
  if (debtRow) {
    data.push(mergeTitle(emptyRow(span), "Capital Gains — Mutual Funds / Debt", span));
    data.push([txt("Head", C.th), txt("Section", C.th), txt("Amount ₹", C.th), null]);
    data.push([
      txt(debtRow.head, C.td),
      txt(debtRow.ruleSection, C.td),
      f(cellRef(DETAILED_SHEET, "F", DS_DEBT_ROW), C.currency()),
      null
    ]);
    data.push(emptyRow(span));
  }

  // Totals and the sale-minus-cost check, linked to the Detailed Summary's
  // per-class Sale/Cost columns so a CA can trace every figure.
  const saleRange = `SUM(${quoteSheet(DETAILED_SHEET)}!$D$${DS_INTRADAY_ROW}:$D$${DS_DEBT_ROW})`;
  const costRange = `SUM(${quoteSheet(DETAILED_SHEET)}!$E$${DS_INTRADAY_ROW}:$E$${DS_DEBT_ROW})`;
  data.push(mergeTitle(emptyRow(span), "Totals & check", span));
  data.push([txt("Head", C.th), txt("Section", C.th), txt("Amount ₹", C.th), null]);
  const totalsStart = data.length + 1;
  data.push([txt("Total sale value (all documents)", C.td), txt("Totals", C.td), f(saleRange, C.currency()), null]);
  data.push([txt("Total cost of purchase (all documents)", C.td), txt("Totals", C.td), f(costRange, C.currency()), null]);
  data.push([
    txt("Combined gain/(loss) — sale minus cost", C.total),
    txt("Check", C.total),
    f(`C${totalsStart}-C${totalsStart + 1}`, C.currencyBold()),
    null
  ]);
  data.push(emptyRow(span));

  const supplemental = rows.filter(
    (r) =>
      !r.head.includes("Speculative") &&
      !r.head.includes("Short-Term Capital") &&
      !r.head.includes("Long-Term Capital") &&
      !r.head.includes("Debt") &&
      r.ruleSection !== "Totals"
  );

  if (supplemental.length > 0) {
    data.push(mergeTitle(emptyRow(span), "Other income & recommendations", span));
    data.push([txt("Head", C.th), txt("Section", C.th), txt("Amount / Value", C.th), txt("Notes", C.th)]);
    for (const row of supplemental) {
      data.push([
        txt(row.head, C.td),
        txt(row.ruleSection, C.td),
        caAmountCell(row.amount),
        txt(row.notes, C.note)
      ]);
    }
  }

  return data;
}

/** Sheet name a later year's Unravel Tax session looks for when importing this workbook - see lib/workbookImport.ts. */
export const ORIENTATION_SHEET_NAME = "Orientation";

function yesNoOrBlank(value: boolean | null): string {
  return value === null ? "" : value ? "Yes" : "No";
}

/**
 * Plain key/value rows for every orientation answer, written with literal
 * text values (never formulas) so a later year's Unravel Tax session can
 * read this sheet back and prefill the same profile - see
 * lib/workbookImport.ts. Genuinely optional: older workbooks exported before
 * this sheet existed simply don't have it, and the importer treats that as
 * "no profile to prefill" rather than an error.
 */
export function buildOrientationSheet(orientation: OrientationAnswers): SheetData {
  const data: SheetData = [];
  const span = 2;
  data.push(mergeTitle(emptyRow(span), "Your profile answers, for next year's Unravel Tax filing to read back", span));
  data.push([txt("Field", C.th), txt("Value", C.th)]);
  const rows: [string, string][] = [
    ["Residency", orientation.residency ?? ""],
    ["NRI Country", orientation.nriCountry ?? ""],
    ["NRI Days In India", orientation.nriDaysInIndia === null ? "" : String(orientation.nriDaysInIndia)],
    ["HUF", yesNoOrBlank(orientation.huf)],
    ["Senior Citizen", yesNoOrBlank(orientation.seniorCitizen)],
    ["Super Senior Citizen (80+)", yesNoOrBlank(orientation.superSeniorCitizen)],
    ["Single Parent Or Sole Guardian", yesNoOrBlank(orientation.singleParent)],
    ["Income Sources", orientation.incomeSources.join(", ")],
    ["Multiple Employers", yesNoOrBlank(orientation.multipleEmployers)],
    ["HRA Claimed", yesNoOrBlank(orientation.hraClaimed)],
    ["HRA Above Threshold", yesNoOrBlank(orientation.hraAboveThreshold)],
    ["Has Landlord PAN", yesNoOrBlank(orientation.hasLandlordPan)],
    ["EPF Withdrawal", yesNoOrBlank(orientation.epfWithdrawal)],
    ["EPF Before Five Years", yesNoOrBlank(orientation.epfBeforeFiveYears)],
    ["Loans Repaid", yesNoOrBlank(orientation.loansRepaid)],
    ["Insurance Payout", yesNoOrBlank(orientation.insurancePayout)],
    ["Foreign Assets", yesNoOrBlank(orientation.foreignAssets)]
  ];
  for (const [field, value] of rows) {
    data.push([txt(field, C.td), txt(value, C.td)]);
  }
  return data;
}

/** Sheet name for the Schedule FA Phase 1 disclosure rows (foreign depository/custodial accounts). */
export const SCHEDULE_FA_SHEET_NAME = "Schedule FA (Phase 1)";

const ACCOUNT_TYPE_SHEET_LABELS: Record<ForeignAccount["accountType"], string> = {
  depository: "A1 - Depository (bank)",
  custodial: "A2 - Custodial (brokerage)"
};

/**
 * Disclosure rows only for foreign bank/brokerage accounts (Schedule FA
 * tables A1/A2 combined) - literal values, no formulas, for a CA to place
 * into the actual schedule. Does not compute Indian tax on the interest
 * shown; see rules/foreign-investments.md and docs/DESIGN-remaining-gaps.md
 * for why the rest of Schedule FA (RSUs, foreign property, trusts, and the
 * tax computation itself) is out of scope for this phase.
 */
export function buildScheduleFaSheet(accounts: ForeignAccount[], disclosureCalendarYear: number): SheetData {
  const data: SheetData = [];
  const span = 7;
  data.push(
    mergeTitle(
      emptyRow(span),
      `Schedule FA Phase 1 - foreign accounts held at any point in calendar year ${disclosureCalendarYear} (Jan-Dec)`,
      span
    )
  );
  data.push(
    mergeTitle(
      emptyRow(span),
      "Disclosure rows only, for your CA to place into the actual schedule - this does not compute Indian tax on the interest shown.",
      span
    )
  );
  data.push([
    txt("Table", C.th),
    txt("Country", C.th),
    txt("Institution", C.th),
    txt("Account Number", C.th),
    txt(`Peak Balance (INR)`, C.th),
    txt("Closing Balance 31-Dec (INR)", C.th),
    txt("Gross Interest/Income (INR)", C.th)
  ]);
  for (const account of accounts) {
    data.push([
      txt(ACCOUNT_TYPE_SHEET_LABELS[account.accountType], C.td),
      txt(account.country, C.td),
      txt(account.institutionName, C.td),
      txt(account.accountNumber, C.td),
      num(account.peakBalanceInr, C.td),
      num(account.closingBalanceInr, C.td),
      num(account.grossInterestInr, C.td)
    ]);
  }
  return data;
}

export function buildStandaloneCaSummarySheet(
  rows: CaSummaryRow[],
  financialYear: string,
  assessmentYear: string
): SheetData {
  const data: SheetData = [];
  const span = 4;
  data.push(mergeTitle(emptyRow(span), `Unravel Tax — ${financialYear} (${assessmentYear}) — Summary of Income for Filing`, span));
  data.push(mergeTitle(emptyRow(span), "Prepared for CA review — figures from your filing session.", span));
  data.push(emptyRow(span));
  data.push([txt("Head", C.th), txt("Section", C.th), txt("Amount ₹", C.th), txt("Notes", C.th)]);
  for (const row of rows) {
    data.push([
      txt(row.head, C.td),
      txt(row.ruleSection, C.td),
      caAmountCell(row.amount),
      txt(row.notes, C.note)
    ]);
  }
  return data;
}
