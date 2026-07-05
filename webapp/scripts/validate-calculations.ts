import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import {
  allocateCapitalGainsTaxByInstalment,
  brokerGainCheck,
  caSummaryAmountMap,
  caSummaryRows,
  combined80cUsage,
  compareRegimes,
  computeForeignRemittanceTcs,
  computeLetOutHouseProperty,
  computeNriDividendTax,
  computeNriRepatriationCheck,
  computeNroTdsReconciliation,
  computeRegimeBreakEven,
  summarizeForeignAccounts,
  summarizeInsurancePolicies,
  type InsurancePolicy,
  estimateAdvanceTaxInterest,
  estimateSection234cInterest,
  summarizeWithRules
} from "../src/lib";
import { clubbedMinorIncome } from "../src/lib/profile";
import { BLANK_SUPPLEMENTAL_FIGURES } from "../src/state/types";
import { parseCsvText, parseHtmlText } from "../src/ingest";
import { ruleCatalog } from "../src/rules";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const fixturesDir = resolve(repoRoot, "fixtures");
const dryRunDir = resolve(repoRoot, "dry-runs", "m1c");
const topLevelRulesDir = resolve(repoRoot, "rules");
const webappRulesDir = resolve(repoRoot, "webapp", "src", "rules", "data");

type ReferenceRow = {
  Head: string;
  Amount: string;
};

