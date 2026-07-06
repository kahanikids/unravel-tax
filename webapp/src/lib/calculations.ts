import type { NormalizedTransaction, TaxClass } from "../ingest";
import type { CapitalGainsEquityRule, ItrFormSelectionRule } from "../rules";

export type SupplementalInputs = {
  dividends: number;
  interestOtherIncome: number;
  eligibleInterestDeduction: number;
  deductibleTransactionCharges: number;
  carryForwardLossesAvailable: number;
};

/** Sale/cost roll-up for one tax bucket. gain is always saleValue - cost. */
export type BucketTotals = {
  saleValue: number;
  cost: number;
  gain: number;
};

export type ClassTotals = {
  intraday: BucketTotals;
  stcg: BucketTotals;
  ltcg: BucketTotals;
  debtMf: BucketTotals;
  /** Every transaction across all buckets. */
  all: BucketTotals;
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
  /** Total sale value and total cost per bucket - the gains above are derived from these (sale - cost), and they're what a broker statement's own totals can be checked against. */
  totals: ClassTotals;
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

  const threshold =
    transaction.instrumentType === "unlisted_equity"
      ? 730
      : capitalGainsRule.values.listed_equity.long_term_holding_period_days_gt;

  if (transaction.holdPeriodDays > threshold) {
    return "LT";
  }

  return "ST";
}

