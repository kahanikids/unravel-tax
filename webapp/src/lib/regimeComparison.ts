import type { RegimeChoiceRule, RegimeRebate87a, TaxSlab } from "../rules";

export type RegimeComparisonInputs = {
  /** Gross salary/pension income, before the standard deduction. */
  salaryIncome: number;
  dividends: number;
  interestOtherIncome: number;
  /** 80TTA/80TTB, old regime only - the new regime doesn't allow it. */
  eligibleInterestDeduction: number;
  debtMfShortTermDeemedGain: number;
  intradayGain: number;
  /** A single lump sum for 80C, 80D, HRA, home loan interest, and similar - old regime only. */
  oldRegimeDeductions: number;
  /**
   * Let-out house-property income for the old-regime side, from
   * computeLetOutHouseProperty: may be negative (a loss), already capped at
   * the Section 71(3A) set-off limit. Defaults to 0 when there's no let-out home.
   */
  letOutIncomeOldRegime?: number;
  /** Let-out house-property income for the new-regime side: a loss can't offset other heads, so never negative. */
  letOutIncomeNewRegime?: number;
  seniorCitizen: boolean;
  /**
   * NRI only: a non-resident's dividends are taxed at a flat Section 115A/DTAA
   * rate (see lib/nriTax.ts), never at slab rate, so they're left out of both
   * regimes' slab income entirely when this is true. Defaults to false
   * (resident behaviour: dividends are ordinary slab income).
   */
  excludeDividendsFromSlab?: boolean;
  /**
   * Extra ordinary slab income from elsewhere in the tool (currently: a
   * taxable traditional-insurance-policy payout, see lib/insurance.ts),
   * folded into the same "other income" bucket as interestOtherIncome -
   * including sharing its 80TTA/80TTB deduction on the old-regime side,
   * the same blended-bucket approximation interestOtherIncome already makes.
   */
  additionalOtherSlabIncome?: number;
};

export type RegimeComparisonResult = {
  newRegimeSlabIncome: number;
  oldRegimeSlabIncome: number;
  newRegimeTax: number;
  oldRegimeTax: number;
  cheaperRegime: "new" | "old" | "equal";
  difference: number;
};

function taxFromSlabs(taxableIncome: number, slabs: TaxSlab[]): number {
  let tax = 0;
  let lowerBound = 0;
  for (const slab of slabs) {
    const upperBound = slab.up_to_inr ?? Infinity;
    if (taxableIncome <= lowerBound) {
      break;
    }
    const slabAmount = Math.min(taxableIncome, upperBound) - lowerBound;
    tax += slabAmount * slab.rate;
    lowerBound = upperBound;
  }
  return tax;
}

function applyRebate(tax: number, taxableIncome: number, rebate: RegimeRebate87a): number {
  if (taxableIncome <= rebate.taxable_income_at_or_below_inr) {
    return Math.max(0, tax - Math.min(tax, rebate.max_rebate_inr));
  }
  return tax;
}

/**
 * Compares tax on the slab-taxed portion of income only (salary, dividends,
 * interest, debt MF/intraday gains). Capital gains under Sections 111A/112A
 * are taxed the same flat way regardless of regime, so they're deliberately
 * left out. See rules/regime-choice.json's comparison_scope_caveat, which
 * this always ships alongside so the result is never shown without it.
 */
