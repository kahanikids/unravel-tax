import { useState } from "react";
import { estimateAdvanceTaxInterest } from "../lib/advanceTax";
import type { AdvanceTaxRule } from "../rules";
import type { SupplementalFigures } from "../state/types";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Optional: entirely skippable by leaving tax liability at zero. Section
 * 234C (per-instalment interest) is deliberately not estimated here - see
 * rule.values.section_234c_reason, always shown alongside so the gap is
 * never silent.
 */
export function AdvanceTaxPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  seniorCitizen,
  hasBusinessOrSpeculativeIncome,
  rule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  seniorCitizen: boolean;
  hasBusinessOrSpeculativeIncome: boolean;
  rule: AdvanceTaxRule;
}) {
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const hasEnoughToEstimate = supplementalFigures.advanceTaxLiability > 0;
  const result = hasEnoughToEstimate
    ? estimateAdvanceTaxInterest(
        {
          totalTaxLiability: supplementalFigures.advanceTaxLiability,
          taxAlreadyPaid: supplementalFigures.advanceTaxPaid,
          asOfDate,
          seniorCitizenExempt: seniorCitizen && !hasBusinessOrSpeculativeIncome
        },
        rule
      )
    : null;

  return (
    <section className="regime-panel">
      <h3>Advance tax: any Section 234B interest?</h3>
      <p className="step-lede">
        Estimates interest for paying advance tax late or short, from your total tax liability and what's already
        paid through TDS or instalments. This doesn't estimate Section 234C: {rule.values.section_234c_reason}
      </p>

      <div className="supplemental-grid">
        <label className="supplemental-field">
          Total tax liability for the year
          <input
            type="number"
            min={0}
            value={supplementalFigures.advanceTaxLiability}
            placeholder="Leave at 0 to skip this estimate"
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                advanceTaxLiability: Number(event.target.value) || 0
              })
            }
          />
        </label>
        <label className="supplemental-field">
          Tax already paid (TDS + advance tax instalments)
          <input
            type="number"
            min={0}
            value={supplementalFigures.advanceTaxPaid}
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                advanceTaxPaid: Number(event.target.value) || 0
              })
            }
          />
        </label>
        <label className="supplemental-field">
          Estimate as of
          <input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
        </label>
      </div>

      {result ? (
        <div className="regime-result">
          <p className="regime-verdict">{result.reason}</p>
          {result.interestApplies ? (
            <div className="regime-result-row">
              <span>Estimated interest ({result.monthsElapsed} month{result.monthsElapsed === 1 ? "" : "s"})</span>
              <strong>₹{formatAmount(result.estimatedInterest)}</strong>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="checklist-empty">Enter your total tax liability above to see an estimate.</p>
      )}
    </section>
  );
}
