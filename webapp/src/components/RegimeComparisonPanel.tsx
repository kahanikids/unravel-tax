import { compareRegimes } from "../lib/regimeComparison";
import type { RegimeChoiceRule } from "../rules";
import type { SupplementalFigures } from "../state/types";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/**
 * Optional: entirely skippable by leaving salary income at zero. Only
 * compares the slab-taxed portion of income (see rule.values.comparison_scope_caveat),
 * shown every time so the estimate is never mistaken for the full picture.
 */
export function RegimeComparisonPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  debtMfShortTermDeemedGain,
  intradayGain,
  seniorCitizen,
  rule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  debtMfShortTermDeemedGain: number;
  intradayGain: number;
  seniorCitizen: boolean;
  rule: RegimeChoiceRule;
}) {
  const hasEnoughToCompare = supplementalFigures.salaryIncome > 0;
  const result = hasEnoughToCompare
    ? compareRegimes(
        {
          salaryIncome: supplementalFigures.salaryIncome,
          dividends: supplementalFigures.dividends,
          interestOtherIncome: supplementalFigures.interestOtherIncome,
          eligibleInterestDeduction: supplementalFigures.eligibleInterestDeduction,
          debtMfShortTermDeemedGain,
          intradayGain,
          oldRegimeDeductions: supplementalFigures.oldRegimeDeductions,
          seniorCitizen
        },
        rule
      )
    : null;

  return (
    <section className="regime-panel">
      <h3>Old vs new regime: which costs less?</h3>
      <p className="step-lede">{rule.values.comparison_scope_caveat}</p>

      <div className="supplemental-grid">
        <label className="supplemental-field">
          Salary/pension income (before standard deduction)
          <input
            type="number"
            min={0}
            value={supplementalFigures.salaryIncome}
            placeholder="Leave at 0 to skip this comparison"
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                salaryIncome: Number(event.target.value) || 0
              })
            }
          />
        </label>
        <label className="supplemental-field">
          Old regime deductions (80C, 80D, HRA, home loan interest, etc.)
          <input
            type="number"
            min={0}
            value={supplementalFigures.oldRegimeDeductions}
            placeholder="Only counts under the old regime"
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                oldRegimeDeductions: Number(event.target.value) || 0
              })
            }
          />
        </label>
      </div>

      {result ? (
        <div className="regime-result">
          <div className="regime-result-row">
            <span>New regime</span>
            <strong>₹{formatAmount(result.newRegimeTax)}</strong>
          </div>
          <div className="regime-result-row">
            <span>Old regime</span>
            <strong>₹{formatAmount(result.oldRegimeTax)}</strong>
          </div>
          <p className="regime-verdict">
            {result.cheaperRegime === "equal"
              ? "Both regimes work out about the same on this estimate."
              : `The ${result.cheaperRegime} regime looks cheaper by about ₹${formatAmount(result.difference)}, on this estimate.`}
          </p>
        </div>
      ) : (
        <p className="checklist-empty">Enter your salary/pension income above to see an estimate.</p>
      )}
    </section>
  );
}
