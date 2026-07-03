import type { ExtractionSummaryFigures } from "../ingest";
import type { SupplementalFigures } from "../state/types";

/**
 * Routes recognised annual totals from a pasted summary statement into their
 * existing "A few more numbers" homes: dividendIncome -> dividends,
 * interestIncome -> interestOtherIncome, deductibleCharges ->
 * deductibleTransactionCharges, tdsDeducted -> advanceTaxPaid (the leanest
 * existing field for it - no new schema). netRealisedGainNoDetail is never
 * routed; it only drives the missing-detail flag elsewhere.
 *
 * Merge rule: fill a field only when it's still 0, so a number the user already
 * typed is never clobbered or doubled. Returns the merged figures plus which
 * keys were actually touched (drives the check-these banner + open-by-default).
 */
export function applySummaryFiguresToSupplemental(
  current: SupplementalFigures,
  figures: ExtractionSummaryFigures
): { next: SupplementalFigures; applied: (keyof SupplementalFigures)[] } {
  const mapping: [number | undefined, keyof SupplementalFigures][] = [
    [figures.dividendIncome, "dividends"],
    [figures.interestIncome, "interestOtherIncome"],
    [figures.deductibleCharges, "deductibleTransactionCharges"],
    [figures.tdsDeducted, "advanceTaxPaid"]
  ];
  const next = { ...current };
  const applied: (keyof SupplementalFigures)[] = [];
  for (const [value, key] of mapping) {
    if (typeof value === "number" && next[key] === 0) {
      next[key] = value;
      applied.push(key);
    }
  }
  return { next, applied };
}
