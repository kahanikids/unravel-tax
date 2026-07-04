export type IncomeSource = "salary_pension" | "bank_interest" | "capital_gains" | "dividends" | "rent" | "other";

/** Country of tax residence when residency is "nri". Drives DTAA MF treatment lookup in rules/nri-dtaa.json. */
export type NriCountry =
  | "Singapore"
  | "United Arab Emirates"
  | "United States"
  | "United Kingdom"
  | "Canada"
  | "Australia"
  | "Saudi Arabia"
  | "Germany"
  | "Malaysia"
  | "Kuwait"
  | "Oman"
  | "Qatar"
  | "Italy"
  | "Nepal"
  | "Philippines"
  | "Hong Kong"
  | "Other"
  | null;

export type YesNo = "yes" | "no";

export type OrientationAnswers = {
  residency: "resident" | "nri" | null;
  /** Where you are a tax resident. Only asked when residency is "nri". */
  nriCountry: NriCountry;
  /** NRI only. Days physically in India this financial year, reported on the return. Skippable. */
  nriDaysInIndia: number | null;
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
  loansRepaid: boolean | null;
  /** Received a life-insurance maturity/survival payout this year. Flags the Section 10(10D) taxability question. */
  insurancePayout: boolean | null;
  /** Resident only. Holds any asset outside India (foreign shares, RSUs, ESPP, foreign accounts/property). Forces Schedule FA / ITR-2. */
  foreignAssets: boolean | null;
};

export const BLANK_ORIENTATION: OrientationAnswers = {
  residency: null,
  nriCountry: null,
  nriDaysInIndia: null,
  huf: null,
  seniorCitizen: null,
  singleParent: null,
  incomeSources: [],
  multipleEmployers: null,
  hraClaimed: null,
  hraAboveThreshold: null,
  hasLandlordPan: null,
  epfWithdrawal: null,
  epfBeforeFiveYears: null,
  loansRepaid: null,
  insurancePayout: null,
  foreignAssets: null
};

export type ProfileFlags = {
  nri: boolean;
  nriCountry: NriCountry;
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
  hasLoans: boolean;
  hasInsurancePayout: boolean;
  hasForeignAssets: boolean;
};

export type AppStep = "welcome" | "orientation" | "documents" | "results";

export const STEP_ORDER: AppStep[] = ["welcome", "orientation", "documents", "results"];

export const STEP_LABELS: Record<AppStep, string> = {
  welcome: "Start",
  orientation: "About You",
  documents: "Add Documents",
  results: "Current Filing"
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
  /** NRI only. Interest on an NRE account, exempt under Section 10(4)(ii), kept out of interestOtherIncome above. */
  nreExemptInterest: number;
  /** Single parent/guardian only. Minor's income before the Section 10(32) per-child exemption. */
  minorIncomeToClub: number;
  /** Single parent/guardian only. Number of minor children with income to club (exemption caps out at 2). */
  numberOfMinors: number;
  /** Only used for the optional Section 234B advance-tax interest estimate. */
  advanceTaxLiability: number;
  /** Only used for the optional Section 234B advance-tax interest estimate: TDS + instalments already paid. */
  advanceTaxPaid: number;
  /** Old-regime only. Amount claimed under Section 80C (limit read from rules/deduction-limits.json). Drives the dashboard 80C progress bar. */
  deduction80C: number;
  /** Old-regime only. Amount claimed under Section 80D health insurance. Drives the dashboard 80D progress bar. */
  deduction80D: number;
  /** Old-regime only. Extra NPS contribution under Section 80CCD(1B). Drives the dashboard NPS progress bar. */
  deductionNps80ccd1b: number;
  /** Old-regime only. Home-loan interest on a self-occupied home (Section 24(b), capped at the rule's limit). */
  homeLoanInterestSelfOccupied: number;
  /** Old-regime only. First-time-buyer home-loan interest top-up (Section 80EEA, capped), over and above 24(b). */
  homeLoanInterest80eea: number;
  /** Old-regime only. Education-loan interest (Section 80E, no cap). */
  educationLoanInterest80e: number;
  /** Old-regime only. Electric-vehicle-loan interest (Section 80EEB, capped). */
  evLoanInterest80eeb: number;
  /** Aggregate annual life-insurance premium across policies, checked against the Section 10(10D) exemption caps (ULIP ₹2.5L / traditional ₹5L, read from rules/insurance.json). Planning figure only - not folded into taxable income, since the exact payout taxability needs the policy's issue date and sum-assured history. */
  insuranceAnnualPremium: number;
  /** Resident only. Total money sent abroad this year under the LRS, checked against the Section 206C(1G) TCS threshold (read from rules/foreign-investments.json). Planning figure only; the TCS is a prepaid credit, not a cost. */
  foreignRemittanceLrs: number;
};

export const BLANK_SUPPLEMENTAL_FIGURES: SupplementalFigures = {
  dividends: 0,
  interestOtherIncome: 0,
  eligibleInterestDeduction: 0,
  deductibleTransactionCharges: 0,
  carryForwardLossesAvailable: 0,
  salaryIncome: 0,
  oldRegimeDeductions: 0,
  nreExemptInterest: 0,
  minorIncomeToClub: 0,
  numberOfMinors: 0,
  advanceTaxLiability: 0,
  advanceTaxPaid: 0,
  deduction80C: 0,
  deduction80D: 0,
  deductionNps80ccd1b: 0,
  homeLoanInterestSelfOccupied: 0,
  homeLoanInterest80eea: 0,
  educationLoanInterest80e: 0,
  evLoanInterest80eeb: 0,
  insuranceAnnualPremium: 0,
  foreignRemittanceLrs: 0
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
