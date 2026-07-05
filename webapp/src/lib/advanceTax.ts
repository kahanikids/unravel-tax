import type { NormalizedTransaction } from "../ingest";
import { parseFixtureDate } from "../ingest/normalize";
import type { AdvanceTaxRule, CapitalGainsEquityRule } from "../rules";
import { classifyTransactionWithRules } from "./calculations";

export type QuarterlyCapitalGainsTax = {
  /** Cumulative STCG+LTCG tax (Sections 111A/112A) realised by each instalment's due date, aligned with rule.values.section_234c.instalments. */
  cumulativeByInstalment: number[];
  /** Full-year STCG+LTCG tax, regardless of date - matches summarizeWithRules' estimatedStcgTax + estimatedLtcgTax. */
  totalForYear: number;
};

/**
 * Buckets listed-equity STCG/LTCG by real transaction date into each Section
 * 234C instalment window, so a gain's tax only counts toward an instalment
 * due after the gain actually happened - exactly what the section's proviso
 * requires (see rules/advance-tax.md). LTCG is taxed on the cumulative gain
 * up to each window minus the full annual exemption, floored at zero, so the
 * exemption is used up by the earliest gains first.
 *
 * Intraday/speculative income and debt-mutual-fund gains (Section 50AA) are
 * taxed at slab rate, not the flat 111A/112A rates, so precise per-quarter tax
 * on them would need full income context this tool doesn't have. They're
 * excluded here and stay inside the caller's ratable "everything else"
 * bucket - see estimateSection234cInterest.
 */
export function allocateCapitalGainsTaxByInstalment(
  transactions: NormalizedTransaction[],
  capitalGainsRule: CapitalGainsEquityRule,
  advanceTaxRule: AdvanceTaxRule
): QuarterlyCapitalGainsTax {
  const listedEquity = capitalGainsRule.values.listed_equity;
  type DatedGain = { taxClass: "ST" | "LT"; gain: number; sellDate: Date };
  const dated: DatedGain[] = [];
  for (const transaction of transactions) {
    if (transaction.instrumentType === "debt_mutual_fund") {
      continue;
    }
    const taxClass = classifyTransactionWithRules(transaction, capitalGainsRule);
    if (taxClass === "Intraday") {
      continue;
    }
    try {
      dated.push({
        taxClass,
        gain: transaction.sellValue - transaction.buyValue,
        sellDate: parseFixtureDate(transaction.sellDate)
      });
    } catch {
      // Unparseable date: excluded from date-based allocation, same as
      // elsewhere in ingest - this gain still shows up in the app's other
      // totals, just not dated precisely enough for this instalment split.
    }
  }

  const taxOnGains = (rows: DatedGain[]): number => {
    const stcg = rows
      .filter((row) => row.taxClass === "ST")
      .reduce((sum, row) => sum + row.gain, 0);
    const ltcg = rows
      .filter((row) => row.taxClass === "LT")
      .reduce((sum, row) => sum + row.gain, 0);
    const ltcgTaxable = Math.max(0, ltcg - listedEquity.ltcg_exemption_inr);
    return Math.max(0, stcg) * listedEquity.stcg_rate + ltcgTaxable * listedEquity.ltcg_rate;
  };

  const cumulativeByInstalment = advanceTaxRule.values.section_234c.instalments.map(
    (instalment) => {
      const dueDate = new Date(`${instalment.due_date}T00:00:00Z`);
      return Math.round(taxOnGains(dated.filter((row) => row.sellDate <= dueDate)));
    }
  );

  return { cumulativeByInstalment, totalForYear: Math.round(taxOnGains(dated)) };
}