export function summarizeWithRules(
  transactions: NormalizedTransaction[],
  capitalGainsRule: CapitalGainsEquityRule,
  itrFormRule: ItrFormSelectionRule
): RuleBackedSummary {
  const emptyBucket = (): BucketTotals => ({ saleValue: 0, cost: 0, gain: 0 });
  const totals: ClassTotals = {
    intraday: emptyBucket(),
    stcg: emptyBucket(),
    ltcg: emptyBucket(),
    debtMf: emptyBucket(),
    all: emptyBucket()
  };

  for (const transaction of transactions) {
    let bucket: BucketTotals;
    if (transaction.instrumentType === "debt_mutual_fund") {
      bucket = totals.debtMf;
    } else {
      const taxClass = classifyTransactionWithRules(transaction, capitalGainsRule);
      bucket =
        taxClass === "Intraday" ? totals.intraday : taxClass === "ST" ? totals.stcg : totals.ltcg;
    }
    bucket.saleValue += transaction.sellValue;
    bucket.cost += transaction.buyValue;
    totals.all.saleValue += transaction.sellValue;
    totals.all.cost += transaction.buyValue;
  }
  // Each bucket's gain is derived from its own sale/cost totals, so the
  // figure a CA sees can always be re-checked as (total sale - total cost).
  for (const bucket of [totals.intraday, totals.stcg, totals.ltcg, totals.debtMf, totals.all]) {
    bucket.gain = bucket.saleValue - bucket.cost;
  }

  const buckets = {
    intradayGain: totals.intraday.gain,
    stcg: totals.stcg.gain,
    ltcg: totals.ltcg.gain,
    debtMfShortTermDeemedGain: totals.debtMf.gain
  };

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
    totals,
    recommendedItrForm,
    caReviewRecommendation:
      recommendedItrForm === "ITR-3"
        ? "Get CA review before filing"
        : "Self-file may be reasonable after checks"
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
  const saleMinusCost = (bucket: BucketTotals) =>
    `Worked out as total sale value ₹${formatInr(bucket.saleValue)} minus total cost ₹${formatInr(bucket.cost)}.`;

  return [
    {
      head: "Speculative / Intraday income",
      ruleSection: "Business income",
      amount: summary.intradayGain,
      notes: `Bought and sold the same trading day (intraday), so it's speculative business income, not a capital gain. Taxed at your slab rate, and it's what moves your ITR form to ITR-3. ${saleMinusCost(summary.totals.intraday)}`
    },
    {
      head: "Short-Term Capital Gains",
      ruleSection: "111A",
      amount: summary.stcg,
      notes: `Equity positions held ${holdingThresholdDays} days or fewer between purchase and sale. Taxed at ${stcgRatePercent}% under Section 111A, regardless of your income slab. ${saleMinusCost(summary.totals.stcg)}`
    },
    {
      head: "Long-Term Capital Gains",
      ruleSection: "112A",
      amount: summary.ltcg,
      notes: `Equity positions held more than ${holdingThresholdDays} days between purchase and sale. Taxed at ${ltcgRatePercent}% under Section 112A, only on the amount above ₹${exemptionInr.toLocaleString("en-IN")} of gains each financial year. This row shows the gain before that exemption; see the full workbook's Detailed Summary for the taxable amount after it. ${saleMinusCost(summary.totals.ltcg)}`
    },
    {
      head: "Debt/specified mutual fund gains",
      ruleSection: "50AA",
      amount: summary.debtMfShortTermDeemedGain,
      notes: `Short-term-deemed, taxed at your slab rate. Not the equity 20%/12.5% rates above, and not included in those totals. Confirm the fund's classification with a CA. ${saleMinusCost(summary.totals.debtMf)}`
    },
    {
      head: "Total sale value",
      ruleSection: "Totals",
      amount: summary.totals.all.saleValue,
      notes:
        "Sale proceeds of every transaction across all your documents. The four gain figures above are each worked out as their bucket's sale value minus cost, so this total is what to check against your broker statement's own totals."
    },
    {
      head: "Total cost of purchase",
      ruleSection: "Totals",
      amount: summary.totals.all.cost,
      notes:
        "Purchase cost of every transaction across all your documents. Total sale value minus this equals your combined gain/(loss) before exemptions."
    },
    {
      head: "Dividends",
      ruleSection: "Schedule OS",
      amount: supplementalInputs.dividends,
      notes:
        'Entered by you under "A few more numbers" on the Current Filing page, not read from an uploaded document. Taxed at your slab rate under Schedule OS.'
    },
    {
      head: "Interest & other income",
      ruleSection: "Schedule OS",
      amount: supplementalInputs.interestOtherIncome,
      notes:
        'Entered by you under "A few more numbers" on the Current Filing page. Bank/FD interest and similar income, taxed at your slab rate under Schedule OS.'
    },
    {
      head: "Eligible interest deduction",
      ruleSection: "80TTA/80TTB",
      amount: supplementalInputs.eligibleInterestDeduction,
      notes:
        "Entered by you. Reduces the interest income above, up to the 80TTA (under 60) or 80TTB (senior citizen) limit."
    },
    {
      head: "Deductible transaction charges",
      ruleSection: "Expense split",
      amount: supplementalInputs.deductibleTransactionCharges,
      notes:
        "Entered by you. Non-STT broker charges (brokerage, stamp duty) that can be netted against gains; STT itself isn't deductible against capital gains."
    },
    {
      head: "Carry-forward losses available",
      ruleSection: "CFL",
      amount: supplementalInputs.carryForwardLossesAvailable,
      notes:
        "Entered by you. Losses from an earlier year, offsettable against this year's capital gains if filed on time in that earlier year."
    },
    {
      head: "Recommended ITR form",
      ruleSection: "",
      amount: summary.recommendedItrForm,
      notes:
        summary.intradayGain > 0
          ? "ITR-3 because your documents show speculative/intraday income, which counts as business income, not just capital gains."
          : "Based on your profile and documents: capital gains, dividends, and interest without business income fit this simpler form."
    },
    {
      head: "CA review recommendation",
      ruleSection: "",
      amount: summary.caReviewRecommendation,
      notes:
        summary.recommendedItrForm === "ITR-3"
          ? "ITR-3 filings involve business-income rules a CA should check before you file."
          : "No business income or other complexity detected in what you've entered so far. Still worth a final sanity check on the numbers."
    }
  ];
}

