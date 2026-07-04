import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { caSummaryRows, reconciliationReport } from "../src/lib";
import { parseCsvText } from "../src/ingest";
import { ruleCatalog } from "../src/rules";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const fixturesDir = resolve(repoRoot, "fixtures");

type FixtureChecklistItem = {
  document: string;
  needed: string;
  status: string;
  why_needed: string;
};

type FixtureTdsRow = {
  source: string;
  tds_per_document: number;
  tds_per_ais: number;
};

type ReconciliationFixture = {
  checklist: FixtureChecklistItem[];
  reported_summary: Record<string, number>;
  tds_rows: FixtureTdsRow[];
  expected_missing_documents: string[];
  expected_mismatch_fields: string[];
};

export async function main() {
  const fixture = JSON.parse(
    await readFile(resolve(fixturesDir, "reconciliation-m3c.json"), "utf8")
  ) as ReconciliationFixture;
  const csv = await readFile(resolve(fixturesDir, "sample-broker-statement.csv"), "utf8");
  const transactions = parseCsvText(csv).transactions;
  const expectedFigures = Object.fromEntries(
    caSummaryRows(transactions, ruleCatalog.capitalGainsEquity, ruleCatalog.itrFormSelection)
      // Totals rows are derivation detail, not income heads a reported CA
      // summary would restate - same filter as demo/sampleState.ts.
      .filter((row) => typeof row.amount === "number" && row.ruleSection !== "Totals")
      .map((row) => [row.head, row.amount as number])
  );

  const report = reconciliationReport({
    checklistItems: fixture.checklist.map((item) => ({
      document: item.document,
      needed: item.needed,
      status: item.status,
      whyNeeded: item.why_needed
    })),
    expectedFigures,
    reportedFigures: fixture.reported_summary,
    tdsRows: fixture.tds_rows.map((row) => ({
      source: row.source,
      tdsPerDocument: row.tds_per_document,
      tdsPerAis: row.tds_per_ais
    }))
  });

  const missingDocuments = new Set(report.missingDocuments.map((item) => item.document));
  for (const expected of fixture.expected_missing_documents) {
    if (!missingDocuments.has(expected)) {
      throw new Error(`Missing checklist document was not reported: ${expected}`);
    }
  }

  const mismatchFields = new Set(report.mismatches.map((item) => item.field));
  for (const expected of fixture.expected_mismatch_fields) {
    if (!mismatchFields.has(expected)) {
      throw new Error(`Planted mismatch was not reported: ${expected}`);
    }
  }

  if (report.ready) {
    throw new Error("Incomplete fixture should not be marked ready.");
  }

  console.log(
    `Validated webapp reconciliation: ${report.missingDocuments.length} missing documents, ${report.mismatches.length} mismatches.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
