import type { AdvanceTaxRule } from "../rules";

export type AdvanceTaxInputs = {
  /** Total tax liability for the year, before subtracting TDS/advance tax paid. */
  totalTaxLiability: number;
  /** TDS plus any advance tax instalments already paid during the year. */
  taxAlreadyPaid: number;
  /** ISO yyyy-mm-dd - typically today, or your expected self-assessment payment date. */
  asOfDate: string;
  /** Section 207(2): a resident senior citizen with no business/professional income is exempt entirely. */
  seniorCitizenExempt: boolean;
};

export type AdvanceTaxResult = {
  /** Whether Section 208 required advance tax at all (false if under threshold, or senior-exempt). */
  required: boolean;
  /** Whether Section 234B interest is actually due, given what was paid. */
  interestApplies: boolean;
  reason: string;
  shortfall: number;
  monthsElapsed: number;
  estimatedInterest: number;
};

/**
 * Section 234B: interest runs for every month or part of a month from
 * 1 April of the assessment year, so any day beyond a whole-month boundary
 * rounds up to the next full month. See rules/advance-tax.md.
 */
function monthsElapsedFromAyStart(asOfIso: string, ayStartIso: string): number {
  const asOf = new Date(`${asOfIso}T00:00:00Z`);
  const start = new Date(`${ayStartIso}T00:00:00Z`);
  if (Number.isNaN(asOf.getTime()) || asOf <= start) {
    return 0;
  }
  const months = (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 + (asOf.getUTCMonth() - start.getUTCMonth()) + 1;
  return Math.max(0, months);
}

export function estimateAdvanceTaxInterest(inputs: AdvanceTaxInputs, rule: AdvanceTaxRule): AdvanceTaxResult {
  const none = { shortfall: 0, monthsElapsed: 0, estimatedInterest: 0 };
  const thresholdInr = rule.values.advance_tax_required_above_inr;
  const dueAfterPayments = inputs.totalTaxLiability - inputs.taxAlreadyPaid;

  if (dueAfterPayments < thresholdInr) {
    return {
      required: false,
      interestApplies: false,
      reason: `Tax due after what's already paid is under ₹${thresholdInr.toLocaleString("en-IN")}, so advance tax wasn't required (Section 208).`,
      ...none
    };
  }

  if (inputs.seniorCitizenExempt) {
    return {
      required: false,
      interestApplies: false,
      reason: "Resident senior citizens with no business or professional income are exempt from advance tax (Section 207(2)).",
      ...none
    };
  }

  const minimumPaidFraction = rule.values.section_234b.minimum_paid_fraction_to_avoid_interest;
  const minimumRequiredPaid = inputs.totalTaxLiability * minimumPaidFraction;
  if (inputs.taxAlreadyPaid >= minimumRequiredPaid) {
    return {
      required: true,
      interestApplies: false,
      reason: `You paid at least ${minimumPaidFraction * 100}% of your tax liability, so no Section 234B interest applies.`,
      ...none
    };
  }

  const shortfall = Math.max(0, inputs.totalTaxLiability - inputs.taxAlreadyPaid);
  const monthsElapsed = monthsElapsedFromAyStart(inputs.asOfDate, rule.values.assessment_year_start_date);
  const estimatedInterest = Math.round(shortfall * rule.values.section_234b.interest_rate_per_month * monthsElapsed);

  return {
    required: true,
    interestApplies: true,
    reason: `Advance tax paid was below ${minimumPaidFraction * 100}% of your tax liability, so Section 234B interest applies on the shortfall.`,
    shortfall,
    monthsElapsed,
    estimatedInterest
  };
}
