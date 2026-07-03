import type { InsuranceRule } from "../rules";
import type { SupplementalFigures } from "../state/types";

export type InsurancePayoutCheck = {
  /** Aggregate annual premium the user entered (never negative). */
  annualPremium: number;
  /** ULIP exemption line (₹2.5L), read from rules/insurance.json. */
  ulipCap: number;
  /** Traditional-policy exemption line (₹5L), read from rules/insurance.json. */
  traditionalCap: number;
  /** Section 194DA TDS rate on the income portion of a taxable payout. */
  tdsRate: number;
  /** Income portion at or above which 194DA TDS is deducted. */
  tdsThresholdInr: number;
  /** Premium is past the ₹2.5L line, so a ULIP maturity loses its exemption. */
  overUlipCap: boolean;
  /** Premium is past the ₹5L line, so a traditional maturity loses its exemption too. */
  overTraditionalCap: boolean;
};

/**
 * Turns the aggregate annual premium the user types into the Section 10(10D)
 * exemption check the rule tells them to run: is the premium over the ₹2.5 lakh
 * ULIP line or the ₹5 lakh traditional line (both read from rules/insurance.json,
 * never hardcoded)? It deliberately does NOT compute the taxable payout amount -
 * that needs the policy's issue date and premium-to-sum-assured history, which
 * this tool doesn't hold (see rules/insurance.md). Death benefits stay exempt
 * regardless, so they're out of scope here.
 */
export function computeInsurancePayoutCheck(
  figures: SupplementalFigures,
  rule: InsuranceRule
): InsurancePayoutCheck {
  const payout = rule.values.payouts_section_10_10d;
  const annualPremium = Math.max(0, figures.insuranceAnnualPremium);
  const ulipCap = payout.ulip.aggregate_annual_premium_exemption_cap_inr;
  const traditionalCap = payout.traditional_non_ulip.aggregate_annual_premium_exemption_cap_inr;
  return {
    annualPremium,
    ulipCap,
    traditionalCap,
    tdsRate: payout.tds_section_194da.rate,
    tdsThresholdInr: payout.tds_section_194da.applies_when_income_portion_at_least_inr,
    overUlipCap: annualPremium > ulipCap,
    overTraditionalCap: annualPremium > traditionalCap
  };
}
