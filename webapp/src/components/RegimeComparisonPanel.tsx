import { compareRegimes, computeRegimeBreakEven } from "../lib/regimeComparison";
import type { RegimeChoiceRule } from "../rules";
import type { SupplementalFigures } from "../state/types";
import { Meter } from "./DashboardWidgets";
import { RuleSourceLink } from "./RuleSourceLink";

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
  superSeniorCitizen = false,
  nri = false,
  loanDeductionsTotal = 0,
  letOutIncomeOldRegime = 0,
  letOutIncomeNewRegime = 0,
  additionalOtherSlabIncome = 0,
  rule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  debtMfShortTermDeemedGain: number;
  intradayGain: number;
  seniorCitizen: boolean;
  /** 80 or older; ignored unless seniorCitizen is also true. Picks the old-regime super-senior slab. */
  superSeniorCitizen?: boolean;
  /** A non-resident's dividends are taxed flat under Section 115A/DTAA, never at slab, so they're excluded here and shown in their own CA Summary row instead. */
  nri?: boolean;
  /** Capped loan-interest deductions from the Loans section, added to the old-regime side. */
  loanDeductionsTotal?: number;
  /** Let-out house-property income/loss from the Loans section, per regime (loss pre-capped; see lib/loanDeductions.ts). */
  letOutIncomeOldRegime?: number;
  letOutIncomeNewRegime?: number;
  /** A taxable traditional-insurance-policy payout, folded into the ordinary "other income" bucket on both regimes. */
  additionalOtherSlabIncome?: number;
  rule: RegimeChoiceRule;
}) {
  const hasEnoughToCompare = supplementalFigures.salaryIncome > 0;
  const comparisonInputs = {
    salaryIncome: supplementalFigures.salaryIncome,
    dividends: supplementalFigures.dividends,
    interestOtherIncome: supplementalFigures.interestOtherIncome,
    eligibleInterestDeduction: supplementalFigures.eligibleInterestDeduction,
    debtMfShortTermDeemedGain,
    intradayGain,
    oldRegimeDeductions: supplementalFigures.oldRegimeDeductions + Math.max(0, loanDeductionsTotal),
    letOutIncomeOldRegime,
    letOutIncomeNewRegime,
    additionalOtherSlabIncome,
    excludeDividendsFromSlab: nri,
    seniorCitizen,
    superSeniorCitizen
  };
  const result = hasEnoughToCompare ? compareRegimes(comparisonInputs, rule) : null;
  const breakEven = hasEnoughToCompare ? computeRegimeBreakEven(comparisonInputs, rule) : null;

  return (
    <section className="regime-panel">
      <h3>Old vs new regime: which costs less?</h3>
      <p className="step-lede">
        {rule.values.comparison_scope_caveat} <RuleSourceLink refs={rule.source_refs} />
      </p>

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
          Other old regime deductions (80C, 80D, HRA, etc.)
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
      {loanDeductionsTotal > 0 ? (
        <p className="step-lede">
          Plus ₹{formatAmount(loanDeductionsTotal)} of loan-interest deductions from the Loans
          section, already added to the old-regime side. Don't re-enter those in the field above.
        </p>
      ) : null}
      {additionalOtherSlabIncome > 0 ? (
        <p className="step-lede">
          Plus ₹{formatAmount(additionalOtherSlabIncome)} of taxable insurance-payout income from
          the Insurance section, already added to the "other income" side of both regimes. Don't
          re-enter it above.
        </p>
      ) : null}
      {nri && supplementalFigures.dividends > 0 ? (
        <p className="step-lede">
          Your ₹{formatAmount(supplementalFigures.dividends)} of dividends is left out of both
          regimes here - as a non-resident, it's taxed at a flat Section 115A/DTAA rate regardless
          of regime, shown as its own row in the summary above.
        </p>
      ) : null}
      {letOutIncomeOldRegime !== 0 || letOutIncomeNewRegime !== 0 ? (
        <p className="step-lede">
          Your rented-out home from the Loans section is already counted:{" "}
          {letOutIncomeOldRegime < 0
            ? `a ₹${formatAmount(-letOutIncomeOldRegime)} house-property loss on the old-regime side (the new regime can't use it)`
            : `₹${formatAmount(letOutIncomeNewRegime)} of house-property income on both sides`}
          . Don't re-enter it in the fields above.
        </p>
      ) : null}

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
          {breakEven ? (
            <div className="regime-breakeven">
              <span className="regime-breakeven-label">Break-even deductions</span>
              {breakEven.newAlwaysWins ? (
                <p className="regime-verdict">
                  The new regime already brings this income to zero tax, so no amount of old-regime
                  deductions can beat it. There's no break-even to reach.
                </p>
              ) : (
                <>
                  <strong className="regime-breakeven-value">
                    ₹{formatAmount(breakEven.breakEvenDeductions)}
                  </strong>
                  <Meter
                    used={breakEven.actualDeductions}
                    limit={breakEven.breakEvenDeductions}
                    caption={`You've entered ₹${formatAmount(breakEven.actualDeductions)} of old-regime deductions, ₹${formatAmount(
                      Math.abs(breakEven.surplus)
                    )} ${breakEven.surplus >= 0 ? "above" : "below"} the break-even, so the ${
                      breakEven.surplus >= 0
                        ? "old regime is cheaper"
                        : "new regime (the default) is cheaper"
                    }.`}
                    overLabel={`You've entered ₹${formatAmount(breakEven.actualDeductions)}, ₹${formatAmount(
                      breakEven.surplus
                    )} past the break-even, so the old regime is cheaper.`}
                  />
                </>
              )}
              {rule.values.break_even ? (
                <p className="regime-verdict">{rule.values.break_even.note}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="checklist-empty">
          Enter your salary/pension income above to see an estimate.
        </p>
      )}
    </section>
  );
}
