export type IncomeSource = "salary_pension" | "bank_interest" | "capital_gains" | "dividends" | "rent" | "other";

export type YesNo = "yes" | "no";

export type OrientationAnswers = {
  residency: "resident" | "nri" | null;
  huf: boolean | null;
  seniorCitizen: boolean | null;
  singleParent: boolean | null;
  incomeSources: IncomeSource[];
  multipleEmployers: boolean | null;
  hraClaimed: boolean | null;
  hraAboveThreshold: boolean | null;
  hasLandlordPan: boolean | null;
  epfWithdrawal: boolean | null;
  epfBeforeFiveYears: boolean | null;
};

export const BLANK_ORIENTATION: OrientationAnswers = {
  residency: null,
  huf: null,
  seniorCitizen: null,
  singleParent: null,
  incomeSources: [],
  multipleEmployers: null,
  hraClaimed: null,
  hraAboveThreshold: null,
  hasLandlordPan: null,
  epfWithdrawal: null,
  epfBeforeFiveYears: null
};

export type ProfileFlags = {
  nri: boolean;
  huf: boolean;
  seniorCitizen: boolean;
  singleParent: boolean;
  hasCapitalGains: boolean;
  hasDividends: boolean;
  hasBankInterest: boolean;
  hasRent: boolean;
  multipleEmployers: boolean;
  hraRisk: boolean;
  epfRisk: boolean;
};

export type AppStep = "welcome" | "orientation" | "checklist" | "documents" | "results";

export const STEP_ORDER: AppStep[] = ["welcome", "orientation", "checklist", "documents", "results"];

export const STEP_LABELS: Record<AppStep, string> = {
  welcome: "Start",
  orientation: "About you",
  checklist: "Your checklist",
  documents: "Add documents",
  results: "Your results"
};

export type SupplementalFigures = {
  dividends: number;
  interestOtherIncome: number;
  eligibleInterestDeduction: number;
  deductibleTransactionCharges: number;
  carryForwardLossesAvailable: number;
  /** Gross salary/pension income, before standard deduction. Only used for the optional regime comparison. */
  salaryIncome: number;
  /** Lump sum of 80C, 80D, HRA, home loan interest, and similar. Old regime only, only used for the optional regime comparison. */
  oldRegimeDeductions: number;
};

export const BLANK_SUPPLEMENTAL_FIGURES: SupplementalFigures = {
  dividends: 0,
  interestOtherIncome: 0,
  eligibleInterestDeduction: 0,
  deductibleTransactionCharges: 0,
  carryForwardLossesAvailable: 0,
  salaryIncome: 0,
  oldRegimeDeductions: 0
};

/**
 * What your AIS, Form 26AS, or Form 16 says, for a manual side-by-side check
 * against the calculated figures above. `null` means "not entered yet", kept
 * distinct from 0 (AIS reports a real zero) so an empty field never shows as
 * a false mismatch.
 */
export type AisReportedFigures = {
  dividends: number | null;
  interestOtherIncome: number | null;
};

export const BLANK_AIS_REPORTED_FIGURES: AisReportedFigures = {
  dividends: null,
  interestOtherIncome: null
};
