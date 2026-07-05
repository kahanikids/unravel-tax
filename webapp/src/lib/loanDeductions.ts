import type { DeductionLimitsRule, LoanTreatmentRule } from "../rules";
import type { NumericFigureKey, SupplementalFigures } from "../state/types";

export type LoanDeductionLine = {
  key: NumericFigureKey;
  section: string;
  label: string;
  entered: number;
  /** Amount actually allowed after applying the section's cap (old regime). */
  allowed: number;
  /** null means "no rupee cap" (e.g. Section 80E education-loan interest). */
  limit: number | null;
};

export type LoanDeductions = {
  lines: LoanDeductionLine[];
  /** Total old-regime deduction these loans allow, after each cap. */
  total: number;
};

function cap(entered: number, limit: number | null): number {
  const value = Math.max(0, entered);
  return limit === null ? value : Math.min(value, limit);
}

/**
 * Turns the loan-interest figures the user types into the deduction each one
 * actually allows under the OLD regime, capping every line at the limit read
 * from rules/loan-treatment.json (never hardcoded, per CLAUDE.md). Let-out
 * home-loan interest is handled separately (computeLetOutHouseProperty) since
 * it nets against rent per regime rather than capping at a rupee limit, and
 * the 80C principal is handled by combined80cUsage since it shares the 80C
 * ceiling. Business-use vehicle interest stays out of scope
 * (see rules/loan-treatment.md).
 */
export function computeLoanDeductions(
  figures: SupplementalFigures,
  rule: LoanTreatmentRule
): LoanDeductions {
  const values = rule.values;
  const lines: LoanDeductionLine[] = [
    {
      key: "homeLoanInterestSelfOccupied",
      section: "24(b)",
      label: "Home loan interest (self-occupied)",
      entered: figures.homeLoanInterestSelfOccupied,
      limit: values.home_loan.self_occupied_interest_24b.limit_inr,
      allowed: cap(figures.homeLoanInterestSelfOccupied, values.home_loan.self_occupied_interest_24b.limit_inr)
    },
    {
      key: "homeLoanInterest80eea",
      section: "80EEA",
      label: "First-time-buyer home loan interest (top-up)",
      entered: figures.homeLoanInterest80eea,
      limit: values.home_loan.additional_interest_80eea.limit_inr,
      allowed: cap(figures.homeLoanInterest80eea, values.home_loan.additional_interest_80eea.limit_inr)
    },
    {
      key: "educationLoanInterest80e",
      section: "80E",
      label: "Education loan interest",
      entered: figures.educationLoanInterest80e,
      limit: values.education_loan_80e.limit_inr,
      allowed: cap(figures.educationLoanInterest80e, values.education_loan_80e.limit_inr)
    },
    {
      key: "evLoanInterest80eeb",
      section: "80EEB",
      label: "Electric vehicle loan interest",
      entered: figures.evLoanInterest80eeb,
      limit: values.electric_vehicle_loan_80eeb.limit_inr,
      allowed: cap(figures.evLoanInterest80eeb, values.electric_vehicle_loan_80eeb.limit_inr)
    }
  ];

  return { lines, total: lines.reduce((sum, line) => sum + line.allowed, 0) };
}

export type LetOutHouseProperty = {
  rentReceived: number;
  municipalTaxes: number;
  /** Net annual value: rent minus municipal taxes (floored at zero). */
  netAnnualValue: number;
  /** Section 24(a) flat standard deduction on the net annual value. */
  standardDeduction: number;
  interest: number;
  /** House-property income (or loss, negative) before any set-off cap. */
  netIncome: number;
  /** What actually enters old-regime slab income: the net income, with a loss capped at the Section 71(3A) set-off limit. */
  oldRegimeIncome: number;
  /** What actually enters new-regime slab income: a loss can't offset other heads, so it's floored at zero. */
  newRegimeIncome: number;
  /** Old regime only: loss beyond the set-off cap, carried forward against future house-property income. */
  lossCarriedForward: number;
  /** Any figure was entered at all - drives whether panels/rows show the computation. */
  hasInputs: boolean;
};

/**
 * Section 24 house-property computation for one rented-out home: rent minus
 * municipal taxes (net annual value), minus the flat 24(a) standard deduction,
 * minus the full uncapped 24(b) interest. A resulting loss offsets other
 * income only up to the rule's cap under the old regime (rest carried
 * forward), and not at all under the new regime. Every rate and cap is read
 * from rules/loan-treatment.json.
 */
export function computeLetOutHouseProperty(
  figures: SupplementalFigures,
  rule: LoanTreatmentRule
): LetOutHouseProperty {
  const letOutRule = rule.values.home_loan.let_out_interest_24b;
  const rentReceived = Math.max(0, figures.letOutRentReceived);
  const municipalTaxes = Math.min(Math.max(0, figures.letOutMunicipalTaxes), rentReceived);
  const netAnnualValue = rentReceived - municipalTaxes;
  const standardDeduction = Math.round(netAnnualValue * letOutRule.net_annual_value_standard_deduction_rate);
  const interest = Math.max(0, figures.homeLoanInterestLetOut);
  const netIncome = netAnnualValue - standardDeduction - interest;
  const setOffCap = letOutRule.house_property_loss_setoff_cap_against_other_heads_inr;
  const oldRegimeIncome = Math.max(netIncome, -setOffCap);
  return {
    rentReceived,
    municipalTaxes,
    netAnnualValue,
    standardDeduction,
    interest,
    netIncome,
    oldRegimeIncome,
    newRegimeIncome: Math.max(0, netIncome),
    lossCarriedForward: Math.max(0, -netIncome - setOffCap),
    hasInputs: rentReceived > 0 || figures.letOutMunicipalTaxes > 0 || interest > 0
  };
}

export type Combined80cUsage = {
  /** The dashboard's Section 80C investments figure. */
  investments: number;
  /** Home-loan principal repaid, which shares the same ceiling. */
  homeLoanPrincipal: number;
  /** investments + principal, uncapped - what the 80C progress bar shows as used. */
  combined: number;
  /** The Section 80C ceiling from rules/deduction-limits.json. */
  limit: number;
  /** min(combined, limit): the most Section 80C can actually deduct. */
  allowed: number;
};

/**
 * Home-loan principal counts INSIDE the single Section 80C ceiling, never on
 * top of it (rules/loan-treatment.json home_loan.principal_repayment_80c), so
 * the principal and the dashboard's 80C investments figure are capped
 * together, not separately.
 */
export function combined80cUsage(figures: SupplementalFigures, deductionLimits: DeductionLimitsRule): Combined80cUsage {
  const investments = Math.max(0, figures.deduction80C);
  const homeLoanPrincipal = Math.max(0, figures.homeLoanPrincipal80c);
  const combined = investments + homeLoanPrincipal;
  const limit = deductionLimits.values.section_80c.limit_inr;
  return { investments, homeLoanPrincipal, combined, limit, allowed: Math.min(combined, limit) };
}
