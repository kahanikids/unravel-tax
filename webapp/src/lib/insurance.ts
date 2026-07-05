import type { CapitalGainsEquityRule, InsuranceRule } from "../rules";
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

export type InsurancePolicyType = "ulip" | "traditional";

export type InsurancePolicy = {
  id: string;
  policyType: InsurancePolicyType;
  /** Death benefits are always exempt regardless of everything else below (Keyman insurance excepted, out of scope for a retail filer). */
  isDeathBenefit: boolean;
  /** ISO yyyy-mm-dd. Drives both the sum-assured-ratio rule's cutoff bracket and, for a taxable ULIP, the short/long-term holding-period split. */
  issueDate: string;
  sumAssured: number;
  /** This policy year's premium - checked against the sum-assured ratio and pooled into the type's aggregate cap. */
  annualPremium: number;
  /** Cumulative premiums paid over the policy's life to date - the cost basis for a taxable payout. */
  totalPremiumsPaidToDate: number;
  /** This year's maturity/survival payout, 0 if none received this year. */
  maturityPayoutThisYear: number;
};

export function newInsurancePolicyId(): string {
  return `ip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const BLANK_INSURANCE_POLICY: Omit<InsurancePolicy, "id"> = {
  policyType: "ulip",
  isDeathBenefit: false,
  issueDate: "",
  sumAssured: 0,
  annualPremium: 0,
  totalPremiumsPaidToDate: 0,
  maturityPayoutThisYear: 0
};

export type InsurancePolicyResult = {
  policy: InsurancePolicy;
  exempt: boolean;
  reason: string;
  failsRatioTest: boolean;
  failsAggregateTest: boolean;
  /** payout minus premiums paid, floored at 0. 0 whenever exempt. */
  taxableAmount: number;
  taxTreatment: "exempt" | "capital_gains_lt" | "capital_gains_st" | "other_sources_slab";
  /** Only populated for the flat-rate capital_gains_* treatments - slab tax is left for the regime comparison, which this tool can't precisely attribute per source. */
  estimatedTax: number;
};

/**
 * Section 10(10D) per policy: a death benefit is always exempt; otherwise a
 * policy loses its exemption if its premium breaches the sum-assured ratio
 * (independent of type, in force since 2003) OR if the AGGREGATE annual
 * premium across every policy of the same type issued on/after that type's
 * cutoff date (ULIP: 1-Feb-2021, traditional: 1-Apr-2023) breaches that
 * type's cap - the aggregate test disqualifies every policy in the group,
 * not just the one that tipped it over. A non-exempt ULIP is taxed as
 * capital gains at listed-equity rates on (payout - premiums paid), split
 * short/long term by the policy's own holding period; a non-exempt
 * traditional policy is taxed as income from other sources at slab rate on
 * the same figure - this tool computes the taxable amount but leaves the
 * slab tax itself for the regime comparison, which already has the income
 * context this function doesn't. See rules/insurance.md.
 */
export function computeInsurancePolicies(
  policies: InsurancePolicy[],
  insuranceRule: InsuranceRule,
  capitalGainsRule: CapitalGainsEquityRule
): InsurancePolicyResult[] {
  const rules = insuranceRule.values.payouts_section_10_10d;
  const ratioRule = rules.sum_assured_ratio_rule;
  const listedEquity = capitalGainsRule.values.listed_equity;

  const aggregateByType: Record<InsurancePolicyType, number> = { ulip: 0, traditional: 0 };
  for (const policy of policies) {
    if (policy.isDeathBenefit) {
      continue;
    }
    const cutoff =
      policy.policyType === "ulip"
        ? rules.ulip.issued_on_or_after
        : rules.traditional_non_ulip.issued_on_or_after;
    if (policy.issueDate && policy.issueDate >= cutoff) {
      aggregateByType[policy.policyType] += Math.max(0, policy.annualPremium);
    }
  }

  return policies.map((policy) => {
    if (policy.isDeathBenefit) {
      return {
        policy,
        exempt: true,
        reason: "Death benefits are always exempt under Section 10(10D), regardless of premium.",
        failsRatioTest: false,
        failsAggregateTest: false,
        taxableAmount: 0,
        taxTreatment: "exempt",
        estimatedTax: 0
      };
    }

    const ratioPct = !policy.issueDate
      ? null
      : policy.issueDate >= "2012-04-01"
        ? ratioRule.issued_on_or_after_2012_04_01_premium_max_pct_of_sum_assured
        : policy.issueDate >= "2003-04-01"
          ? ratioRule.issued_2003_04_01_to_2012_03_31_premium_max_pct_of_sum_assured
          : null;
    const failsRatioTest =
      ratioPct !== null &&
      policy.sumAssured > 0 &&
      policy.annualPremium / policy.sumAssured > ratioPct / 100;

    const typeRule = policy.policyType === "ulip" ? rules.ulip : rules.traditional_non_ulip;
    const cap =
      policy.policyType === "ulip"
        ? rules.ulip.aggregate_annual_premium_exemption_cap_inr
        : rules.traditional_non_ulip.aggregate_annual_premium_exemption_cap_inr;
    const failsAggregateTest =
      Boolean(policy.issueDate) &&
      policy.issueDate >= typeRule.issued_on_or_after &&
      aggregateByType[policy.policyType] > cap;

    const exempt = !failsRatioTest && !failsAggregateTest;
    if (exempt) {
      return {
        policy,
        exempt: true,
        reason:
          "Within the sum-assured-ratio and aggregate-premium limits, so the payout stays exempt.",
        failsRatioTest,
        failsAggregateTest,
        taxableAmount: 0,
        taxTreatment: "exempt",
        estimatedTax: 0
      };
    }

    const taxableAmount = Math.max(
      0,
      policy.maturityPayoutThisYear - policy.totalPremiumsPaidToDate
    );
    const reason = failsAggregateTest
      ? `Your aggregate ${policy.policyType === "ulip" ? "ULIP" : "traditional-policy"} premium this year is over the exemption line, so this payout loses its Section 10(10D) exemption.`
      : "Premium is over the sum-assured-ratio limit, so this payout loses its Section 10(10D) exemption.";

    if (policy.policyType === "traditional") {
      return {
        policy,
        exempt: false,
        reason,
        failsRatioTest,
        failsAggregateTest,
        taxableAmount,
        taxTreatment: "other_sources_slab",
        estimatedTax: 0
      };
    }

    // Taxable ULIP: capital gains at listed-equity rates, split by this
    // policy's own holding period (issue date to this year's payout).
    let holdPeriodDays = 0;
    if (policy.issueDate) {
      const issue = new Date(`${policy.issueDate}T00:00:00Z`);
      const now = new Date();
      const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      holdPeriodDays = Math.round(
        (new Date(`${today}T00:00:00Z`).getTime() - issue.getTime()) / 86_400_000
      );
    }
    const isLongTerm = holdPeriodDays > listedEquity.long_term_holding_period_days_gt;
    const estimatedTax = isLongTerm
      ? Math.round(
          Math.max(0, taxableAmount - listedEquity.ltcg_exemption_inr) * listedEquity.ltcg_rate
        )
      : Math.round(taxableAmount * listedEquity.stcg_rate);

    return {
      policy,
      exempt: false,
      reason,
      failsRatioTest,
      failsAggregateTest,
      taxableAmount,
      taxTreatment: isLongTerm ? "capital_gains_lt" : "capital_gains_st",
      estimatedTax
    };
  });
}

export type InsurancePoliciesSummary = {
  results: InsurancePolicyResult[];
  /** Sum of every traditional policy's taxable amount - feed into other-sources slab income (see App.tsx). */
  totalOtherSourcesSlabIncome: number;
  /** Sum of every taxable ULIP's estimated capital-gains tax. Each ULIP's LTCG exemption is applied independently here - if you also have other equity LTCG this year, the two share one annual exemption, so your real combined tax may be higher than this alone. A CA should combine both under the one limit. */
  totalUlipCapitalGainsTax: number;
};

export function summarizeInsurancePolicies(
  policies: InsurancePolicy[],
  insuranceRule: InsuranceRule,
  capitalGainsRule: CapitalGainsEquityRule
): InsurancePoliciesSummary {
  const results = computeInsurancePolicies(policies, insuranceRule, capitalGainsRule);
  return {
    results,
    totalOtherSourcesSlabIncome: results
      .filter((result) => result.taxTreatment === "other_sources_slab")
      .reduce((sum, result) => sum + result.taxableAmount, 0),
    totalUlipCapitalGainsTax: results.reduce((sum, result) => sum + result.estimatedTax, 0)
  };
}
