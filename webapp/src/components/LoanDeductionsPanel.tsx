import { computeLoanDeductions } from "../lib/loanDeductions";
import type { LoanTreatmentRule } from "../rules";
import type { SupplementalFigures } from "../state/types";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/**
 * Loan-interest deductions, old regime only (except let-out home-loan
 * interest, which this panel doesn't model). Each field is capped at the
 * limit read from rules/loan-treatment.json, and the capped total feeds the
 * old-regime side of the regime comparison so the loans actually move the
 * numbers. Skippable by leaving every field at zero.
 */
export function LoanDeductionsPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  rule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  rule: LoanTreatmentRule;
}) {
  const { lines, total } = computeLoanDeductions(supplementalFigures, rule);

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        Enter the interest you paid on each loan this year. These lower your tax under the old regime only (a rented-out
        home is the one exception, not modelled here). Each is capped at its legal limit and folded into the old-regime
        side of the comparison below. <RuleSourceLink refs={rule.source_refs} />
      </p>
      <div className="supplemental-grid">
        {lines.map((line) => (
          <label key={line.key} className="supplemental-field">
            {line.label} (Section {line.section})
            {line.limit === null ? ", no cap" : `, up to ₹${formatAmount(line.limit)}`}
            <input
              type="number"
              min={0}
              value={supplementalFigures[line.key]}
              placeholder="₹0"
              onChange={(event) =>
                onChangeSupplementalFigures({
                  ...supplementalFigures,
                  [line.key]: Number(event.target.value) || 0
                })
              }
            />
            {line.limit !== null && line.entered > line.limit ? (
              <span className="field-note">Capped at ₹{formatAmount(line.limit)} for this section.</span>
            ) : null}
          </label>
        ))}
      </div>
      <p className="regime-verdict">
        Total loan-interest deduction (old regime): <strong>₹{formatAmount(total)}</strong>
      </p>
    </section>
  );
}
