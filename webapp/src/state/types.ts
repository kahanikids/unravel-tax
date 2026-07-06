export type IncomeSource =
  "salary_pension" | "bank_interest" | "capital_gains" | "dividends" | "rent" | "other";

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

export type TaxResidency = "resident" | "rnor" | "nri";

export type HousePropertyCount = "one" | "two" | "more_than_two";

/** Non-listed-equity capital-gains types that disqualify ITR-1. Listed shares/equity MF are implied by the main income-source option. */
export type CapitalGainsAssetType =
  | "property"
  | "crypto_vda"
  | "unlisted_shares"
  | "foreign_shares"
  | "debt_mf";

/** When income is held through a HUF — personal return vs filing the HUF as assessee. */
export type HufReturnScope = "personal" | "huf_return";

export type OrientationAnswers = {
  /** Tax residential status for the financial year — not where you live day-to-day. */
  residency: TaxResidency | null;
  /** Where you are a tax resident. Only asked when residency is "nri". */
  nriCountry: NriCountry;
  /** NRI/RNOR. Days physically in India this financial year. Skippable. */
  nriDaysInIndia: number | null;
  huf: boolean | null;
  /** Only when huf is Yes — personal return or the HUF's own return. */
  hufReturnScope: HufReturnScope | null;
  seniorCitizen: boolean | null;
  /** Only asked when seniorCitizen is true. Picks the old-regime super-senior (80+) slab instead of the 60-79 one. */
  superSeniorCitizen: boolean | null;
  /** Minor child has income or investments in their own name (Section 64(1A) clubbing). */
  singleParent: boolean | null;
  incomeSources: IncomeSource[];
  /** Resident/RNOR with capital gains — asset types beyond listed shares/equity MF. */
  capitalGainsAssetTypes: CapitalGainsAssetType[];
  /** NRI only. TDS deducted on capital gains, NRO interest, dividends, or rent. */
  nriTdsDeducted: boolean | null;
  /** NRI only. Has a TRC and filed Form 10F for treaty relief. */
  nriHasTrcAndForm10F: boolean | null;
  /** NRI only. Applied for or needs Form 13 lower/nil TDS certificate. */
  nriNeedsForm13: boolean | null;
  /** NRI with rent. Tenant deducted TDS and issued Form 16A. */
  nriTenantTdsForm16A: boolean | null;
  /** Resident/RNOR with India salary only — not shown to NRIs. */
  multipleEmployers: boolean | null;
  /** Resident/RNOR. Self-declared business, freelance, F&O, intraday, or speculative income. */
  businessIncome: boolean | null;
  /** Resident/RNOR with business income. Opted for presumptive taxation under 44AD/44ADA/44AE. */
  presumptiveTaxation: boolean | null;
  /** Resident/RNOR. Likely total income above the ITR-1 Rs 50 lakh cap. */
  incomeLikelyAbove50L: boolean | null;
  /** When rent is an income source — how many house properties you reported. */
  housePropertyCount: HousePropertyCount | null;
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
  /** ROR with foreignAssets=Yes. Signing authority over a foreign bank/brokerage/custodial account. */
  foreignSigningAuthority: boolean | null;
  /** ROR with foreignAssets=Yes. Foreign immovable property held. */
  foreignProperty: boolean | null;
  /** ROR with foreignAssets=Yes. Beneficiary/settlor of a foreign trust. */
  foreignTrust: boolean | null;
  /** ROR with foreignAssets=Yes. Foreign life insurance with cash surrender value. */
  foreignCashValueInsurance: boolean | null;
};

export const BLANK_ORIENTATION: OrientationAnswers = {
  residency: null,
  nriCountry: null,
  nriDaysInIndia: null,
  huf: null,
  hufReturnScope: null,
  seniorCitizen: null,
  superSeniorCitizen: null,
  singleParent: null,
  incomeSources: [],
  capitalGainsAssetTypes: [],
  nriTdsDeducted: null,
  nriHasTrcAndForm10F: null,
  nriNeedsForm13: null,
  nriTenantTdsForm16A: null,
  multipleEmployers: null,
  businessIncome: null,
  presumptiveTaxation: null,
  incomeLikelyAbove50L: null,
  housePropertyCount: null,
  hraClaimed: null,
  hraAboveThreshold: null,
  hasLandlordPan: null,
  epfWithdrawal: null,
  epfBeforeFiveYears: null,
  loansRepaid: null,
  insurancePayout: null,
  foreignAssets: null,
  foreignSigningAuthority: null,
  foreignProperty: null,
  foreignTrust: null,
  foreignCashValueInsurance: null
};

/** Fills defaults for fields added after a session was saved — prevents runtime crashes on resume. */
export function mergeOrientationAnswers(
  partial: Partial<OrientationAnswers> | OrientationAnswers
): OrientationAnswers {
  return {
    ...BLANK_ORIENTATION,
    ...partial,
    incomeSources: partial.incomeSources ?? [],
    capitalGainsAssetTypes: partial.capitalGainsAssetTypes ?? []
  };
}

export type ProfileFlags = {
  nri: boolean;
  rnor: boolean;
  nriCountry: NriCountry;
  huf: boolean;
  /** Filing the HUF's return as assessee (not just personal return with HUF investments). */
  hufFilingAsEntity: boolean;
  /** HUF investments exist but this is a personal return. */
  hufPersonalHoldings: boolean;
  seniorCitizen: boolean;
  superSeniorCitizen: boolean;
  singleParent: boolean;
  declaredBusinessIncome: boolean;
  usesPresumptiveTaxation: boolean;
  incomeLikelyAbove50L: boolean;
  housePropertiesOverItr1Limit: boolean;
  hasCapitalGains: boolean;
  /** Declared non-listed-equity capital-gains types — routes away from ITR-1. */
  capitalGainsDisqualifiesItr1: boolean;
  hasDividends: boolean;
  hasBankInterest: boolean;
  hasRent: boolean;
  multipleEmployers: boolean;
  hraRisk: boolean;
  epfRisk: boolean;
  hasLoans: boolean;
  hasInsurancePayout: boolean;
  hasForeignAssets: boolean;
  /** Schedule FA types beyond shares/accounts already covered in results panels. */
  hasExtendedForeignAssets: boolean;
  nriNeedsForm13: boolean;
  nriTdsDeducted: boolean;
  nriMissingTrc: boolean;
  nriTenantMissingForm16A: boolean;
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
 * medical 5%, and an education-loan-funded remittance collects nothing.
 * Rates and threshold read from rules/foreign-investments.json.
 */
export type RemittancePurpose =
  "investment_gift_other" | "education_medical" | "education_loan_funded";

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
  /** What the LRS money was for - picks the TCS rate branch (20% investment/gift, 5% education/medical, nil when funded by an education loan). */
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
