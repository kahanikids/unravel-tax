import type { ForeignInvestmentsRule } from "../rules";

/**
 * Schedule FA table A3 (foreign equity/debt interest), combined with RSU/ESPP
 * from a foreign employer - Phase 2 of the Schedule FA builder (see
 * docs/DESIGN-remaining-gaps.md). Unlike Phase 1's bank/brokerage accounts,
 * this computes actual Indian tax on a sale: foreign shares are taxed like
 * unlisted Indian shares (24-month long-term threshold, flat 12.5% with no
 * indexation), not like listed equity.
 */
export type ForeignEquityHolding = {
  id: string;
  entityName: string;
  /** RSU/ESPP from a foreign employer, as opposed to a regular foreign share purchase. */
  isRsuOrEspp: boolean;
  /**
   * ISO yyyy-mm-dd. Grant/purchase date for a regular holding, or the
   * VESTING date for RSU/ESPP - Section 17(2)(vi) makes the FMV at vesting
   * both the salary perquisite and the cost basis for a later sale, and the
   * holding period for that sale starts from vesting, not grant.
   */
  acquisitionDate: string;
  /** Rupees. For RSU/ESPP, the FMV at vesting - not the exercise/purchase price. */
  costBasisInr: number;
  /** RSU/ESPP only: the perquisite value taxed as salary this year (FMV at vesting minus exercise price). 0 for a regular holding, or if vesting happened in an earlier filing. */
  perquisiteValueInr: number;
  /** This year's closing value in rupees, for Schedule FA disclosure - 0 once sold. */
  closingValueInr: number;
  /** ISO yyyy-mm-dd, blank if not sold this year. */
  saleDate: string;
  /** Rupees, sale proceeds this year - 0 if not sold. */
  saleProceedsInr: number;
  /** Rupees, foreign tax withheld or paid on this sale's gain, for the Section 90/91 credit. */
  foreignTaxPaidOnGainInr: number;
};

export function newForeignEquityHoldingId(): string {
  return `fe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const BLANK_FOREIGN_EQUITY_HOLDING: Omit<ForeignEquityHolding, "id"> = {
  entityName: "",
  isRsuOrEspp: false,
  acquisitionDate: "",
  costBasisInr: 0,
  perquisiteValueInr: 0,
  closingValueInr: 0,
  saleDate: "",
  saleProceedsInr: 0,
  foreignTaxPaidOnGainInr: 0
};

export type ForeignEquityHoldingResult = {
  holding: ForeignEquityHolding;
  sold: boolean;
  holdPeriodDays: number;
  gain: number;
  taxTreatment: "long_term" | "short_term" | "not_sold";
  /** Flat-rate Indian tax on this holding's gain - only for long-term; short-term is slab-rate and folds into the regime comparison's other-slab-income bucket instead. */
  estimatedLtcgTax: number;
  /** Section 90/91 credit for this holding's gain: lower of foreign tax paid and the Indian tax above. Long-term only - see foreignTaxCredit.ts for the average-rate method short-term gains use instead. */
  foreignTaxCreditOnGain: number;
};

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Foreign shares (including RSU/ESPP once vested) are taxed like unlisted
 * Indian shares, not listed equity: long-term only past
 * rules/foreign-investments.json's 24-month threshold, at a flat rate with
 * no indexation; short-term is slab rate, computed elsewhere as part of the
 * regime comparison's other-slab-income bucket (see summarizeForeignEquityHoldings).
 */
export function computeForeignEquityHoldings(
  holdings: ForeignEquityHolding[],
  rule: ForeignInvestmentsRule
): ForeignEquityHoldingResult[] {
  const shareRule = rule.values.income_taxation.capital_gains_on_foreign_shares;
  return holdings.map((holding) => {
    const sold = Boolean(holding.saleDate) && holding.saleProceedsInr > 0;
    if (!sold) {
      return {
        holding,
        sold: false,
        holdPeriodDays: 0,
        gain: 0,
        taxTreatment: "not_sold",
        estimatedLtcgTax: 0,
        foreignTaxCreditOnGain: 0
      };
    }
    const holdPeriodDays = holding.acquisitionDate ? daysBetween(holding.acquisitionDate, holding.saleDate) : 0;
    const gain = holding.saleProceedsInr - holding.costBasisInr;
    const isLongTerm = holdPeriodDays > shareRule.long_term_holding_period_days_gt;
    const estimatedLtcgTax = isLongTerm ? Math.max(0, gain) * shareRule.ltcg_rate : 0;
    const foreignTaxCreditOnGain = isLongTerm
      ? Math.min(Math.max(0, holding.foreignTaxPaidOnGainInr), estimatedLtcgTax)
      : 0;
    return {
      holding,
      sold: true,
      holdPeriodDays,
      gain,
      taxTreatment: isLongTerm ? "long_term" : "short_term",
      estimatedLtcgTax,
      foreignTaxCreditOnGain
    };
  });
}

export type ForeignEquitySummary = {
  results: ForeignEquityHoldingResult[];
  /** Sum of long-term gains' flat-rate tax - its own CA Summary row. */
  totalLtcgTax: number;
  /** Sum of short-term gains - slab rate, folds into the regime comparison's other-slab-income bucket alongside foreign dividends/interest. */
  totalStcgGain: number;
  /** Sum of RSU/ESPP perquisite values taxed as salary this year - folds into the regime comparison's salary bucket (eligible for the standard deduction, unlike other-slab-income). */
  totalPerquisiteValueInr: number;
  /** Sum of the Section 90/91 credit on long-term gains (flat-rate method). Short-term/dividend/interest/perquisite credit is estimated separately - see foreignTaxCredit.ts. */
  totalForeignTaxCreditOnLtcg: number;
};

export function summarizeForeignEquityHoldings(
  holdings: ForeignEquityHolding[],
  rule: ForeignInvestmentsRule
): ForeignEquitySummary {
  const results = computeForeignEquityHoldings(holdings, rule);
  return {
    results,
    totalLtcgTax: results.reduce((sum, result) => sum + result.estimatedLtcgTax, 0),
    totalStcgGain: results
      .filter((result) => result.taxTreatment === "short_term")
      .reduce((sum, result) => sum + Math.max(0, result.gain), 0),
    totalPerquisiteValueInr: holdings.reduce((sum, holding) => sum + Math.max(0, holding.perquisiteValueInr), 0),
    totalForeignTaxCreditOnLtcg: results.reduce((sum, result) => sum + result.foreignTaxCreditOnGain, 0)
  };
}