export function compareRegimes(inputs: RegimeComparisonInputs, rule: RegimeChoiceRule): RegimeComparisonResult {
  const otherSlabIncome =
    (inputs.excludeDividendsFromSlab ? 0 : Math.max(0, inputs.dividends)) +
    Math.max(0, inputs.interestOtherIncome) +
    Math.max(0, inputs.debtMfShortTermDeemedGain) +
    Math.max(0, inputs.intradayGain) +
    Math.max(0, inputs.additionalOtherSlabIncome ?? 0);
  const salary = Math.max(0, inputs.salaryIncome);
  // House property is the one head that can go negative here: the let-out
  // figures arrive pre-capped per regime (loss floored at zero for new,
  // capped at the set-off limit for old), so they're added as-is rather than
  // clamped like the other components.
  const letOutNew = Math.max(0, inputs.letOutIncomeNewRegime ?? 0);
  const letOutOld = inputs.letOutIncomeOldRegime ?? 0;

  const newRegimeSlabIncome = Math.max(
    0,
    Math.max(0, salary - rule.values.new_regime.standard_deduction_inr) + otherSlabIncome + letOutNew
  );
  // The new regime doesn't have separate age-based slabs, unlike the old one.
  let newRegimeTax = taxFromSlabs(newRegimeSlabIncome, rule.values.new_regime.slabs);
  newRegimeTax = applyRebate(newRegimeTax, newRegimeSlabIncome, rule.values.new_regime.rebate_87a);
  // Marginal relief: just above the rebate threshold, tax (before cess) is
  // capped at the income earned above the threshold, so crossing Rs 12L by
  // Rs 100 can't cost Rs 60,000 - see rules/regime-choice.md.
  const relief = rule.values.new_regime.marginal_relief;
  if (
    relief?.tax_capped_at_income_above_threshold &&
    newRegimeSlabIncome > relief.applies_above_taxable_income_inr
  ) {
    newRegimeTax = Math.min(newRegimeTax, newRegimeSlabIncome - relief.applies_above_taxable_income_inr);
  }
  newRegimeTax *= 1 + rule.values.cess_rate;

  const oldRegimeOtherIncome = Math.max(0, otherSlabIncome - Math.max(0, inputs.eligibleInterestDeduction));
  // The standard deduction only applies against salary income, so clamp it
  // there - otherwise a low or zero salary would let the unused part of the
  // deduction wrongly reduce interest/dividend income too.
  const oldRegimeSalaryAfterStandardDeduction = Math.max(0, salary - rule.values.old_regime.standard_deduction_inr);
  const oldRegimeSlabIncome = Math.max(
    0,
    oldRegimeSalaryAfterStandardDeduction + oldRegimeOtherIncome + letOutOld - Math.max(0, inputs.oldRegimeDeductions)
  );
  const oldRegimeSlabs = inputs.seniorCitizen ? rule.values.old_regime.slabs_60_to_80 : rule.values.old_regime.slabs_below_60;
  let oldRegimeTax = taxFromSlabs(oldRegimeSlabIncome, oldRegimeSlabs);
  oldRegimeTax = applyRebate(oldRegimeTax, oldRegimeSlabIncome, rule.values.old_regime.rebate_87a);
  oldRegimeTax *= 1 + rule.values.cess_rate;

  const roundedNew = Math.round(newRegimeTax);
  const roundedOld = Math.round(oldRegimeTax);

  return {
    newRegimeSlabIncome,
    oldRegimeSlabIncome,
    newRegimeTax: roundedNew,
    oldRegimeTax: roundedOld,
    cheaperRegime: roundedNew === roundedOld ? "equal" : roundedNew < roundedOld ? "new" : "old",
    difference: Math.abs(roundedNew - roundedOld)
  };
}

export type RegimeBreakEven = {
  /** New-regime tax (rounded, incl. cess) the old regime has to match. */
  newRegimeTax: number;
  /** Old-regime deductions at which old-regime tax would equal the new regime's. */
  breakEvenDeductions: number;
  /** The old-regime deductions actually entered (the same total the comparison uses). */
  actualDeductions: number;
  /** actualDeductions - breakEvenDeductions: positive means the old regime already wins. */
  surplus: number;
  /** True once the new regime already brings this income to zero tax - no deduction can beat it. */
  newAlwaysWins: boolean;
};

/**
 * The exact old-regime deductions (80C, 80D, HRA, 24(b), etc.) at which the
 * old regime's tax would exactly match the new regime's. Above it, the old
 * regime saves money; below it, the new regime (the default) wins.
 *
 * Solved generically off the same slab engine compareRegimes uses: old-regime
 * tax only ever falls as deductions rise, so a monotonic search finds the
 * crossover for any income - no slab rates or offsets are restated here (a
 * closed form like Gross - 675000 - newTax/0.30 only holds when the crossover
 * old-taxable lands in the 30% band, which it doesn't at every income). When
 * the new-regime tax is already zero (e.g. salary up to Rs 12.75 lakh), the
 * old regime can at best tie, so break-even is reported as zero / not
 * applicable rather than a large unreachable figure.
 */
export function computeRegimeBreakEven(inputs: RegimeComparisonInputs, rule: RegimeChoiceRule): RegimeBreakEven {
  const base = compareRegimes({ ...inputs, oldRegimeDeductions: 0 }, rule);
  const newRegimeTax = base.newRegimeTax;
  const actualDeductions = Math.max(0, inputs.oldRegimeDeductions);
  if (newRegimeTax <= 0) {
    return { newRegimeTax, breakEvenDeductions: 0, actualDeductions, surplus: actualDeductions, newAlwaysWins: true };
  }

  let breakEvenDeductions = 0;
  // Only search when the old regime isn't already at/below the new-regime tax
  // with zero deductions (otherwise any deductions keep old ahead: break-even 0).
  if (base.oldRegimeTax > newRegimeTax) {
    let lo = 0;
    // Deductions beyond the old-regime taxable base can't reduce tax further.
    let hi = base.oldRegimeSlabIncome;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const oldRegimeTax = compareRegimes({ ...inputs, oldRegimeDeductions: mid }, rule).oldRegimeTax;
      if (oldRegimeTax > newRegimeTax) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    breakEvenDeductions = Math.round(hi);
  }

  return {
    newRegimeTax,
    breakEvenDeductions,
    actualDeductions,
    surplus: actualDeductions - breakEvenDeductions,
    newAlwaysWins: false
  };
}