export type Section234cInputs = {
  /** Total tax liability for the year, before subtracting TDS/advance tax paid. */
  totalTaxLiability: number;
  /** TDS plus advance tax instalments already paid - the same figure the 234B estimate uses. */
  taxAlreadyPaid: number;
  /** Advance tax actually paid in each instalment window (by 15 Jun/15 Sep/15 Dec/15 Mar), excluding TDS. */
  instalmentsPaid: number[];
  /** Section 207(2): a resident senior citizen with no business/professional income is exempt entirely. */
  seniorCitizenExempt: boolean;
  /** From allocateCapitalGainsTaxByInstalment: precise capital-gains tax dated by instalment. Omit for an all-zero (no capital-gains precision) fallback. */
  capitalGainsTax?: QuarterlyCapitalGainsTax;
};

export type Section234cInstalment = {
  dueDate: string;
  /** Cumulative advance tax that should have been paid by this date. */
  requiredCumulative: number;
  /** Cumulative advance tax actually paid by this date. */
  paidCumulative: number;
  shortfall: number;
  monthsCharged: number;
  interest: number;
  /** The 12%/36% first/second-instalment safe harbour cleared this instalment despite a shortfall. */
  safeHarborApplied: boolean;
};

export type Section234cResult = {
  /** Whether advance tax (and therefore 234C) applied at all. */
  required: boolean;
  interestApplies: boolean;
  reason: string;
  /** Liability minus the TDS portion - the base the instalment percentages apply to. */
  assessedTax: number;
  /** The part of taxAlreadyPaid beyond the entered instalments, treated as TDS and subtracted from the liability. */
  tdsTreatedAsDeducted: number;
  /** assessedTax minus capitalGainsTaxForYear: the ratable "everything else" (salary/interest/dividends/business/debt-MF) spread evenly across all four instalments. */
  ordinaryTax: number;
  /** The dated capital-gains portion of assessedTax (Sections 111A/112A only), from the capitalGainsTax input. */
  capitalGainsTaxForYear: number;
  instalments: Section234cInstalment[];
  totalInterest: number;
};

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
  const months =
    (asOf.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (asOf.getUTCMonth() - start.getUTCMonth()) +
    1;
  return Math.max(0, months);
}

export function estimateAdvanceTaxInterest(
  inputs: AdvanceTaxInputs,
  rule: AdvanceTaxRule
): AdvanceTaxResult {
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
      reason:
        "Resident senior citizens with no business or professional income are exempt from advance tax (Section 207(2)).",
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
  const monthsElapsed = monthsElapsedFromAyStart(
    inputs.asOfDate,
    rule.values.assessment_year_start_date
  );
  const estimatedInterest = Math.round(
    shortfall * rule.values.section_234b.interest_rate_per_month * monthsElapsed
  );

  return {
    required: true,
    interestApplies: true,
    reason: `Advance tax paid was below ${minimumPaidFraction * 100}% of your tax liability, so Section 234B interest applies on the shortfall.`,
    shortfall,
    monthsElapsed,
    estimatedInterest
  };
}

/**
 * Section 234C: interest on each instalment's shortfall against the 15/45/75/
 * 100% calendar, with the 12%/36% safe harbours for the first two instalments.
 * Every date, fraction, month count, and threshold is read from
 * rules/advance-tax.json, never hardcoded.
 *
 * The instalment targets apply to "assessed tax" - liability minus TDS - so
 * whatever part of taxAlreadyPaid exceeds the entered instalments is treated
 * as TDS and subtracted from the liability first (TDS never had to be paid as
 * instalments; it was deducted at source through the year).
 *
 * When capitalGainsTax is supplied (from allocateCapitalGainsTaxByInstalment),
 * that dated portion of assessed tax is required in full from the instalment
 * due after each gain was realised, exactly as the section's proviso
 * requires; the remainder ("ordinary" tax - salary/interest/dividends/
 * business/debt-MF, none of which this tool can date precisely) is still
 * spread evenly across all four instalments. Callers must always show
 * rule.values.section_234c.later_income_caveat alongside the figure, since
 * that remainder keeps this a ceiling rather than the exact bill. See
 * rules/advance-tax.md.
 */
