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
  seniorCitizen: boolean;
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
    Math.max(0, inputs.dividends) +
    Math.max(0, inputs.interestOtherIncome) +
    Math.max(0, inputs.debtMfShortTermDeemedGain) +
    Math.max(0, inputs.intradayGain);
  const salary = Math.max(0, inputs.salaryIncome);

  const newRegimeSlabIncome = Math.max(0, salary - rule.values.new_regime.standard_deduction_inr) + otherSlabIncome;
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
    oldRegimeSalaryAfterStandardDeduction + oldRegimeOtherIncome - Math.max(0, inputs.oldRegimeDeductions)
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
