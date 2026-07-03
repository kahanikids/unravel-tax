import type { ForeignInvestmentsRule } from "../rules";
import type { SupplementalFigures } from "../state/types";

export type ForeignRemittanceTcs = {
  /** LRS money the user says they sent abroad this year (never negative). */
  remittance: number;
  /** Section 206C(1G) TCS-free threshold (₹10L), read from rules/foreign-investments.json. */
  threshold: number;
  /** TCS rate on investment/gift/other remittances above the threshold. */
  rate: number;
  /**
   * TCS collected on the amount above the threshold. It is a prepaid tax
   * credit shown in Form 26AS/AIS and recoverable in the return, not a cost.
   */
  estimatedTcs: number;
  /** Remittance is past the TCS-free threshold. */
  overThreshold: boolean;
};

/**
 * Turns the LRS remittance the user types into the Section 206C(1G) TCS that
 * gets collected above the ₹10 lakh yearly threshold (both threshold and rate
 * read from rules/foreign-investments.json, never hardcoded). Uses the
 * investment/gift/other rate - the 2% education/medical rate and the
 * education-loan exemption are out of scope for this planning estimate. TCS is
 * a prepaid credit, so it never reduces the tax figures elsewhere.
 */
export function computeForeignRemittanceTcs(
  figures: SupplementalFigures,
  rule: ForeignInvestmentsRule
): ForeignRemittanceTcs {
  const tcs = rule.values.tcs_on_lrs_remittances;
  const remittance = Math.max(0, figures.foreignRemittanceLrs);
  const excess = Math.max(0, remittance - tcs.threshold_inr);
  return {
    remittance,
    threshold: tcs.threshold_inr,
    rate: tcs.rate_investment_gift_other,
    estimatedTcs: Math.round(excess * tcs.rate_investment_gift_other),
    overThreshold: remittance > tcs.threshold_inr
  };
}
