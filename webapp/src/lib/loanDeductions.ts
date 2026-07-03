import type { LoanTreatmentRule } from "../rules";
import type { SupplementalFigures } from "../state/types";

export type LoanDeductionLine = {
  key: keyof SupplementalFigures;
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
 * home-loan interest, the 80C principal, and business-use vehicle interest
 * are deliberately out of scope here (see rules/loan-treatment.md).
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
