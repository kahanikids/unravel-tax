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
  const listedEquity = capitalGainsRule.values.listed_equity;
  const holdingThresholdDays = listedEquity.long_term_holding_period_days_gt;
  const stcgRatePercent = formatRatePercent(listedEquity.stcg_rate);
  const ltcgRatePercent = formatRatePercent(listedEquity.ltcg_rate);
  const exemptionInr = listedEquity.ltcg_exemption_inr;

  return [
    {
      head: "Speculative / Intraday income",
      ruleSection: "Business income",
      amount: summary.intradayGain,
      notes:
        "Bought and sold the same trading day (intraday), so it's speculative business income, not a capital gain. Taxed at your slab rate, and it's what moves your ITR form to ITR-3."
    },
    {
      head: "Short-Term Capital Gains",
      ruleSection: "111A",
      amount: summary.stcg,
      notes: `Equity positions held ${holdingThresholdDays} days or fewer between purchase and sale. Taxed at ${stcgRatePercent}% under Section 111A, regardless of your income slab.`
    },
    {
      head: "Long-Term Capital Gains",
      ruleSection: "112A",
      amount: summary.ltcg,
      notes: `Equity positions held more than ${holdingThresholdDays} days between purchase and sale. Taxed at ${ltcgRatePercent}% under Section 112A, only on the amount above ₹${exemptionInr.toLocaleString("en-IN")} of gains each financial year. This row shows the gain before that exemption; see the full workbook's Detailed Summary for the taxable amount after it.`
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
      notes: "Entered by you under \"A few more numbers\" below, not read from an uploaded document. Taxed at your slab rate under Schedule OS."
    },
    {
      head: "Interest & other income",
      ruleSection: "Schedule OS",
      amount: supplementalInputs.interestOtherIncome,
      notes: "Entered by you under \"A few more numbers\" below. Bank/FD interest and similar income, taxed at your slab rate under Schedule OS."
    },
    {
      head: "Eligible interest deduction",
      ruleSection: "80TTA/80TTB",
      amount: supplementalInputs.eligibleInterestDeduction,
      notes: "Entered by you. Reduces the interest income above, up to the 80TTA (under 60) or 80TTB (senior citizen) limit."
    },
    {
      head: "Deductible transaction charges",
      ruleSection: "Expense split",
      amount: supplementalInputs.deductibleTransactionCharges,
      notes: "Entered by you. Non-STT broker charges (brokerage, stamp duty) that can be netted against gains; STT itself isn't deductible against capital gains."
    },
    {
      head: "Carry-forward losses available",
      ruleSection: "CFL",
      amount: supplementalInputs.carryForwardLossesAvailable,
      notes: "Entered by you. Losses from an earlier year, offsettable against this year's capital gains if filed on time in that earlier year."
    },
    {
      head: "Recommended ITR form",
      ruleSection: "",
      amount: summary.recommendedItrForm,
      notes: summary.intradayGain > 0
        ? "ITR-3 because your documents show speculative/intraday income, which counts as business income, not just capital gains."
        : "Based on your profile and documents: capital gains, dividends, and interest without business income fit this simpler form."
    },
    {
      head: "CA review recommendation",
      ruleSection: "",
      amount: summary.caReviewRecommendation,
      notes: summary.recommendedItrForm === "ITR-3"
        ? "ITR-3 filings involve business-income rules a CA should check before you file."
        : "No business income or other complexity detected in what you've entered so far. Still worth a final sanity check on the numbers."
    }
  ];
}

function formatRatePercent(rate: number): string {
  return (rate * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function caSummaryAmountMap(rows: CaSummaryRow[]): Record<string, number | string> {
  return Object.fromEntries(rows.map((row) => [row.head, row.amount]));
}
