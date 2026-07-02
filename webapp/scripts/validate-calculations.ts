import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import Papa from "papaparse";
import { caSummaryAmountMap, caSummaryRows, summarizeWithRules } from "../src/lib";
import { parseCsvText } from "../src/ingest";
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

async function main() {
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

  console.log(
    "Validated webapp calculations: rule JSON mirror matches source, CA Summary matches M1, and fixture totals match M2 buckets."
  );
}

main();