export function estimateSection234cInterest(
  inputs: Section234cInputs,
  rule: AdvanceTaxRule
): Section234cResult {
  const ruleValues = rule.values.section_234c;
  const instalmentsPaid = ruleValues.instalments.map((_, index) =>
    Math.max(0, inputs.instalmentsPaid[index] ?? 0)
  );
  const instalmentsTotal = instalmentsPaid.reduce((sum, paid) => sum + paid, 0);
  const tdsTreatedAsDeducted = Math.max(0, inputs.taxAlreadyPaid - instalmentsTotal);
  const assessedTax = Math.max(0, inputs.totalTaxLiability - tdsTreatedAsDeducted);
  // Capped at assessedTax: a capital-gains figure larger than the entered
  // total tax liability means the two inputs disagree, and the cumulative
  // targets below must never exceed the year's actual assessed tax.
  const capitalGainsTaxForYear = Math.min(
    assessedTax,
    Math.max(0, inputs.capitalGainsTax?.totalForYear ?? 0)
  );
  const ordinaryTax = Math.max(0, assessedTax - capitalGainsTaxForYear);
  const none = {
    assessedTax,
    tdsTreatedAsDeducted,
    ordinaryTax,
    capitalGainsTaxForYear,
    instalments: [] as Section234cInstalment[],
    totalInterest: 0
  };

  if (assessedTax < ruleValues.no_interest_if_net_liability_below_inr) {
    return {
      required: false,
      interestApplies: false,
      reason: `Tax after TDS is under ₹${ruleValues.no_interest_if_net_liability_below_inr.toLocaleString("en-IN")}, so advance tax wasn't required and no Section 234C interest applies.`,
      ...none
    };
  }

  if (inputs.seniorCitizenExempt) {
    return {
      required: false,
      interestApplies: false,
      reason:
        "Resident senior citizens with no business or professional income are exempt from advance tax (Section 207(2)), so no Section 234C interest applies.",
      ...none
    };
  }

  let paidCumulative = 0;
  const instalments: Section234cInstalment[] = ruleValues.instalments.map((instalment, index) => {
    paidCumulative += instalmentsPaid[index];
    const capitalGainsCumulative = Math.max(
      0,
      inputs.capitalGainsTax?.cumulativeByInstalment[index] ?? 0
    );
    const requiredCumulative = Math.min(
      assessedTax,
      ordinaryTax * instalment.cumulative_fraction_due + capitalGainsCumulative
    );
    const shortfall = Math.max(0, requiredCumulative - paidCumulative);
    const safeHarborApplied =
      shortfall > 0 &&
      instalment.safe_harbor_cumulative_fraction !== null &&
      paidCumulative >= assessedTax * instalment.safe_harbor_cumulative_fraction;
    const interest =
      shortfall > 0 && !safeHarborApplied
        ? Math.round(shortfall * ruleValues.interest_rate_per_month * instalment.months_charged)
        : 0;
    return {
      dueDate: instalment.due_date,
      requiredCumulative: Math.round(requiredCumulative),
      paidCumulative,
      shortfall: Math.round(shortfall),
      monthsCharged: instalment.months_charged,
      interest,
      safeHarborApplied
    };
  });

  const totalInterest = instalments.reduce((sum, instalment) => sum + instalment.interest, 0);
  return {
    required: true,
    interestApplies: totalInterest > 0,
    reason:
      totalInterest > 0
        ? "Some instalments fell short of the Section 234C calendar (15% by 15 Jun, 45% by 15 Sep, 75% by 15 Dec, 100% by 15 Mar of the financial year)."
        : "Every instalment met the Section 234C calendar (or its safe harbour), so no Section 234C interest applies.",
    assessedTax,
    tdsTreatedAsDeducted,
    ordinaryTax,
    capitalGainsTaxForYear,
    instalments,
    totalInterest
  };
}
