import type { NormalizedTransaction, TaxClass } from "../ingest";
import type { CapitalGainsEquityRule, ItrFormSelectionRule } from "../rules";

export type SupplementalInputs = {
  dividends: number;
  interestOtherIncome: number;
  eligibleInterestDeduction: number;
  deductibleTransactionCharges: number;
  carryForwardLossesAvailable: number;
};

export type RuleBackedSummary = {
  rows: number;
  intradayGain: number;
  stcg: number;
  ltcg: number;
  ltcgTaxableAfterExemption: number;
  estimatedStcgTax: number;
  estimatedLtcgTax: number;
  /** Section 50AA specified (debt) mutual fund gains - short-term-deemed, taxed at slab rate, kept out of the equity STCG/LTCG buckets. */
  debtMfShortTermDeemedGain: number;
  recommendedItrForm: string;
  caReviewRecommendation: string;
};

export type CaSummaryRow = {
  head: string;
  ruleSection: string;
  amount: number | string;
  notes: string;
};

export const SYNTHETIC_SUPPLEMENTAL_INPUTS: SupplementalInputs = {
  dividends: 4000,
  interestOtherIncome: 24000,
  eligibleInterestDeduction: 0,
  deductibleTransactionCharges: 160,
  carryForwardLossesAvailable: 500
};

export function classifyTransactionWithRules(
  transaction: Pick<NormalizedTransaction, "holdPeriodDays" | "instrumentType">,
  capitalGainsRule: CapitalGainsEquityRule
): TaxClass {
  // Section 50AA specified (debt) mutual funds are always short-term-deemed,
  // regardless of holding period - see rules/capital-gains-mutual-funds.json.
  // Callers must still branch on instrumentType before applying an equity rate.
  if (transaction.instrumentType === "debt_mutual_fund") {
    return "ST";
  }

  if (transaction.holdPeriodDays === 0) {
    return "Intraday";
  }

  if (transaction.holdPeriodDays > capitalGainsRule.values.listed_equity.long_term_holding_period_days_gt) {
    return "LT";
  }

  return "ST";
}

export function summarizeWithRules(
  transactions: NormalizedTransaction[],
  capitalGainsRule: CapitalGainsEquityRule,
  itrFormRule: ItrFormSelectionRule
): RuleBackedSummary {
  const buckets = transactions.reduce(
    (totals, transaction) => {
      if (transaction.instrumentType === "debt_mutual_fund") {
        totals.debtMfShortTermDeemedGain += transaction.gainLoss;
        return totals;
      }
      const taxClass = classifyTransactionWithRules(transaction, capitalGainsRule);
      if (taxClass === "Intraday") {
        totals.intradayGain += transaction.gainLoss;
      } else if (taxClass === "ST") {
        totals.stcg += transaction.gainLoss;
      } else {
        totals.ltcg += transaction.gainLoss;
      }
      return totals;
    },
    { intradayGain: 0, stcg: 0, ltcg: 0, debtMfShortTermDeemedGain: 0 }
  );

  const listedEquity = capitalGainsRule.values.listed_equity;
  const ltcgTaxableAfterExemption = Math.max(0, buckets.ltcg - listedEquity.ltcg_exemption_inr);
  const hasBusinessOrSpeculativeIncome = buckets.intradayGain > 0;
  const formKey =
    hasBusinessOrSpeculativeIncome && itrFormRule.values.business_income_triggers_itr_3
      ? "business_or_speculative_non_audit"
      : "resident_capital_gains_or_clubbing";
  const recommendedItrForm = itrFormRule.values.forms[formKey]?.form ?? "Review";

  return {
    rows: transactions.length,
    intradayGain: buckets.intradayGain,
    stcg: buckets.stcg,
    ltcg: buckets.ltcg,
    ltcgTaxableAfterExemption,
    estimatedStcgTax: Math.max(0, buckets.stcg) * listedEquity.stcg_rate,
    estimatedLtcgTax: ltcgTaxableAfterExemption * listedEquity.ltcg_rate,
    debtMfShortTermDeemedGain: buckets.debtMfShortTermDeemedGain,
    recommendedItrForm,
    caReviewRecommendation:
      recommendedItrForm === "ITR-3" ? "Get CA review before filing" : "Self-file may be reasonable after checks"
  };
}

export function caSummaryRows(
  transactions: NormalizedTransaction[],
  capitalGainsRule: CapitalGainsEquityRule,
  itrFormRule: ItrFormSelectionRule,
  supplementalInputs: SupplementalInputs = SYNTHETIC_SUPPLEMENTAL_INPUTS
): CaSummaryRow[] {
  const summary = summarizeWithRules(transactions, capitalGainsRule, itrFormRule);
  return [
    {
      head: "Speculative / Intraday income",
      ruleSection: "Business income",
      amount: summary.intradayGain,
      notes: "Rule-backed webapp calculation"
    },
    {
      head: "Short-Term Capital Gains",
      ruleSection: "111A",
      amount: summary.stcg,
      notes: "Rule-backed webapp calculation"
    },
    {
      head: "Long-Term Capital Gains",
      ruleSection: "112A",
      amount: summary.ltcg,
      notes: "Rule-backed webapp calculation"
    },
    {
      head: "Debt/specified mutual fund gains",
      ruleSection: "50AA",
      amount: summary.debtMfShortTermDeemedGain,
      notes:
        "Short-term-deemed, taxed at your slab rate. Not the equity 20%/12.5% rates above, and not included in those totals. Confirm the fund's classification with a CA."
    },
    {
      head: "Dividends",
      ruleSection: "Schedule OS",
      amount: supplementalInputs.dividends,
      notes: "Synthetic fixture supplemental input"
    },
    {
      head: "Interest & other income",
      ruleSection: "Schedule OS",
      amount: supplementalInputs.interestOtherIncome,
      notes: "Synthetic fixture supplemental input"
    },
    {
      head: "Eligible interest deduction",
      ruleSection: "80TTA/80TTB",
      amount: supplementalInputs.eligibleInterestDeduction,
      notes: "Synthetic fixture supplemental input"
    },
    {
      head: "Deductible transaction charges",
      ruleSection: "Expense split",
      amount: supplementalInputs.deductibleTransactionCharges,
      notes: "Synthetic fixture supplemental input"
    },
    {
      head: "Carry-forward losses available",
      ruleSection: "CFL",
      amount: supplementalInputs.carryForwardLossesAvailable,
      notes: "Synthetic fixture supplemental input"
    },
    {
      head: "Recommended ITR form",
      ruleSection: "",
      amount: summary.recommendedItrForm,
      notes: "ITR form selected from rule JSON"
    },
    {
      head: "CA review recommendation",
      ruleSection: "",
      amount: summary.caReviewRecommendation,
      notes: "Review recommendation derived from selected form"
    }
  ];
}

export function caSummaryAmountMap(rows: CaSummaryRow[]): Record<string, number | string> {
  return Object.fromEntries(rows.map((row) => [row.head, row.amount]));
}
