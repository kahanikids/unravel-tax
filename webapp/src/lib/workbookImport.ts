import readXlsxFile from "read-excel-file/universal";
import { ORIENTATION_SHEET_NAME } from "./workbookExport";
import type { IncomeSource, NriCountry, OrientationAnswers } from "../state/types";

type ExcelCell = string | number | Date | boolean | null;

export type PreviousWorkbookImport = {
  /** Only the fields the "Orientation" sheet had a recognisable value for - null when that sheet doesn't exist at all (a workbook exported before it was added). */
  orientation: Partial<OrientationAnswers> | null;
  carryForwardLossesAvailable: number | null;
  dividends: number | null;
  interestOtherIncome: number | null;
  /** True once at least one figure or orientation answer was actually found, so the caller can tell "nothing to import" from "file didn't parse". */
  foundAnything: boolean;
  warnings: string[];
};

const INCOME_SOURCE_VALUES: IncomeSource[] = [
  "salary_pension",
  "bank_interest",
  "capital_gains",
  "dividends",
  "rent",
  "other"
];

function toYesNo(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

function toText(cell: ExcelCell): string {
  return cell === null || cell === undefined ? "" : String(cell).trim();
}

function toAmount(cell: ExcelCell): number | null {
  if (typeof cell === "number") {
    return cell;
  }
  if (typeof cell === "string") {
    const cleaned = cell.replace(/[₹,\s]/g, "");
    const parsed = Number(cleaned);
    return cleaned && !Number.isNaN(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Every field is set only when the sheet actually had a recognisable value
 * for it - a blank/unanswered row and a missing row both simply leave the
 * key absent, so applyPreviousWorkbookToOrientation never "fills" a field
 * with a guessed No/false.
 */
function parseOrientationSheet(data: ExcelCell[][]): Partial<OrientationAnswers> {
  const fields = new Map<string, string>();
  for (const row of data) {
    const field = toText(row[0]);
    if (field && field !== "Field") {
      fields.set(field, toText(row[1]));
    }
  }

  const orientation: Partial<OrientationAnswers> = {};
  const setYesNo = (field: string, key: keyof OrientationAnswers) => {
    const value = fields.get(field);
    if (value) {
      const parsed = toYesNo(value);
      if (parsed !== null) {
        (orientation as Record<string, boolean>)[key] = parsed;
      }
    }
  };

  const residencyText = fields.get("Residency");
  if (residencyText === "resident" || residencyText === "nri") {
    orientation.residency = residencyText;
  }
  const nriCountryText = fields.get("NRI Country");
  if (nriCountryText) {
    orientation.nriCountry = nriCountryText as NriCountry;
  }
  const daysText = fields.get("NRI Days In India");
  if (daysText) {
    const days = Number(daysText);
    if (!Number.isNaN(days)) {
      orientation.nriDaysInIndia = days;
    }
  }
  const incomeSourcesText = fields.get("Income Sources");
  if (incomeSourcesText) {
    const sources = incomeSourcesText
      .split(",")
      .map((source) => source.trim())
      .filter((source): source is IncomeSource =>
        (INCOME_SOURCE_VALUES as string[]).includes(source)
      );
    if (sources.length > 0) {
      orientation.incomeSources = sources;
    }
  }
  setYesNo("HUF", "huf");
  setYesNo("Senior Citizen", "seniorCitizen");
  setYesNo("Super Senior Citizen (80+)", "superSeniorCitizen");
  setYesNo("Single Parent Or Sole Guardian", "singleParent");
  setYesNo("Multiple Employers", "multipleEmployers");
  setYesNo("HRA Claimed", "hraClaimed");
  setYesNo("HRA Above Threshold", "hraAboveThreshold");
  setYesNo("Has Landlord PAN", "hasLandlordPan");
  setYesNo("EPF Withdrawal", "epfWithdrawal");
  setYesNo("EPF Before Five Years", "epfBeforeFiveYears");
  setYesNo("Loans Repaid", "loansRepaid");
  setYesNo("Insurance Payout", "insurancePayout");
  setYesNo("Foreign Assets", "foreignAssets");

  return orientation;
}

function parseCaSummaryFigures(data: ExcelCell[][]) {
  let carryForwardLossesAvailable: number | null = null;
  let dividends: number | null = null;
  let interestOtherIncome: number | null = null;
  for (const row of data) {
    const head = toText(row[0]);
    // The linked Full Workbook's CA Summary spreads Head/Section/Amount
    // across columns 0/1/2; the standalone CA Summary uses the same layout.
    const amount = toAmount(row[2]);
    if (amount === null) {
      continue;
    }
    if (head === "Carry-forward losses available") {
      carryForwardLossesAvailable = amount;
    } else if (head === "Dividends") {
      dividends = amount;
    } else if (head === "Interest & other income") {
      interestOtherIncome = amount;
    }
  }
  return { carryForwardLossesAvailable, dividends, interestOtherIncome };
}

/**
 * Reads a previously exported Unravel Tax Full Workbook (or standalone CA
 * Summary XLSX) to prefill this year's filing: the profile answers from its
 * "Orientation" sheet (only present in a workbook exported after that sheet
 * was added - older exports simply have nothing to prefill from) and the
 * carry-forward-loss/dividend/interest figures from its "CA Summary" sheet,
 * which uses plain literal values for every row except the capital-gains
 * heads (see workbookExport.ts's buildLinkedCaSummarySheet), so it's safe to
 * read back without evaluating any spreadsheet formulas.
 */
export async function parsePreviousWorkbook(buffer: ArrayBuffer): Promise<PreviousWorkbookImport> {
  const warnings: string[] = [];
  let sheets: { sheet: string; data: ExcelCell[][] }[];
  try {
    sheets = (await readXlsxFile(new Blob([buffer]))) as { sheet: string; data: ExcelCell[][] }[];
  } catch {
    return {
      orientation: null,
      carryForwardLossesAvailable: null,
      dividends: null,
      interestOtherIncome: null,
      foundAnything: false,
      warnings: [
        "Couldn't read this file as an Excel workbook. Make sure it's the .xlsx file Unravel Tax exported."
      ]
    };
  }

  const orientationSheet = sheets.find((sheet) => sheet.sheet === ORIENTATION_SHEET_NAME);
  const orientation = orientationSheet ? parseOrientationSheet(orientationSheet.data) : null;
  if (!orientationSheet) {
    warnings.push(
      "No \"Orientation\" sheet found, so your profile answers couldn't be prefilled - this happens with a workbook exported before that sheet existed. You'll still need to answer the profile questions yourself."
    );
  }

  const caSummarySheet = sheets.find((sheet) => sheet.sheet === "CA Summary");
  const figures = caSummarySheet
    ? parseCaSummaryFigures(caSummarySheet.data)
    : { carryForwardLossesAvailable: null, dividends: null, interestOtherIncome: null };
  if (!caSummarySheet) {
    warnings.push('No "CA Summary" sheet found, so no figures could be read from this file.');
  }

  const foundAnything =
    Boolean(orientation && Object.keys(orientation).length > 0) ||
    figures.carryForwardLossesAvailable !== null ||
    figures.dividends !== null ||
    figures.interestOtherIncome !== null;

  return { orientation, ...figures, foundAnything, warnings };
}

/**
 * Merges a previous workbook's import into the current orientation, filling
 * only fields still at their blank default - the same never-clobber-what-
 * you-already-typed rule as applySummaryFiguresToSupplemental, so importing
 * after you've already answered some questions never overwrites your own
 * answers.
 */
export function applyPreviousWorkbookToOrientation(
  current: OrientationAnswers,
  imported: Partial<OrientationAnswers> | null
): OrientationAnswers {
  if (!imported) {
    return current;
  }
  const next = { ...current };
  for (const key of Object.keys(imported) as (keyof OrientationAnswers)[]) {
    const currentValue = current[key];
    const isBlank =
      currentValue === null || (Array.isArray(currentValue) && currentValue.length === 0);
    if (isBlank) {
      (next as Record<string, unknown>)[key] = imported[key];
    }
  }
  return next;
}
