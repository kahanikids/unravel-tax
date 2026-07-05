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
  /** Only asked when seniorCitizen is true. Picks the old-regime super-senior (80+) slab instead of the 60-79 one. */
  superSeniorCitizen: boolean | null;
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
  superSeniorCitizen: null,
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
  superSeniorCitizen: boolean;
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

/**
 * Why the money went abroad, for the Section 206C(1G) TCS rate branch:
 * investment/gift/other collects 20% above the threshold, education or
 * medical 2%, and an education-loan-funded remittance collects nothing.
 * Rates and threshold read from rules/foreign-investments.json.
 */
export type RemittancePurpose = "investment_gift_other" | "education_medical" | "education_loan_funded";

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
  /** NRI only. TDS actually withheld on the NRO interest in interestOtherIncome (Section 195), for the treaty-rate reconciliation. */
  nriNroInterestTdsWithheld: number;
  /** NRI only. TDS actually withheld on the dividends figure above (Section 115A), for the treaty-rate reconciliation. */
  nriDividendTdsWithheld: number;
  /** NRI only. Cumulative NRO repatriation this financial year, in USD, checked against the USD 1 million annual cap. Planning figure only - doesn't touch any tax number. */
  nriRepatriatedThisYearUsd: number;
  /** NRI only. The same cumulative repatriation in rupees, checked against the ₹5 lakh CA-certificate threshold. Entered separately rather than converted, since this tool doesn't fetch a live exchange rate. */
  nriRepatriatedThisYearInr: number;
  /** Single parent/guardian only. Minor's income before the Section 10(32) per-child exemption. */
  minorIncomeToClub: number;
  /** Single parent/guardian only. Portion of the minor's income Section 64(1A) never clubs (their own manual work, own skill/talent, or an 80U disability), left out before the exemption. */
  minorIncomeExemptFromClubbing: number;
  /** Single parent/guardian only. Number of minor children with income to club (exemption caps out at 2). */
  numberOfMinors: number;
  /** Only used for the optional Section 234B/234C advance-tax interest estimates. */
  advanceTaxLiability: number;
  /** Only used for the optional Section 234B/234C advance-tax interest estimates: TDS + instalments already paid. */
  advanceTaxPaid: number;
  /** Advance tax actually paid in each Section 234C instalment window (by 15 Jun / 15 Sep / 15 Dec / 15 Mar), excluding TDS. */
  advanceTaxInstalment1: number;
  advanceTaxInstalment2: number;
  advanceTaxInstalment3: number;
  advanceTaxInstalment4: number;
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
  /** Old-regime only. Home-loan principal repaid this year: counts inside the shared Section 80C ceiling alongside deduction80C, never on top of it. */
  homeLoanPrincipal80c: number;
  /** Rented-out home: rent received this year. Drives the Section 24 house-property computation in both regimes. */
  letOutRentReceived: number;
  /** Rented-out home: municipal/property taxes actually paid this year, subtracted before the 30% standard deduction. */
  letOutMunicipalTaxes: number;
  /** Rented-out home: full home-loan interest on that property (Section 24(b), no cap; loss set-off capped per rules/loan-treatment.json). */
  homeLoanInterestLetOut: number;
  /** Aggregate annual life-insurance premium across policies, checked against the Section 10(10D) exemption caps (ULIP ₹2.5L / traditional ₹5L, read from rules/insurance.json). Planning figure only - not folded into taxable income, since the exact payout taxability needs the policy's issue date and sum-assured history. */
  insuranceAnnualPremium: number;
  /** Resident only. Total money sent abroad this year under the LRS, checked against the Section 206C(1G) TCS threshold (read from rules/foreign-investments.json). Planning figure only; the TCS is a prepaid credit, not a cost. */
  foreignRemittanceLrs: number;
  /** What the LRS money was for - picks the TCS rate branch (20% investment/gift, 2% education/medical, nil when funded by an education loan). */
  foreignRemittancePurpose: RemittancePurpose;
  /** Resident only. Foreign tax paid/withheld on foreign dividends, interest, short-term foreign-share gains, and RSU/ESPP perquisite value combined - for the Section 90/91 average-rate foreign tax credit estimate. Long-term foreign-share gains have their own per-holding field instead (a flat, exact rate). */
  foreignTaxPaidOnOtherIncomeInr: number;
};

/** The SupplementalFigures keys holding plain rupee amounts - everything except the purpose choice. Generic number-input loops iterate these. */
export type NumericFigureKey = {
  [K in keyof SupplementalFigures]: SupplementalFigures[K] extends number ? K : never;
}[keyof SupplementalFigures];

export const BLANK_SUPPLEMENTAL_FIGURES: SupplementalFigures = {
  dividends: 0,
  interestOtherIncome: 0,
  eligibleInterestDeduction: 0,
  deductibleTransactionCharges: 0,
  carryForwardLossesAvailable: 0,
  salaryIncome: 0,
  oldRegimeDeductions: 0,
  nreExemptInterest: 0,
  nriNroInterestTdsWithheld: 0,
  nriDividendTdsWithheld: 0,
  nriRepatriatedThisYearUsd: 0,
  nriRepatriatedThisYearInr: 0,
  minorIncomeToClub: 0,
  minorIncomeExemptFromClubbing: 0,
  numberOfMinors: 0,
  advanceTaxLiability: 0,
  advanceTaxPaid: 0,
  advanceTaxInstalment1: 0,
  advanceTaxInstalment2: 0,
  advanceTaxInstalment3: 0,
  advanceTaxInstalment4: 0,
  deduction80C: 0,
  deduction80D: 0,
  deductionNps80ccd1b: 0,
  homeLoanInterestSelfOccupied: 0,
  homeLoanInterest80eea: 0,
  educationLoanInterest80e: 0,
  evLoanInterest80eeb: 0,
  homeLoanPrincipal80c: 0,
  letOutRentReceived: 0,
  letOutMunicipalTaxes: 0,
  homeLoanInterestLetOut: 0,
  insuranceAnnualPremium: 0,
  foreignRemittanceLrs: 0,
  foreignRemittancePurpose: "investment_gift_other",
  foreignTaxPaidOnOtherIncomeInr: 0
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