async function readM1Reference() {
  const csv = await readFile(resolve(dryRunDir, "UnravelTax-M1C-CA-Summary.csv"), "utf8");
  const parsed = Papa.parse<ReferenceRow>(csv, {
    header: true,
    skipEmptyLines: true
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }
  return Object.fromEntries(
    parsed.data.map((row) => [row.Head, normalizeReferenceAmount(row.Amount)])
  );
}

async function assertMirroredRuleJsonMatchesSource() {
  const sourceNames = (await readdir(topLevelRulesDir))
    .filter((name) => name.endsWith(".json"))
    .sort();
  const mirroredNames = (await readdir(webappRulesDir))
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (JSON.stringify(sourceNames) !== JSON.stringify(mirroredNames)) {
    throw new Error("Webapp rule JSON mirror does not contain the same files as top-level rules/.");
  }

  for (const name of sourceNames) {
    const source = JSON.parse(await readFile(resolve(topLevelRulesDir, name), "utf8"));
    const mirrored = JSON.parse(await readFile(resolve(webappRulesDir, name), "utf8"));
    if (JSON.stringify(source) !== JSON.stringify(mirrored)) {
      throw new Error(`Mirrored rule JSON differs from top-level source: ${name}`);
    }
  }
}

function normalizeReferenceAmount(value: string) {
  if (value === "") {
    return "";
  }
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

export async function main() {
  await assertMirroredRuleJsonMatchesSource();

  const csv = await readFile(resolve(fixturesDir, "sample-broker-statement.csv"), "utf8");
  const parsed = parseCsvText(csv);
  const summary = summarizeWithRules(
    parsed.transactions,
    ruleCatalog.capitalGainsEquity,
    ruleCatalog.itrFormSelection
  );
  const generated = caSummaryAmountMap(
    caSummaryRows(parsed.transactions, ruleCatalog.capitalGainsEquity, ruleCatalog.itrFormSelection)
  );
  const reference = await readM1Reference();

  const referenceKeys = [
    "Speculative / Intraday income",
    "Short-Term Capital Gains",
    "Long-Term Capital Gains",
    "Dividends",
    "Interest & other income",
    "Eligible interest deduction",
    "Deductible transaction charges",
    "Carry-forward losses available",
    "Recommended ITR form",
    "CA review recommendation"
  ];

  for (const key of referenceKeys) {
    if (generated[key] !== reference[key]) {
      throw new Error(`CA Summary mismatch for ${key}: ${generated[key]} !== ${reference[key]}`);
    }
  }

  if (summary.estimatedStcgTax !== 0 || summary.estimatedLtcgTax !== 0) {
    throw new Error(
      "Synthetic fixture should not owe special-rate capital gains tax after losses/exemption."
    );
  }

  // Sale/cost totals: every bucket's gain must equal its own sale minus cost,
  // and the fixture's known totals must round-trip exactly.
  const t = summary.totals;
  if (t.all.saleValue !== 195800 || t.all.cost !== 190000) {
    throw new Error(`Unexpected overall totals: sale ${t.all.saleValue}, cost ${t.all.cost}.`);
  }
  for (const [name, bucket] of Object.entries(t)) {
    if (bucket.gain !== bucket.saleValue - bucket.cost) {
      throw new Error(
        `Bucket ${name}: gain ${bucket.gain} != sale ${bucket.saleValue} - cost ${bucket.cost}.`
      );
    }
  }
  if (t.stcg.saleValue !== 94500 || t.stcg.cost !== 95000 || t.stcg.gain !== summary.stcg) {
    throw new Error(`STCG bucket totals wrong: ${JSON.stringify(t.stcg)}.`);
  }
  if (generated["Total sale value"] !== 195800 || generated["Total cost of purchase"] !== 190000) {
    throw new Error("CA Summary should carry the Total sale value / Total cost of purchase rows.");
  }

  // Broker check: the grouped-header HTML fixture carries the broker's own
  // "Taxable Gain" column, whose per-bucket sums match the computed gains.
  const groupedHtml = parseHtmlText(
    await readFile(resolve(fixturesDir, "sample-broker-statement-grouped-header.html"), "utf8")
  );
  const check = brokerGainCheck(groupedHtml.transactions, ruleCatalog.capitalGainsEquity);
  if (!check || check.columnName !== "Taxable Gain") {
    throw new Error(
      `Expected the broker check to pick the "Taxable Gain" column, got ${JSON.stringify(check?.columnName)}.`
    );
  }
  for (const entry of check.perClass) {
    if (Math.abs(entry.computed - entry.broker) > 1) {
      throw new Error(
        `Broker check mismatch for ${entry.label}: computed ${entry.computed} vs broker ${entry.broker}.`
      );
    }
  }
  const noBrokerColumn = brokerGainCheck(parsed.transactions, ruleCatalog.capitalGainsEquity);
  if (noBrokerColumn !== null) {
    throw new Error(
      "CSV fixture has no broker gain column, so the broker check should be unavailable, not passing."
    );
  }

  // Regime comparison: a well-publicized FY2025-26 fact is that salary up to
  // Rs 12.75 lakh is effectively tax-free under the new regime (Rs 75,000
  // standard deduction plus the Section 87A rebate up to Rs 12 lakh taxable).
  // A plain Rs 12 lakh salary with nothing else should land exactly on that,
  // while the old regime (no equivalent rebate at this level) owes real tax.
  const regimeResult = compareRegimes(
    {
      salaryIncome: 1_200_000,
      dividends: 0,
      interestOtherIncome: 0,
      eligibleInterestDeduction: 0,
      debtMfShortTermDeemedGain: 0,
      intradayGain: 0,
      oldRegimeDeductions: 0,
      seniorCitizen: false
    },
    ruleCatalog.regimeChoice
  );
  if (regimeResult.newRegimeTax !== 0) {
    throw new Error(
      `Expected zero new-regime tax on Rs 12L salary (standard deduction + 87A rebate), got ${regimeResult.newRegimeTax}.`
    );
  }
  if (regimeResult.oldRegimeTax !== 163800) {
    throw new Error(
      `Expected Rs 163800 old-regime tax on Rs 12L salary, got ${regimeResult.oldRegimeTax}.`
    );
  }
  if (regimeResult.cheaperRegime !== "new") {
    throw new Error(
      "New regime should be cheaper for a plain Rs 12L salary with no other income or deductions."
    );
  }

  // Marginal relief: Rs 12,85,000 salary is Rs 12,10,000 taxable after the
  // standard deduction - Rs 10,000 over the rebate threshold. Slab tax would
  // be Rs 61,500, but Section 87A marginal relief caps it at the Rs 10,000
  // earned above the threshold; plus 4% cess = Rs 10,400.
  const marginalReliefResult = compareRegimes(
    {
      salaryIncome: 1_285_000,
      dividends: 0,
      interestOtherIncome: 0,
      eligibleInterestDeduction: 0,
      debtMfShortTermDeemedGain: 0,
      intradayGain: 0,
      oldRegimeDeductions: 0,
      seniorCitizen: false
    },
    ruleCatalog.regimeChoice
  );
  if (marginalReliefResult.newRegimeTax !== 10400) {
    throw new Error(
      `Expected Rs 10400 new-regime tax on Rs 12.85L salary (marginal relief + cess), got ${marginalReliefResult.newRegimeTax}.`
    );
  }

  // The standard deduction only applies to salary: interest-only income
  // must not have it subtracted under either regime.
  const noSalaryResult = compareRegimes(
    {
      salaryIncome: 0,
      dividends: 0,
      interestOtherIncome: 600_000,
      eligibleInterestDeduction: 0,
      debtMfShortTermDeemedGain: 0,
      intradayGain: 0,
      oldRegimeDeductions: 0,
      seniorCitizen: false
    },
    ruleCatalog.regimeChoice
  );
  // Old regime on Rs 6L with no deductions: 5% of 2.5L + 20% of 1L = 32,500, +4% cess = 33,800.
  if (noSalaryResult.oldRegimeTax !== 33800) {
    throw new Error(
      `Expected Rs 33800 old-regime tax on Rs 6L interest-only income (no standard deduction), got ${noSalaryResult.oldRegimeTax}.`
    );
  }

  // The zero-tax window's upper edge: Rs 12,75,000 salary is exactly
  // Rs 12,00,000 taxable after the Rs 75,000 standard deduction, landing on
  // the Section 87A rebate threshold, so a salaried filer owes Rs 0 new-regime
  // tax at the very top of the widely-quoted "up to Rs 12.75 lakh is tax-free"
  // range.
  const zeroTaxWindowEdge = compareRegimes(
    {
      salaryIncome: 1_275_000,
      dividends: 0,
      interestOtherIncome: 0,
      eligibleInterestDeduction: 0,
      debtMfShortTermDeemedGain: 0,
      intradayGain: 0,
      oldRegimeDeductions: 0,
      seniorCitizen: false
    },
    ruleCatalog.regimeChoice
  );
  if (zeroTaxWindowEdge.newRegimeTax !== 0) {
    throw new Error(
      `Expected zero new-regime tax at the Rs 12.75L salary edge of the zero-tax window, got ${zeroTaxWindowEdge.newRegimeTax}.`
    );
  }

  // Break-even deductions: the exact old-regime deductions at which old-regime
  // tax equals the new regime's. Solved on the same slab engine (never the
  // widely-quoted Gross - 675000 - newTax/0.30 shortcut, which only holds when
  // the crossover old-taxable lands in the 30% band).
  const breakEvenInputs = (salaryIncome: number) => ({
    salaryIncome,
    dividends: 0,
    interestOtherIncome: 0,
    eligibleInterestDeduction: 0,
    debtMfShortTermDeemedGain: 0,
    intradayGain: 0,
    oldRegimeDeductions: 0,
    seniorCitizen: false
  });

  // Up to Rs 12.75L salary the new regime is already zero-tax, so no amount of
  // old-regime deductions can beat it: there's no break-even to reach.
  const breakEven1275 = computeRegimeBreakEven(
    breakEvenInputs(1_275_000),
    ruleCatalog.regimeChoice
  );
  if (!breakEven1275.newAlwaysWins || breakEven1275.breakEvenDeductions !== 0) {
    throw new Error(
      `Expected no break-even at Rs 12.75L (new regime already zero-tax), got newAlwaysWins=${breakEven1275.newAlwaysWins}, breakEven=${breakEven1275.breakEvenDeductions}.`
    );
  }

  // Rs 15L: the crossover old-taxable lands in the 20% band, so the accurate
  // break-even (Rs 5,43,750) is higher than the 30%-band shortcut's Rs 5,12,500.
  // Rs 20L and Rs 25L: the crossover lands in the 30% band, so the accurate
  // figure matches the shortcut (Rs 7,08,333 and Rs 8,00,000). New-regime tax
  // is shown after the 4% cess, matching the rest of the comparison.
  const breakEvenCases = [
    { salary: 1_500_000, newRegimeTax: 97_500, breakEven: 543_750 },
    { salary: 2_000_000, newRegimeTax: 192_400, breakEven: 708_333 },
    { salary: 2_500_000, newRegimeTax: 319_800, breakEven: 800_000 }
  ];
  for (const testCase of breakEvenCases) {
    const breakEven = computeRegimeBreakEven(
      breakEvenInputs(testCase.salary),
      ruleCatalog.regimeChoice
    );
    if (breakEven.newRegimeTax !== testCase.newRegimeTax) {
      throw new Error(
        `Break-even case Rs ${testCase.salary}: expected new-regime tax ${testCase.newRegimeTax}, got ${breakEven.newRegimeTax}.`
      );
    }
    if (Math.abs(breakEven.breakEvenDeductions - testCase.breakEven) > 10) {
      throw new Error(
        `Break-even case Rs ${testCase.salary}: expected break-even deductions ~${testCase.breakEven}, got ${breakEven.breakEvenDeductions}.`
      );
    }
  }

  // Old-regime senior (60-79) band must actually be applied: the Rs 3,00,000
  // basic exemption (vs Rs 2,50,000 below 60) should make a senior's tax
  // lower than an identical non-senior's on the same income.
  const seniorInputs = {
    salaryIncome: 900_000,
    dividends: 0,
    interestOtherIncome: 0,
    eligibleInterestDeduction: 0,
    debtMfShortTermDeemedGain: 0,
    intradayGain: 0,
    oldRegimeDeductions: 0
  };
  const seniorRegime = compareRegimes(
    { ...seniorInputs, seniorCitizen: true },
    ruleCatalog.regimeChoice
  );
  const nonSeniorRegime = compareRegimes(
    { ...seniorInputs, seniorCitizen: false },
    ruleCatalog.regimeChoice
  );
  // Taxable Rs 8,50,000 after the Rs 50,000 standard deduction. Senior 60-79:
  // 5% of (5L-3L) + 20% of (8.5L-5L) = 10,000 + 70,000 = 80,000, +4% cess = 83,200.
  if (seniorRegime.oldRegimeTax !== 83_200) {
    throw new Error(
      `Expected Rs 83,200 old-regime tax for a senior on Rs 9L salary, got ${seniorRegime.oldRegimeTax}.`
    );
  }
  // Below 60 on the same income: the extra Rs 50,000 taxed at 5% = Rs 2,500,
  // +4% cess = Rs 2,600 more, i.e. Rs 85,800.
  if (nonSeniorRegime.oldRegimeTax !== 85_800) {
    throw new Error(
      `Expected Rs 85,800 old-regime tax below 60 on Rs 9L salary, got ${nonSeniorRegime.oldRegimeTax}.`
    );
  }
  if (!(seniorRegime.oldRegimeTax < nonSeniorRegime.oldRegimeTax)) {
    throw new Error(
      "Senior 60-79 old-regime band should tax less than the below-60 band on the same income."
    );
  }

  // Super senior (80+) band must actually be applied, not just seniorCitizen:
  // the Rs 5,00,000 basic exemption (vs Rs 3,00,000 for 60-79) should make an
  // 80+ filer's tax lower than a 60-79 filer's on the same income, and
  // superSeniorCitizen alone (without seniorCitizen) must not trigger it.
  const superSeniorRegime = compareRegimes(
    { ...seniorInputs, seniorCitizen: true, superSeniorCitizen: true },
    ruleCatalog.regimeChoice
  );
  // Taxable Rs 8,50,000 after the Rs 50,000 standard deduction. 80+: 20% of
  // (8.5L-5L) = 70,000, +4% cess = 72,800.
  if (superSeniorRegime.oldRegimeTax !== 72_800) {
    throw new Error(
      `Expected Rs 72,800 old-regime tax for an 80+ filer on Rs 9L salary, got ${superSeniorRegime.oldRegimeTax}.`
    );
  }
  if (!(superSeniorRegime.oldRegimeTax < seniorRegime.oldRegimeTax)) {
    throw new Error(
      "Super-senior 80+ old-regime band should tax less than the 60-79 band on the same income."
    );
  }
  const superSeniorFlagIgnoredWithoutSenior = compareRegimes(
    { ...seniorInputs, seniorCitizen: false, superSeniorCitizen: true },
    ruleCatalog.regimeChoice
  );
  if (superSeniorFlagIgnoredWithoutSenior.oldRegimeTax !== nonSeniorRegime.oldRegimeTax) {
    throw new Error("superSeniorCitizen should be ignored unless seniorCitizen is also true.");
  }

  // Section 234B advance-tax interest: below the Section 208 threshold, no
  // advance tax was required at all.
  const belowThreshold = estimateAdvanceTaxInterest(
    {
      totalTaxLiability: 5000,
      taxAlreadyPaid: 0,
      asOfDate: "2026-07-03",
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (belowThreshold.required || belowThreshold.interestApplies) {
    throw new Error(
      "Tax due under the Rs 10,000 Section 208 threshold should not require advance tax."
    );
  }

  // Senior citizens without business income are exempt regardless of amount.
  const seniorExempt = estimateAdvanceTaxInterest(
    {
      totalTaxLiability: 50000,
      taxAlreadyPaid: 0,
      asOfDate: "2026-07-03",
      seniorCitizenExempt: true
    },
    ruleCatalog.advanceTax
  );
  if (seniorExempt.required || seniorExempt.interestApplies) {
    throw new Error(
      "Senior citizens without business income should be exempt from advance tax (Section 207(2))."
    );
  }

  // Paying at least 90% of assessed tax avoids 234B interest entirely.
  const wellPaid = estimateAdvanceTaxInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 95000,
      asOfDate: "2026-07-03",
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (wellPaid.interestApplies) {
    throw new Error("Paying at least 90% of assessed tax should avoid Section 234B interest.");
  }

  // A full shortfall from 1 April 2026 (AY start) to 3 July 2026 spans 4
  // months (April, May, June, and a part of July rounding up), at 1% each.
  const shortfallCase = estimateAdvanceTaxInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 0,
      asOfDate: "2026-07-03",
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (shortfallCase.monthsElapsed !== 4) {
    throw new Error(
      `Expected 4 months elapsed from 2026-04-01 to 2026-07-03, got ${shortfallCase.monthsElapsed}.`
    );
  }
  if (shortfallCase.estimatedInterest !== 4000) {
    throw new Error(
      `Expected Rs 4,000 estimated 234B interest (Rs 100,000 x 1% x 4 months), got ${shortfallCase.estimatedInterest}.`
    );
  }

  // Minor's-income clubbing: two children each get the Rs 1,500 exemption,
  // capped at two children even if more are entered.
  const clubbedTwoChildren = clubbedMinorIncome(10000, 2, ruleCatalog.singleParentClubbing);
  if (clubbedTwoChildren !== 7000) {
    throw new Error(
      `Expected Rs 7,000 clubbed after two Rs 1,500 exemptions on Rs 10,000, got ${clubbedTwoChildren}.`
    );
  }
  const clubbedCappedAtTwo = clubbedMinorIncome(10000, 4, ruleCatalog.singleParentClubbing);
  if (clubbedCappedAtTwo !== clubbedTwoChildren) {
    throw new Error(
      "Minor's-income exemption should cap at max_children_for_exemption even with more children entered."
    );
  }
  // Section 64(1A) exceptions (the minor's own work/skill or an 80U
  // disability) come off before the Rs 1,500-per-child exemption:
  // 10,000 - 4,000 excluded - 3,000 exemption = 3,000.
  const clubbedWithExclusion = clubbedMinorIncome(10000, 2, ruleCatalog.singleParentClubbing, 4000);
  if (clubbedWithExclusion !== 3000) {
    throw new Error(
      `Expected Rs 3,000 clubbed after a Rs 4,000 exclusion and two exemptions, got ${clubbedWithExclusion}.`
    );
  }
  // Excluding everything (or more than the income) clubs nothing, never negative.
  if (clubbedMinorIncome(10000, 2, ruleCatalog.singleParentClubbing, 12000) !== 0) {
    throw new Error("Excluding more than the minor's income should club zero, not go negative.");
  }

  // Section 234C: an assessed tax of Rs 100,000 with nothing paid at all owes
  // interest on every instalment's full cumulative target -
  // (15,000 + 45,000 + 75,000) x 1% x 3 months + 100,000 x 1% x 1 month = Rs 5,050.
  const c234Nothing = estimateSection234cInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 0,
      instalmentsPaid: [0, 0, 0, 0],
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (c234Nothing.totalInterest !== 5050) {
    throw new Error(
      `Expected Rs 5,050 total 234C interest on a full Rs 100,000 default, got ${c234Nothing.totalInterest}.`
    );
  }
  if (
    c234Nothing.instalments.map((instalment) => instalment.interest).join(",") !==
    "450,1350,2250,1000"
  ) {
    throw new Error(
      `Unexpected per-instalment 234C interest: ${JSON.stringify(c234Nothing.instalments)}.`
    );
  }

  // Safe harbours: 12% paid by 15 June clears the first instalment despite the
  // 15% target; 36% by 15 September clears the second despite 45%. Third and
  // fourth targets met exactly leave nothing due.
  const c234SafeHarbor = estimateSection234cInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 100000,
      instalmentsPaid: [12000, 24000, 39000, 25000],
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (c234SafeHarbor.totalInterest !== 0 || c234SafeHarbor.interestApplies) {
    throw new Error(
      `Expected the 12%/36% safe harbours + met targets to owe no 234C interest, got ${c234SafeHarbor.totalInterest}.`
    );
  }
  if (
    !c234SafeHarbor.instalments[0].safeHarborApplied ||
    !c234SafeHarbor.instalments[1].safeHarborApplied
  ) {
    throw new Error("The first two instalments should be cleared by the 12%/36% safe harbours.");
  }

  // Just under a safe harbour, interest is charged on the shortfall from the
  // real target, not from the safe-harbour line: paid 11% by 15 June means
  // (15,000 - 11,000) x 1% x 3 = Rs 120 for the first instalment.
  const c234UnderHarbor = estimateSection234cInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 100000,
      instalmentsPaid: [11000, 34000, 30000, 25000],
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (c234UnderHarbor.instalments[0].interest !== 120) {
    throw new Error(
      `Expected Rs 120 first-instalment 234C interest at 11% paid, got ${c234UnderHarbor.instalments[0].interest}.`
    );
  }
  if (c234UnderHarbor.totalInterest !== 120) {
    throw new Error(
      `Expected only the first instalment to owe (45%/75%/100% met), got ${c234UnderHarbor.totalInterest}.`
    );
  }

  // TDS is whatever part of taxAlreadyPaid exceeds the entered instalments,
  // and comes off the liability before the targets: liability Rs 100,000 with
  // Rs 95,000 of pure TDS leaves assessed tax Rs 5,000 - under the Rs 10,000
  // floor, so no 234C at all.
  const c234TdsOnly = estimateSection234cInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 95000,
      instalmentsPaid: [0, 0, 0, 0],
      seniorCitizenExempt: false
    },
    ruleCatalog.advanceTax
  );
  if (c234TdsOnly.required || c234TdsOnly.interestApplies || c234TdsOnly.assessedTax !== 5000) {
    throw new Error(`TDS above the floor should leave no 234C: ${JSON.stringify(c234TdsOnly)}.`);
  }

  // Senior citizens without business income owe no 234C either (Section 207(2)).
  const c234Senior = estimateSection234cInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 0,
      instalmentsPaid: [0, 0, 0, 0],
      seniorCitizenExempt: true
    },
    ruleCatalog.advanceTax
  );
  if (c234Senior.required || c234Senior.interestApplies) {
    throw new Error(
      "Senior citizens without business income should be exempt from 234C (Section 207(2))."
    );
  }

  // Section 234C quarter precision: a Rs 5,00,000 STCG sold 20-Feb-2026 (inside
  // the last instalment window only) generates Rs 1,00,000 tax at the flat 20%
  // rate (Section 111A). allocateCapitalGainsTaxByInstalment must attribute
  // that tax only to the instalment due after the sale (15 Mar), not any
  // earlier one.
  const lateGainCsv = [
    "Scrip Name,Purchase Date,Sell Date,Units,Buy Value,Sell Value,Buy Price,Sell Price",
    "Late Gain Ltd,01-Feb-2026,20-Feb-2026,1000,0,500000,0,500"
  ].join("\n");
  const lateGainAllocation = allocateCapitalGainsTaxByInstalment(
    parseCsvText(lateGainCsv).transactions,
    ruleCatalog.capitalGainsEquity,
    ruleCatalog.advanceTax
  );
  if (lateGainAllocation.cumulativeByInstalment.join(",") !== "0,0,0,100000") {
    throw new Error(
      `Expected the late STCG's tax to land only in the last instalment, got ${JSON.stringify(lateGainAllocation.cumulativeByInstalment)}.`
    );
  }
  if (lateGainAllocation.totalForYear !== 100000) {
    throw new Error(
      `Expected Rs 1,00,000 total STCG tax for the year, got ${lateGainAllocation.totalForYear}.`
    );
  }

  // Feeding that allocation into estimateSection234cInterest with nothing paid:
  // the first three instalments owe nothing (the gain hadn't happened yet), and
  // only the last instalment's Rs 1,00,000 shortfall for one month draws
  // interest - Rs 1,000, versus Rs 5,050 if the same total tax were naively
  // spread evenly across the year (the c234Nothing case above). Quarter
  // precision must produce the lower, legally correct figure.
  const c234LateGain = estimateSection234cInterest(
    {
      totalTaxLiability: 100000,
      taxAlreadyPaid: 0,
      instalmentsPaid: [0, 0, 0, 0],
      seniorCitizenExempt: false,
      capitalGainsTax: lateGainAllocation
    },
    ruleCatalog.advanceTax
  );
  if (c234LateGain.instalments.slice(0, 3).some((instalment) => instalment.interest !== 0)) {
    throw new Error(
      `Expected no interest on the first three instalments before the gain arose, got ${JSON.stringify(c234LateGain.instalments)}.`
    );
  }
  if (c234LateGain.totalInterest !== 1000) {
    throw new Error(
      `Expected Rs 1,000 total 234C interest with quarter precision on an all-late gain, got ${c234LateGain.totalInterest}.`
    );
  }
  if (c234LateGain.ordinaryTax !== 0 || c234LateGain.capitalGainsTaxForYear !== 100000) {
    throw new Error(
      `Expected the full Rs 1,00,000 to be attributed to capital gains, got ordinaryTax=${c234LateGain.ordinaryTax}, capitalGainsTaxForYear=${c234LateGain.capitalGainsTaxForYear}.`
    );
  }

  // An early gain is the mirror case: tax on a gain that already happened by
  // the first due date must count in full toward that instalment, even though
  // the naive whole-year spread would only ask for 15% of it. A Rs 2,00,000
  // STCG sold 10-Apr-2025 (Rs 40,000 tax) plus the same late Rs 3,00,000 STCG
  // sold 20-Feb-2026 (Rs 60,000 tax, in the last window only) gives cumulative
  // targets of Rs 40,000/40,000/40,000/1,00,000 - the first instalment owes
  // the full Rs 40,000, not just Rs 6,000 (15% of Rs 40,000).
  const mixedGainsCsv = [
    "Scrip Name,Purchase Date,Sell Date,Units,Buy Value,Sell Value,Buy Price,Sell Price",
    "Early Gain Ltd,01-Apr-2025,10-Apr-2025,1000,0,200000,0,200",
    "Late Gain Ltd,01-Feb-2026,20-Feb-2026,1000,0,300000,0,300"
  ].join("\n");
  const mixedGainsAllocation = allocateCapitalGainsTaxByInstalment(
    parseCsvText(mixedGainsCsv).transactions,
    ruleCatalog.capitalGainsEquity,
    ruleCatalog.advanceTax
  );
  if (mixedGainsAllocation.cumulativeByInstalment.join(",") !== "40000,40000,40000,100000") {
    throw new Error(
      `Unexpected mixed-timing cumulative allocation: ${JSON.stringify(mixedGainsAllocation.cumulativeByInstalment)}.`
    );
  }

  // Long-term exemption is applied cumulatively, so it's used up by the
  // earliest gains first: a Rs 1,00,000 LTCG sold 10-May-2025 (window 1) stays
  // fully under the Rs 1,25,000 annual exemption (zero tax), and a further Rs
  // 1,00,000 LTCG sold 01-Nov-2025 (window 3) pushes the cumulative to Rs
  // 2,00,000, taxing only the Rs 75,000 above the exemption at 12.5% = Rs
  // 9,375 - not a fresh per-transaction exemption.
  const ltcgExemptionCsv = [
    "Scrip Name,Purchase Date,Sell Date,Units,Buy Value,Sell Value,Buy Price,Sell Price",
    "Old Holding Ltd,01-Jan-2023,10-May-2025,1000,0,100000,0,100",
    "Older Holding Ltd,01-Jan-2022,01-Nov-2025,1000,0,100000,0,100"
  ].join("\n");
  const ltcgExemptionAllocation = allocateCapitalGainsTaxByInstalment(
    parseCsvText(ltcgExemptionCsv).transactions,
    ruleCatalog.capitalGainsEquity,
    ruleCatalog.advanceTax
  );
  if (ltcgExemptionAllocation.cumulativeByInstalment.join(",") !== "0,0,9375,9375") {
    throw new Error(
      `Unexpected cumulative LTCG-exemption allocation: ${JSON.stringify(ltcgExemptionAllocation.cumulativeByInstalment)}.`
    );
  }
  if (ltcgExemptionAllocation.totalForYear !== 9375) {
    throw new Error(
      `Expected Rs 9,375 total LTCG tax after the cumulative exemption, got ${ltcgExemptionAllocation.totalForYear}.`
    );
  }

  // NRI dividend tax (Section 115A/DTAA): UAE's 10% treaty rate beats the 20%
  // domestic rate, so it applies - Rs 1,00,000 dividends -> Rs 10,000 tax.
  const uaeDividendTax = computeNriDividendTax(
    100000,
    "United Arab Emirates",
    ruleCatalog.nriDtaa,
    ruleCatalog.nriTdsAndRefunds
  );
  if (
    uaeDividendTax.tax !== 10000 ||
    !uaeDividendTax.treatyApplied ||
    uaeDividendTax.effectiveRate !== 0.1
  ) {
    throw new Error(
      `Expected Rs 10,000 UAE dividend tax at the 10% treaty rate, got ${JSON.stringify(uaeDividendTax)}.`
    );
  }

  // The US treaty's individual/portfolio dividend rate (25%) is actually
  // higher than the 20% domestic Section 115A rate, so the domestic rate
  // wins and the treaty gives no benefit - Rs 1,00,000 -> Rs 20,000 tax, not
  // Rs 25,000.
  const usDividendTax = computeNriDividendTax(
    100000,
    "United States",
    ruleCatalog.nriDtaa,
    ruleCatalog.nriTdsAndRefunds
  );
  if (
    usDividendTax.tax !== 20000 ||
    usDividendTax.treatyApplied ||
    usDividendTax.effectiveRate !== 0.2
  ) {
    throw new Error(
      `Expected Rs 20,000 US dividend tax at the 20% domestic rate (25% treaty rate is higher), got ${JSON.stringify(usDividendTax)}.`
    );
  }

  // No known country (or no corroborated treaty rate): falls back to the 20%
  // domestic rate, same as the US case above.
  const unknownDividendTax = computeNriDividendTax(
    100000,
    null,
    ruleCatalog.nriDtaa,
    ruleCatalog.nriTdsAndRefunds
  );
  if (unknownDividendTax.tax !== 20000 || unknownDividendTax.treatyApplied) {
    throw new Error(
      `Expected Rs 20,000 dividend tax with no known country, got ${JSON.stringify(unknownDividendTax)}.`
    );
  }

  // NRO TDS reconciliation (UAE): Rs 2,00,000 NRO interest withheld at the
  // domestic 30% (Rs 60,000) vs the treaty's 12.5% cap (Rs 25,000) leaves a
  // Rs 35,000 recoverable gap; Rs 1,00,000 dividends withheld at the domestic
  // 20% (Rs 20,000) vs the treaty's 10% cap (Rs 10,000) leaves Rs 10,000 more
  // - Rs 45,000 total.
  const uaeTdsReconciliation = computeNroTdsReconciliation(
    {
      nroInterest: 200000,
      dividends: 100000,
      interestTdsWithheld: 60000,
      dividendTdsWithheld: 20000,
      nriCountry: "United Arab Emirates"
    },
    ruleCatalog.nriDtaa,
    ruleCatalog.nriTdsAndRefunds
  );
  if (uaeTdsReconciliation.interest.recoverableIfTreatyApplies !== 35000) {
    throw new Error(
      `Expected Rs 35,000 recoverable NRO interest TDS, got ${uaeTdsReconciliation.interest.recoverableIfTreatyApplies}.`
    );
  }
  if (uaeTdsReconciliation.dividends.recoverableIfTreatyApplies !== 10000) {
    throw new Error(
      `Expected Rs 10,000 recoverable dividend TDS, got ${uaeTdsReconciliation.dividends.recoverableIfTreatyApplies}.`
    );
  }
  if (uaeTdsReconciliation.totalRecoverable !== 45000) {
    throw new Error(
      `Expected Rs 45,000 total recoverable NRO TDS, got ${uaeTdsReconciliation.totalRecoverable}.`
    );
  }

  // With no known treaty rate for the country, there's nothing to compare
  // against, so the reconciliation must never invent a recoverable amount.
  const unknownTdsReconciliation = computeNroTdsReconciliation(
    {
      nroInterest: 200000,
      dividends: 100000,
      interestTdsWithheld: 60000,
      dividendTdsWithheld: 20000,
      nriCountry: null
    },
    ruleCatalog.nriDtaa,
    ruleCatalog.nriTdsAndRefunds
  );
  if (unknownTdsReconciliation.totalRecoverable !== 0) {
    throw new Error(
      `Expected no recoverable NRO TDS with an unknown country, got ${unknownTdsReconciliation.totalRecoverable}.`
    );
  }

  // NRI repatriation check: below both thresholds, no certificate required.
  const belowRepatriationLimits = computeNriRepatriationCheck(
    { amountUsd: 50000, amountInr: 400000 },
    ruleCatalog.nriRepatriation
  );
  if (belowRepatriationLimits.overLimitUsd || belowRepatriationLimits.requiresCaCertificate) {
    throw new Error(
      `Expected no limit/certificate trip below both thresholds, got ${JSON.stringify(belowRepatriationLimits)}.`
    );
  }

  // Past the Rs 5 lakh mark (but well under the USD 1M cap): CA certificate
  // required, cap not breached.
  const pastCertificateThreshold = computeNriRepatriationCheck(
    { amountUsd: 50000, amountInr: 600000 },
    ruleCatalog.nriRepatriation
  );
  if (!pastCertificateThreshold.requiresCaCertificate || pastCertificateThreshold.overLimitUsd) {
    throw new Error(
      `Expected a CA-certificate requirement but no USD cap breach, got ${JSON.stringify(pastCertificateThreshold)}.`
    );
  }
  if (
    pastCertificateThreshold.formNames.length !== 2 ||
    !pastCertificateThreshold.formNames[0].includes("145")
  ) {
    throw new Error(
      `Expected the renamed Form 145/146 names, got ${JSON.stringify(pastCertificateThreshold.formNames)}.`
    );
  }

  // Past the USD 1 million/year NRO cap.
  const overUsdCap = computeNriRepatriationCheck(
    { amountUsd: 1_200_000, amountInr: 0 },
    ruleCatalog.nriRepatriation
  );
  if (!overUsdCap.overLimitUsd) {
    throw new Error(
      `Expected the USD 1M NRO cap to be flagged as breached, got ${JSON.stringify(overUsdCap)}.`
    );
  }

  // Schedule FA Phase 1: totals sum across accounts, and the disclosure
  // calendar year is the year the financial year STARTS in (FY 2025-26 -> 2025).
  const foreignAccountsSummary = summarizeForeignAccounts(
    [
      {
        id: "a1",
        accountType: "depository",
        country: "United States",
        institutionName: "Chase",
        accountNumber: "1",
        openingDate: "",
        peakBalanceInr: 500000,
        closingBalanceInr: 300000,
        grossInterestInr: 10000
      },
      {
        id: "a2",
        accountType: "custodial",
        country: "United States",
        institutionName: "Schwab",
        accountNumber: "2",
        openingDate: "",
        peakBalanceInr: 200000,
        closingBalanceInr: 200000,
        grossInterestInr: 5000
      }
    ],
    ruleCatalog.foreignInvestments
  );
  if (foreignAccountsSummary.totalPeakBalanceInr !== 700000) {
    throw new Error(
      `Expected Rs 7,00,000 total peak balance, got ${foreignAccountsSummary.totalPeakBalanceInr}.`
    );
  }
  if (foreignAccountsSummary.totalClosingBalanceInr !== 500000) {
    throw new Error(
      `Expected Rs 5,00,000 total closing balance, got ${foreignAccountsSummary.totalClosingBalanceInr}.`
    );
  }
  if (foreignAccountsSummary.totalGrossInterestInr !== 15000) {
    throw new Error(
      `Expected Rs 15,000 total gross interest, got ${foreignAccountsSummary.totalGrossInterestInr}.`
    );
  }
  if (foreignAccountsSummary.disclosureCalendarYear !== 2025) {
    throw new Error(
      `Expected disclosure calendar year 2025 for FY 2025-26, got ${foreignAccountsSummary.disclosureCalendarYear}.`
    );
  }

  // Regime comparison excludes NRI dividends from slab income entirely: a Rs
  // 12L salary plus Rs 1L dividends should tax exactly the same as the known
  // Rs 12L-salary-only case (new regime zero, old regime Rs 1,63,800) once
  // excludeDividendsFromSlab is set.
  const nriRegimeResult = compareRegimes(
    {
      salaryIncome: 1_200_000,
      dividends: 100_000,
      interestOtherIncome: 0,
      eligibleInterestDeduction: 0,
      debtMfShortTermDeemedGain: 0,
      intradayGain: 0,
      oldRegimeDeductions: 0,
      excludeDividendsFromSlab: true,
      seniorCitizen: false
    },
    ruleCatalog.regimeChoice
  );
  if (nriRegimeResult.newRegimeTax !== 0 || nriRegimeResult.oldRegimeTax !== 163800) {
    throw new Error(
      `Expected NRI dividends to be fully excluded from slab income, got ${JSON.stringify(nriRegimeResult)}.`
    );
  }

  // Insurance payouts (Section 10(10D)), computed per policy:
  const blankPolicy: InsurancePolicy = {
    id: "test",
    policyType: "traditional",
    isDeathBenefit: false,
    issueDate: "",
    sumAssured: 0,
    annualPremium: 0,
    totalPremiumsPaidToDate: 0,
    maturityPayoutThisYear: 0
  };

  // A death benefit is exempt regardless of premium or payout size.
  const deathBenefitSummary = summarizeInsurancePolicies(
    [
      {
        ...blankPolicy,
        isDeathBenefit: true,
        annualPremium: 900000,
        maturityPayoutThisYear: 10000000
      }
    ],
    ruleCatalog.insurance,
    ruleCatalog.capitalGainsEquity
  );
  if (
    !deathBenefitSummary.results[0].exempt ||
    deathBenefitSummary.totalOtherSourcesSlabIncome !== 0
  ) {
    throw new Error(
      `Expected a death benefit to stay exempt, got ${JSON.stringify(deathBenefitSummary.results[0])}.`
    );
  }

  // A modest traditional policy within both the sum-assured ratio (5%) and
  // the aggregate cap stays exempt.
  const exemptTraditionalSummary = summarizeInsurancePolicies(
    [
      {
        ...blankPolicy,
        issueDate: "2024-01-01",
        sumAssured: 1000000,
        annualPremium: 50000,
        totalPremiumsPaidToDate: 150000,
        maturityPayoutThisYear: 200000
      }
    ],
    ruleCatalog.insurance,
    ruleCatalog.capitalGainsEquity
  );
  if (!exemptTraditionalSummary.results[0].exempt) {
    throw new Error(
      `Expected a modest traditional policy to stay exempt, got ${JSON.stringify(exemptTraditionalSummary.results[0])}.`
    );
  }

  // A traditional policy breaching the Rs 5,00,000 aggregate cap loses its
  // exemption; taxable amount = payout minus premiums paid = Rs 10,00,000.
  const aggregateTraditionalSummary = summarizeInsurancePolicies(
    [
      {
        ...blankPolicy,
        issueDate: "2024-01-01",
        sumAssured: 10000000,
        annualPremium: 600000,
        totalPremiumsPaidToDate: 2000000,
        maturityPayoutThisYear: 3000000
      }
    ],
    ruleCatalog.insurance,
    ruleCatalog.capitalGainsEquity
  );
  const aggregateResult = aggregateTraditionalSummary.results[0];
  if (
    aggregateResult.exempt ||
    !aggregateResult.failsAggregateTest ||
    aggregateResult.taxableAmount !== 1000000
  ) {
    throw new Error(
      `Expected the aggregate-cap traditional policy to owe tax on Rs 10,00,000, got ${JSON.stringify(aggregateResult)}.`
    );
  }
  if (aggregateTraditionalSummary.totalOtherSourcesSlabIncome !== 1000000) {
    throw new Error(
      `Expected Rs 10,00,000 total other-sources slab income, got ${aggregateTraditionalSummary.totalOtherSourcesSlabIncome}.`
    );
  }

  // A policy can lose its exemption purely on the sum-assured ratio even
  // when nowhere near the aggregate cap: Rs 20,000 premium on a Rs 1,00,000
  // sum assured is 20%, over the 10% limit for policies issued after
  // 1-Apr-2012.
  const ratioTraditionalSummary = summarizeInsurancePolicies(
    [
      {
        ...blankPolicy,
        issueDate: "2024-01-01",
        sumAssured: 100000,
        annualPremium: 20000,
        totalPremiumsPaidToDate: 40000,
        maturityPayoutThisYear: 60000
      }
    ],
    ruleCatalog.insurance,
    ruleCatalog.capitalGainsEquity
  );
  const ratioResult = ratioTraditionalSummary.results[0];
  if (ratioResult.exempt || !ratioResult.failsRatioTest || ratioResult.failsAggregateTest) {
    throw new Error(
      `Expected the sum-assured-ratio test alone to disqualify this policy, got ${JSON.stringify(ratioResult)}.`
    );
  }

  // A ULIP breaching its Rs 2,50,000 aggregate cap, issued long enough ago to
  // be long-term: taxable amount Rs 15,00,000, LTCG tax after the Rs 1,25,000
  // exemption = (15,00,000 - 1,25,000) x 12.5% = Rs 1,71,875.
  const ulipLtSummary = summarizeInsurancePolicies(
    [
      {
        ...blankPolicy,
        policyType: "ulip",
        issueDate: "2023-01-01",
        sumAssured: 10000000,
        annualPremium: 300000,
        totalPremiumsPaidToDate: 1000000,
        maturityPayoutThisYear: 2500000
      }
    ],
    ruleCatalog.insurance,
    ruleCatalog.capitalGainsEquity
  );
  const ulipLtResult = ulipLtSummary.results[0];
  if (ulipLtResult.taxTreatment !== "capital_gains_lt" || ulipLtResult.estimatedTax !== 171875) {
    throw new Error(
      `Expected Rs 1,71,875 long-term ULIP capital-gains tax, got ${JSON.stringify(ulipLtResult)}.`
    );
  }
  if (
    ulipLtSummary.totalUlipCapitalGainsTax !== 171875 ||
    ulipLtSummary.totalOtherSourcesSlabIncome !== 0
  ) {
    throw new Error(
      `Expected the ULIP tax to stay out of other-sources slab income, got ${JSON.stringify(ulipLtSummary)}.`
    );
  }

  // A recently-issued ULIP failing the sum-assured ratio test (15% > 10%
  // limit) is short-term: taxable amount Rs 35,000, STCG tax at 20% = Rs 7,000.
  const ulipStSummary = summarizeInsurancePolicies(
    [
      {
        ...blankPolicy,
        policyType: "ulip",
        issueDate: "2026-01-01",
        sumAssured: 100000,
        annualPremium: 15000,
        totalPremiumsPaidToDate: 15000,
        maturityPayoutThisYear: 50000
      }
    ],
    ruleCatalog.insurance,
    ruleCatalog.capitalGainsEquity
  );
  const ulipStResult = ulipStSummary.results[0];
  if (ulipStResult.taxTreatment !== "capital_gains_st" || ulipStResult.estimatedTax !== 7000) {
    throw new Error(
      `Expected Rs 7,000 short-term ULIP capital-gains tax, got ${JSON.stringify(ulipStResult)}.`
    );
  }

  // Let-out house property: rent Rs 2,40,000 minus Rs 40,000 municipal taxes
  // = NAV Rs 2,00,000; minus 30% (Rs 60,000) and Rs 3,00,000 interest =
  // Rs 1,60,000 loss. Old regime takes the full loss (under the Rs 2L cap);
  // new regime takes none of it.
  const letOutFigures = {
    ...BLANK_SUPPLEMENTAL_FIGURES,
    letOutRentReceived: 240000,
    letOutMunicipalTaxes: 40000,
    homeLoanInterestLetOut: 300000
  };
  const letOutLoss = computeLetOutHouseProperty(letOutFigures, ruleCatalog.loanTreatment);
  if (
    letOutLoss.netIncome !== -160000 ||
    letOutLoss.oldRegimeIncome !== -160000 ||
    letOutLoss.newRegimeIncome !== 0
  ) {
    throw new Error(`Unexpected let-out loss case: ${JSON.stringify(letOutLoss)}.`);
  }
  if (letOutLoss.lossCarriedForward !== 0) {
    throw new Error("A loss inside the Rs 2L set-off cap should carry nothing forward.");
  }
  // A bigger loss caps old-regime set-off at Rs 2,00,000 and carries the rest.
  const letOutBigLoss = computeLetOutHouseProperty(
    { ...letOutFigures, homeLoanInterestLetOut: 500000 },
    ruleCatalog.loanTreatment
  );
  if (
    letOutBigLoss.netIncome !== -360000 ||
    letOutBigLoss.oldRegimeIncome !== -200000 ||
    letOutBigLoss.lossCarriedForward !== 160000
  ) {
    throw new Error(`Unexpected capped let-out loss case: ${JSON.stringify(letOutBigLoss)}.`);
  }
  // Positive house-property income lands on both regimes' slab income:
  // rent Rs 3,00,000, no municipal taxes, Rs 50,000 interest ->
  // 3,00,000 x 70% - 50,000 = Rs 1,60,000.
  const letOutIncome = computeLetOutHouseProperty(
    {
      ...letOutFigures,
      letOutRentReceived: 300000,
      letOutMunicipalTaxes: 0,
      homeLoanInterestLetOut: 50000
    },
    ruleCatalog.loanTreatment
  );
  if (
    letOutIncome.netIncome !== 160000 ||
    letOutIncome.oldRegimeIncome !== 160000 ||
    letOutIncome.newRegimeIncome !== 160000
  ) {
    throw new Error(`Unexpected let-out income case: ${JSON.stringify(letOutIncome)}.`);
  }

  // The regime comparison actually uses the let-out figures per regime: adding
  // a Rs 1,60,000 old-regime-only loss to the Rs 12L salary case leaves the
  // new regime at zero and cuts the old regime's tax below its no-loss figure.
  const regimeWithLetOutLoss = compareRegimes(
    {
      salaryIncome: 1_200_000,
      dividends: 0,
      interestOtherIncome: 0,
      eligibleInterestDeduction: 0,
      debtMfShortTermDeemedGain: 0,
      intradayGain: 0,
      oldRegimeDeductions: 0,
      letOutIncomeOldRegime: -160_000,
      letOutIncomeNewRegime: 0,
      seniorCitizen: false
    },
    ruleCatalog.regimeChoice
  );
  // Old-regime taxable falls from Rs 11.5L to Rs 9.9L: 12,500 + 100,000 +
  // 30% of 4.9L = Rs 2,59,500, x1.04 cess = Rs 2,69,880... recomputed:
  // 5% of 2.5L (12,500) + 20% of 5L (100,000) + 30% of 4.9L-10L band.
  // 9.9L - 10L threshold: 9.9L is below 10L, so 12,500 + 20% of (9.9L-5L)
  // = 12,500 + 98,000 = 110,500, x1.04 = 114,920.
  if (regimeWithLetOutLoss.newRegimeTax !== 0) {
    throw new Error(
      `A let-out loss must not change the zero new-regime tax on Rs 12L salary, got ${regimeWithLetOutLoss.newRegimeTax}.`
    );
  }
  if (regimeWithLetOutLoss.oldRegimeTax !== 114920) {
    throw new Error(
      `Expected Rs 1,14,920 old-regime tax with a Rs 1.6L house-property loss, got ${regimeWithLetOutLoss.oldRegimeTax}.`
    );
  }

  // Home-loan principal shares the single 80C ceiling: Rs 1,00,000 of
  // investments + Rs 80,000 of principal counts Rs 1,50,000, not Rs 1,80,000.
  const usage80c = combined80cUsage(
    { ...BLANK_SUPPLEMENTAL_FIGURES, deduction80C: 100000, homeLoanPrincipal80c: 80000 },
    ruleCatalog.deductionLimits
  );
  if (usage80c.combined !== 180000 || usage80c.allowed !== 150000 || usage80c.limit !== 150000) {
    throw new Error(`Unexpected combined 80C usage: ${JSON.stringify(usage80c)}.`);
  }

  // LRS TCS rate branches (Section 206C(1G)): Rs 15L remitted is Rs 5L over
  // the Rs 10L threshold - 20% (Rs 1,00,000) for investment/gift, 2%
  // (Rs 10,000) for education/medical, and nothing when education-loan funded.
  const lrsBase = { ...BLANK_SUPPLEMENTAL_FIGURES, foreignRemittanceLrs: 1_500_000 };
  const lrsInvestment = computeForeignRemittanceTcs(lrsBase, ruleCatalog.foreignInvestments);
  if (lrsInvestment.estimatedTcs !== 100000 || lrsInvestment.rate !== 0.2) {
    throw new Error(
      `Expected Rs 1,00,000 TCS at 20% on the investment branch, got ${JSON.stringify(lrsInvestment)}.`
    );
  }
  const lrsEducation = computeForeignRemittanceTcs(
    { ...lrsBase, foreignRemittancePurpose: "education_medical" },
    ruleCatalog.foreignInvestments
  );
  if (lrsEducation.estimatedTcs !== 10000 || lrsEducation.rate !== 0.02) {
    throw new Error(
      `Expected Rs 10,000 TCS at 2% on the education/medical branch, got ${JSON.stringify(lrsEducation)}.`
    );
  }
  const lrsLoanFunded = computeForeignRemittanceTcs(
    { ...lrsBase, foreignRemittancePurpose: "education_loan_funded" },
    ruleCatalog.foreignInvestments
  );
  if (lrsLoanFunded.estimatedTcs !== 0 || lrsLoanFunded.rate !== 0) {
    throw new Error(
      `Expected no TCS on an education-loan-funded remittance, got ${JSON.stringify(lrsLoanFunded)}.`
    );
  }

  console.log(
    "Validated webapp calculations: rule JSON mirror matches source, CA Summary matches M1, fixture totals match M2 buckets, regime comparison matches the known Rs 12L salary case plus the Rs 12.75L zero-tax edge and the senior 60-79 and super-senior 80+ old-regime bands, Section 234B advance-tax interest matches the known shortfall case, Section 234C matches the full-default/safe-harbour/TDS-floor cases plus the quarter-precision late-gain/mixed-timing/cumulative-LTCG-exemption cases from real transaction dates, NRI dividend tax takes the lower of the domestic and treaty rate (UAE benefits, US/unknown don't) and NRO TDS reconciliation matches the known recoverable-amount case with dividends excluded from slab income, NRI repatriation check matches the known below-threshold/CA-certificate/USD-cap-breach cases with the renamed Form 145/146, Schedule FA Phase 1 account totals sum correctly with the disclosure calendar year derived from the financial year, insurance-policy Section 10(10D) exemption matches the death-benefit/exempt/aggregate-cap/ratio-test/ULIP-LT/ULIP-ST known cases, let-out house property matches the loss-cap and income cases (including the per-regime feed into the comparison), home-loan principal caps inside the shared 80C ceiling, LRS TCS follows the purpose's rate branch, and minor's-income clubbing matches the known two-child case with and without the Section 64(1A) exclusions."
  );
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main();
}
