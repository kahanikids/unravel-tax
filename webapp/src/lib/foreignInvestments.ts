import type { ForeignInvestmentsRule } from "../rules";
import type { RemittancePurpose, SupplementalFigures } from "../state/types";

export type ForeignRemittanceTcs = {
  /** LRS money the user says they sent abroad this year (never negative). */
  remittance: number;
  /** What the money was for - picks the Section 206C(1G) rate branch below. */
  purpose: RemittancePurpose;
  /** Section 206C(1G) TCS-free threshold (₹10L), read from rules/foreign-investments.json. */
  threshold: number;
  /** TCS rate for the chosen purpose: investment/gift/other, education/medical, or nil when education-loan funded. */
  rate: number;
  /**
   * TCS collected on the amount above the threshold. It is a prepaid tax
   * credit shown in Form 26AS/AIS and recoverable in the return, not a cost.
   */
  estimatedTcs: number;
  /** Remittance is past the TCS-free threshold. */
  overThreshold: boolean;
};

export const REMITTANCE_PURPOSE_LABELS: Record<RemittancePurpose, string> = {
  investment_gift_other: "Investment, gift, or anything else",
  education_medical: "Education or medical treatment",
  education_loan_funded: "Education, funded by an education loan"
};

/**
 * Turns the LRS remittance the user types into the Section 206C(1G) TCS that
 * gets collected above the ₹10 lakh yearly threshold, using the rate for what
 * the money was actually for: 20% for investment/gift/other, 5% for education
 * or medical treatment, and nothing at all when the remittance is funded by a
 * Section 80E education loan (threshold and rates read from
 * rules/foreign-investments.json, never hardcoded). TCS is a prepaid credit,
 * so it never reduces the tax figures elsewhere.
 */
export function computeForeignRemittanceTcs(
  figures: SupplementalFigures,
  rule: ForeignInvestmentsRule
): ForeignRemittanceTcs {
  const tcs = rule.values.tcs_on_lrs_remittances;
  const purpose = figures.foreignRemittancePurpose;
  const rate =
    purpose === "education_loan_funded"
      ? 0
      : purpose === "education_medical"
        ? tcs.rate_education_medical
        : tcs.rate_investment_gift_other;
  const remittance = Math.max(0, figures.foreignRemittanceLrs);
  const excess = Math.max(0, remittance - tcs.threshold_inr);
  return {
    remittance,
    purpose,
    threshold: tcs.threshold_inr,
    rate,
    estimatedTcs: Math.round(excess * rate),
    overThreshold: remittance > tcs.threshold_inr
  };
}
