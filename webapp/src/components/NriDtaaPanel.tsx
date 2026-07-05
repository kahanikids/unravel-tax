import {
  computeNriDividendTax,
  computeNroTdsReconciliation,
  type NroTdsCheck
} from "../lib/nriTax";
import type { NriDtaaRule, NriTdsAndRefundsRule } from "../rules";
import type { NriCountry, SupplementalFigures } from "../state/types";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatRate(rate: number | null) {
  return rate === null ? "unknown - check your treaty" : `${(rate * 100).toLocaleString("en-IN")}%`;
}

function TdsCheckRow({ check }: { check: NroTdsCheck }) {
  if (check.amount === 0 && check.actualWithheld === 0) {
    return null;
  }
  return (
    <div className="regime-result">
      <div className="regime-result-row">
        <span>
          {check.label}: ₹{formatAmount(check.amount)} at {formatRate(check.domesticRate)} domestic
          {check.treatyRate !== null ? ` or ${formatRate(check.treatyRate)} treaty` : ""}
        </span>
        <strong>
          Expected ₹
          {formatAmount(
            check.treatyRate !== null
              ? (check.expectedAtTreatyRate ?? 0)
              : check.expectedAtDomesticRate
          )}
        </strong>
      </div>
      <p className="regime-verdict">
        {check.actualWithheld === 0
          ? "Enter what was actually withheld to check for a recoverable amount."
          : check.recoverableIfTreatyApplies > 0
            ? `You entered ₹${formatAmount(check.actualWithheld)} withheld, about ₹${formatAmount(
                check.recoverableIfTreatyApplies
              )} more than the treaty rate allows - a possible refund if you had a TRC and Form 10F on file with the payer.`
            : check.treatyRate !== null
              ? `₹${formatAmount(check.actualWithheld)} withheld looks in line with the treaty rate, or below it.`
              : `₹${formatAmount(check.actualWithheld)} withheld. This tool doesn't know a treaty rate for your country, so it can't check for over-withholding here - bring this to a CA if it looks high.`}
      </p>
    </div>
  );
}

const NUMERIC_FIELDS: {
  key: "nriNroInterestTdsWithheld" | "nriDividendTdsWithheld";
  label: string;
}[] = [
  { key: "nriNroInterestTdsWithheld", label: "TDS actually withheld on your NRO interest" },
  { key: "nriDividendTdsWithheld", label: "TDS actually withheld on your dividends" }
];

/**
 * NRI-only: applies Section 115A's dividend rate (the lower of the 20%
 * domestic rate and your country's DTAA rate - never the higher one) as the
 * actual dividend tax figure, and reconciles NRO interest/dividend TDS
 * actually withheld against what the treaty rate allows, surfacing a
 * possible recoverable refund. Skippable by leaving the TDS fields at zero.
 * See rules/nri-dtaa.md and rules/nri-tds-and-refunds.md.
 */
export function NriDtaaPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  nriCountry,
  dtaaRule,
  tdsRule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  nriCountry: NriCountry;
  dtaaRule: NriDtaaRule;
  tdsRule: NriTdsAndRefundsRule;
}) {
  const dividendTax = computeNriDividendTax(
    supplementalFigures.dividends,
    nriCountry,
    dtaaRule,
    tdsRule
  );
  const reconciliation = computeNroTdsReconciliation(
    {
      nroInterest: supplementalFigures.interestOtherIncome,
      dividends: supplementalFigures.dividends,
      interestTdsWithheld: supplementalFigures.nriNroInterestTdsWithheld,
      dividendTdsWithheld: supplementalFigures.nriDividendTdsWithheld,
      nriCountry
    },
    dtaaRule,
    tdsRule
  );

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        Your dividends are taxed at a flat {formatRate(dividendTax.effectiveRate)} under Section
        115A
        {dividendTax.treatyApplied
          ? `, the lower treaty rate for ${nriCountry}`
          : nriCountry
            ? `, since your country's treaty rate isn't lower than the 20% domestic rate (or isn't known)`
            : ""}
        , not slab rate - shown as its own row in the summary above, and left out of the regime
        comparison below. <RuleSourceLink refs={dtaaRule.source_refs} />
      </p>
      <div className="supplemental-grid">
        {NUMERIC_FIELDS.map((field) => (
          <label key={field.key} className="supplemental-field">
            {field.label}
            <input
              type="number"
              min={0}
              value={supplementalFigures[field.key]}
              placeholder="₹0"
              onChange={(event) =>
                onChangeSupplementalFigures({
                  ...supplementalFigures,
                  [field.key]: Number(event.target.value) || 0
                })
              }
            />
          </label>
        ))}
      </div>
      <TdsCheckRow check={reconciliation.interest} />
      <TdsCheckRow check={reconciliation.dividends} />
      {reconciliation.totalRecoverable > 0 ? (
        <p className="regime-verdict">
          Possible recoverable TDS, total:{" "}
          <strong>₹{formatAmount(reconciliation.totalRecoverable)}</strong>
        </p>
      ) : null}
      <p className="step-lede">
        NRO interest is still taxed at your real slab rate, not a flat one - the treaty only helps
        once slab tax would otherwise exceed the treaty cap, which this tool doesn't compute
        precisely. Confirm the exact figures with a CA.{" "}
        <RuleSourceLink refs={tdsRule.source_refs} />
      </p>
    </section>
  );
}