function formatRatePercent(rate: number): string {
  return (rate * 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatInr(value: number): string {
  return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/**
 * Finds a broker-reported gain/taxable column among the preserved
 * (unmapped) broker columns - "Taxable Gain", "Realised Gain", "Net Gain"
 * and similar. Shared by the workbook export's per-row variance column and
 * the on-screen broker cross-check.
 */
export function findBrokerTaxableColumn(headers: string[]): string | undefined {
  const normalized = headers.map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, " "));
  // Most-specific name first: a statement with both "Realized Gain" and
  // "Taxable Gain" columns should be checked against the taxable one.
  const patterns: ((n: string) => boolean)[] = [
    (n) => n.includes("taxable gain"),
    (n) =>
      (n.includes("realised gain") || n.includes("realized gain")) &&
      !n.includes("short term") &&
      !n.includes("long term"),
    (n) => n === "net gain"
  ];
  for (const matches of patterns) {
    const index = normalized.findIndex(matches);
    if (index !== -1) {
      return headers[index];
    }
  }
  return undefined;
}

export type BrokerGainCheck = {
  /** The broker column the check is based on, as it appeared in the statement. */
  columnName: string;
  /** Brokers often keep intraday out of the taxable-gain column and report it
   * in a separate speculative column; when one exists it's used for the
   * intraday bucket instead. */
  speculativeColumnName?: string;
  /** Per-bucket computed gain (sale - cost) vs the broker column's own sum. */
  perClass: { label: string; computed: number; broker: number }[];
};

/** A broker column holding speculative/intraday P&L, kept separate from taxable capital gains in many statements. */
export function findBrokerSpeculativeColumn(headers: string[]): string | undefined {
  return headers.find((header) =>
    header
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .includes("speculative")
  );
}

/**
 * The checking value from the broker's own sheet: when a statement carried a
 * gain/taxable column of its own, sum it per tax bucket and compare against
 * the computed (sale - cost) figures. Returns null when no document had such
 * a column - the check is then simply not available, not silently passed.
 */
export function brokerGainCheck(
  transactions: NormalizedTransaction[],
  capitalGainsRule: CapitalGainsEquityRule
): BrokerGainCheck | null {
  const brokerHeaders = new Set<string>();
  for (const transaction of transactions) {
    for (const key of Object.keys(transaction.brokerColumns ?? {})) {
      brokerHeaders.add(key);
    }
  }
  const columnName = findBrokerTaxableColumn([...brokerHeaders]);
  if (!columnName) {
    return null;
  }
  const speculativeColumnName = findBrokerSpeculativeColumn([...brokerHeaders]);

  const sums: Record<
    "intraday" | "stcg" | "ltcg" | "debtMf",
    { computed: number; broker: number }
  > = {
    intraday: { computed: 0, broker: 0 },
    stcg: { computed: 0, broker: 0 },
    ltcg: { computed: 0, broker: 0 },
    debtMf: { computed: 0, broker: 0 }
  };

  for (const transaction of transactions) {
    let key: keyof typeof sums;
    if (transaction.instrumentType === "debt_mutual_fund") {
      key = "debtMf";
    } else {
      const taxClass = classifyTransactionWithRules(transaction, capitalGainsRule);
      key = taxClass === "Intraday" ? "intraday" : taxClass === "ST" ? "stcg" : "ltcg";
    }
    sums[key].computed += transaction.sellValue - transaction.buyValue;
    const sourceColumn =
      key === "intraday" && speculativeColumnName ? speculativeColumnName : columnName;
    const raw = transaction.brokerColumns?.[sourceColumn];
    if (raw !== undefined) {
      const parsed =
        typeof raw === "number"
          ? raw
          : Number(
              String(raw)
                .replace(/[₹,\s]/g, "")
                .replace(/^\((.+)\)$/, "-$1")
            );
      if (!Number.isNaN(parsed)) {
        sums[key].broker += parsed;
      }
    }
  }

  return {
    columnName,
    speculativeColumnName,
    perClass: [
      { label: "Speculative / Intraday income", ...sums.intraday },
      { label: "Short-Term Capital Gains", ...sums.stcg },
      { label: "Long-Term Capital Gains", ...sums.ltcg },
      { label: "Debt/specified mutual fund gains", ...sums.debtMf }
    ]
  };
}

export function caSummaryAmountMap(rows: CaSummaryRow[]): Record<string, number | string> {
  return Object.fromEntries(rows.map((row) => [row.head, row.amount]));
}
