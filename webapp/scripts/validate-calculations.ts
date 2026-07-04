import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";
import {
  brokerGainCheck,
  caSummaryAmountMap,
  caSummaryRows,
  compareRegimes,
  computeRegimeBreakEven,
  estimateAdvanceTaxInterest,
  summarizeWithRules
} from "../src/lib";
import { clubbedMinorIncome } from "../src/lib/profile";
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
  return Object.fromEntries(parsed.data.map((row) => [row.Head, normalizeReferenceAmount(row.Amount)]));
}

async function assertMirroredRuleJsonMatchesSource() {
  const sourceNames = (await readdir(topLevelRulesDir)).filter((name) => name.endsWith(".json")).sort();
  const mirroredNames = (await readdir(webappRulesDir)).filter((name) => name.endsWith(".json")).sort();
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
    throw new Error("Synthetic fixture should not owe special-rate capital gains tax after losses/exemption.");
  }

  // Sale/cost totals: every bucket's gain must equal its own sale minus cost,
  // and the fixture's known totals must round-trip exactly.
  const t = summary.totals;
  if (t.all.saleValue !== 195800 || t.all.cost !== 190000) {
    throw new Error(`Unexpected overall totals: sale ${t.all.saleValue}, cost ${t.all.cost}.`);
  }
  for (const [name, bucket] of Object.entries(t)) {
    if (bucket.gain !== bucket.saleValue - bucket.cost) {
      throw new Error(`Bucket ${name}: gain ${bucket.gain} != sale ${bucket.saleValue} - cost ${bucket.cost}.`);
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
    throw new Error(`Expected the broker check to pick the "Taxable Gain" column, got ${JSON.stringify(check?.columnName)}.`);
  }
  for (const entry of check.perClass) {
    if (Math.abs(entry.computed - entry.broker) > 1) {
      throw new Error(`Broker check mismatch for ${entry.label}: computed ${entry.computed} vs broker ${entry.broker}.`);
    }
  }
  const noBrokerColumn = brokerGainCheck(parsed.transactions, ruleCatalog.capitalGainsEquity);
  if (noBrokerColumn !== null) {
    throw new Error("CSV fixture has no broker gain column, so the broker check should be unavailable, not passing.");
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
    throw new Error(`Expected zero new-regime tax on Rs 12L salary (standard deduction + 87A rebate), got ${regimeResult.newRegimeTax}.`);
  }
  if (regimeResult.oldRegimeTax !== 163800) {
    throw new Error(`Expected Rs 163800 old-regime tax on Rs 12L salary, got ${regimeResult.oldRegimeTax}.`);
  }
  if (regimeResult.cheaperRegime !== "new") {
    throw new Error("New regime should be cheaper for a plain Rs 12L salary with no other income or deductions.");
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
  const breakEven1275 = computeRegimeBreakEven(breakEvenInputs(1_275_000), ruleCatalog.regimeChoice);
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
    const breakEven = computeRegimeBreakEven(breakEvenInputs(testCase.salary), ruleCatalog.regimeChoice);
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
  const seniorRegime = compareRegimes({ ...seniorInputs, seniorCitizen: true }, ruleCatalog.regimeChoice);
  const nonSeniorRegime = compareRegimes({ ...seniorInputs, seniorCitizen: false }, ruleCatalog.regimeChoice);
  // Taxable Rs 8,50,000 after the Rs 50,000 standard deduction. Senior 60-79:
  // 5% of (5L-3L) + 20% of (8.5L-5L) = 10,000 + 70,000 = 80,000, +4% cess = 83,200.
  if (seniorRegime.oldRegimeTax !== 83_200) {
    throw new Error(`Expected Rs 83,200 old-regime tax for a senior on Rs 9L salary, got ${seniorRegime.oldRegimeTax}.`);
  }
  // Below 60 on the same income: the extra Rs 50,000 taxed at 5% = Rs 2,500,
  // +4% cess = Rs 2,600 more, i.e. Rs 85,800.
  if (nonSeniorRegime.oldRegimeTax !== 85_800) {
    throw new Error(`Expected Rs 85,800 old-regime tax below 60 on Rs 9L salary, got ${nonSeniorRegime.oldRegimeTax}.`);
  }
  if (!(seniorRegime.oldRegimeTax < nonSeniorRegime.oldRegimeTax)) {
    throw new Error("Senior 60-79 old-regime band should tax less than the below-60 band on the same income.");
  }

  // Section 234B advance-tax interest: below the Section 208 threshold, no
  // advance tax was required at all.
  const belowThreshold = estimateAdvanceTaxInterest(
    { totalTaxLiability: 5000, taxAlreadyPaid: 0, asOfDate: "2026-07-03", seniorCitizenExempt: false },
    ruleCatalog.advanceTax
  );
  if (belowThreshold.required || belowThreshold.interestApplies) {
    throw new Error("Tax due under the Rs 10,000 Section 208 threshold should not require advance tax.");
  }

  // Senior citizens without business income are exempt regardless of amount.
  const seniorExempt = estimateAdvanceTaxInterest(
    { totalTaxLiability: 50000, taxAlreadyPaid: 0, asOfDate: "2026-07-03", seniorCitizenExempt: true },
    ruleCatalog.advanceTax
  );
  if (seniorExempt.required || seniorExempt.interestApplies) {
    throw new Error("Senior citizens without business income should be exempt from advance tax (Section 207(2)).");
  }

  // Paying at least 90% of assessed tax avoids 234B interest entirely.
  const wellPaid = estimateAdvanceTaxInterest(
    { totalTaxLiability: 100000, taxAlreadyPaid: 95000, asOfDate: "2026-07-03", seniorCitizenExempt: false },
    ruleCatalog.advanceTax
  );
  if (wellPaid.interestApplies) {
    throw new Error("Paying at least 90% of assessed tax should avoid Section 234B interest.");
  }

  // A full shortfall from 1 April 2026 (AY start) to 3 July 2026 spans 4
  // months (April, May, June, and a part of July rounding up), at 1% each.
  const shortfallCase = estimateAdvanceTaxInterest(
    { totalTaxLiability: 100000, taxAlreadyPaid: 0, asOfDate: "2026-07-03", seniorCitizenExempt: false },
    ruleCatalog.advanceTax
  );
  if (shortfallCase.monthsElapsed !== 4) {
    throw new Error(`Expected 4 months elapsed from 2026-04-01 to 2026-07-03, got ${shortfallCase.monthsElapsed}.`);
  }
  if (shortfallCase.estimatedInterest !== 4000) {
    throw new Error(`Expected Rs 4,000 estimated 234B interest (Rs 100,000 x 1% x 4 months), got ${shortfallCase.estimatedInterest}.`);
  }

  // Minor's-income clubbing: two children each get the Rs 1,500 exemption,
  // capped at two children even if more are entered.
  const clubbedTwoChildren = clubbedMinorIncome(10000, 2, ruleCatalog.singleParentClubbing);
  if (clubbedTwoChildren !== 7000) {
    throw new Error(`Expected Rs 7,000 clubbed after two Rs 1,500 exemptions on Rs 10,000, got ${clubbedTwoChildren}.`);
  }
  const clubbedCappedAtTwo = clubbedMinorIncome(10000, 4, ruleCatalog.singleParentClubbing);
  if (clubbedCappedAtTwo !== clubbedTwoChildren) {
    throw new Error("Minor's-income exemption should cap at max_children_for_exemption even with more children entered.");
  }

  console.log(
    "Validated webapp calculations: rule JSON mirror matches source, CA Summary matches M1, fixture totals match M2 buckets, regime comparison matches the known Rs 12L salary case plus the Rs 12.75L zero-tax edge and the senior 60-79 old-regime band, Section 234B advance-tax interest matches the known shortfall case, and minor's-income clubbing matches the known two-child case."
  );
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main();
}
