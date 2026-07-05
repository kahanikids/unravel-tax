import { useState } from "react";
import {
  estimateAdvanceTaxInterest,
  estimateSection234cInterest,
  type QuarterlyCapitalGainsTax
} from "../lib/advanceTax";
import type { AdvanceTaxRule } from "../rules";
import type { NumericFigureKey, SupplementalFigures } from "../state/types";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatDueDate(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const INSTALMENT_KEYS: NumericFigureKey[] = [
  "advanceTaxInstalment1",
  "advanceTaxInstalment2",
  "advanceTaxInstalment3",
  "advanceTaxInstalment4"
];

/**
 * Optional: entirely skippable by leaving tax liability at zero. Estimates
 * both Section 234B (year-as-a-whole shortfall) and Section 234C
 * (per-instalment calendar) interest. The 234C figure is a whole-year
 * ceiling - gains/dividends arriving mid-year make the true figure lower -
 * so rule.values.section_234c.later_income_caveat is always shown alongside,
 * never silently dropped.
 */
export function AdvanceTaxPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  seniorCitizen,
  hasBusinessOrSpeculativeIncome,
  capitalGainsTaxByInstalment,
  rule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  seniorCitizen: boolean;
  hasBusinessOrSpeculativeIncome: boolean;
  /** Listed-equity STCG/LTCG tax dated by real transaction sell dates, from allocateCapitalGainsTaxByInstalment. */
  capitalGainsTaxByInstalment: QuarterlyCapitalGainsTax;
  rule: AdvanceTaxRule;
}) {
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const hasEnoughToEstimate = supplementalFigures.advanceTaxLiability > 0;
  const seniorCitizenExempt = seniorCitizen && !hasBusinessOrSpeculativeIncome;
  const result = hasEnoughToEstimate
    ? estimateAdvanceTaxInterest(
        {
          totalTaxLiability: supplementalFigures.advanceTaxLiability,
          taxAlreadyPaid: supplementalFigures.advanceTaxPaid,
          asOfDate,
          seniorCitizenExempt
        },
        rule
      )
    : null;
  const instalmentsPaid = INSTALMENT_KEYS.map((key) => supplementalFigures[key]);
  const result234c = hasEnoughToEstimate
    ? estimateSection234cInterest(
        {
          totalTaxLiability: supplementalFigures.advanceTaxLiability,
          taxAlreadyPaid: supplementalFigures.advanceTaxPaid,
          instalmentsPaid,
          seniorCitizenExempt,
          capitalGainsTax: capitalGainsTaxByInstalment
        },
        rule
      )
    : null;

  const changeFigure = (key: NumericFigureKey, raw: string) =>
    onChangeSupplementalFigures({ ...supplementalFigures, [key]: Number(raw) || 0 });

  return (
    <section className="regime-panel">
      <h3>Advance tax: any Section 234B or 234C interest?</h3>
      <p className="step-lede">
        Estimates interest for paying advance tax late or short: Section 234B on the year as a
        whole, and Section 234C instalment by instalment (15% by 15 Jun, 45% by 15 Sep, 75% by 15
        Dec, 100% by 15 Mar). Start from your total tax liability and what's already paid through
        TDS or instalments.
      </p>

      <div className="supplemental-grid">
        <label className="supplemental-field">
          Total tax liability for the year
          <input
            type="number"
            min={0}
            value={supplementalFigures.advanceTaxLiability}
            placeholder="Leave at 0 to skip this estimate"
            onChange={(event) => changeFigure("advanceTaxLiability", event.target.value)}
          />
        </label>
        <label className="supplemental-field">
          Tax already paid (TDS + advance tax instalments)
          <input
            type="number"
            min={0}
            value={supplementalFigures.advanceTaxPaid}
            onChange={(event) => changeFigure("advanceTaxPaid", event.target.value)}
          />
        </label>
        <label className="supplemental-field">
          Estimate as of
          <input
            type="date"
            value={asOfDate}
            onChange={(event) => setAsOfDate(event.target.value)}
          />
        </label>
      </div>

      {result ? (
        <div className="regime-result">
          <p className="regime-verdict">
            <strong>Section 234B:</strong> {result.reason}
          </p>
          {result.interestApplies ? (
            <div className="regime-result-row">
              <span>
                Estimated interest ({result.monthsElapsed} month
                {result.monthsElapsed === 1 ? "" : "s"})
              </span>
              <strong>₹{formatAmount(result.estimatedInterest)}</strong>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="checklist-empty">Enter your total tax liability above to see an estimate.</p>
      )}

      {hasEnoughToEstimate && result234c ? (
        <>
          <h4>Section 234C: instalment-by-instalment</h4>
          <p className="step-lede">
            Enter the advance tax you actually paid in each window (not TDS - anything left over in
            "tax already paid" above is treated as TDS and taken off the liability first
            {result234c.tdsTreatedAsDeducted > 0
              ? `: ₹${formatAmount(result234c.tdsTreatedAsDeducted)} here`
              : ""}
            ).
          </p>
          {result234c.capitalGainsTaxForYear > 0 ? (
            <p className="step-lede">
              ₹{formatAmount(result234c.capitalGainsTaxForYear)} of that is listed-equity
              capital-gains tax, dated from your actual transactions below - it only counts toward
              an instalment due after each gain was realised, not spread evenly like the rest. The
              remaining ₹{formatAmount(result234c.ordinaryTax)} (salary, interest, dividends,
              business, or debt-fund gains) is spread evenly across all four instalments, same as
              before.
            </p>
          ) : null}
          <div className="supplemental-grid">
            {/* Slice to the four stored instalment fields: a rules file with a
                different calendar length must not index past them. */}
            {rule.values.section_234c.instalments
              .slice(0, INSTALMENT_KEYS.length)
              .map((instalment, index) => (
                <label key={instalment.due_date} className="supplemental-field">
                  Paid by {formatDueDate(instalment.due_date)}
                  <input
                    type="number"
                    min={0}
                    value={supplementalFigures[INSTALMENT_KEYS[index]]}
                    placeholder="₹0"
                    onChange={(event) => changeFigure(INSTALMENT_KEYS[index], event.target.value)}
                  />
                </label>
              ))}
          </div>
          <div className="regime-result">
            <p className="regime-verdict">
              <strong>Section 234C:</strong> {result234c.reason}
            </p>
            {result234c.interestApplies ? (
              <>
                {result234c.instalments
                  .filter((instalment) => instalment.interest > 0 || instalment.safeHarborApplied)
                  .map((instalment) => (
                    <div className="regime-result-row" key={instalment.dueDate}>
                      <span>
                        By {formatDueDate(instalment.dueDate)}: needed ₹
                        {formatAmount(instalment.requiredCumulative)}, paid ₹
                        {formatAmount(instalment.paidCumulative)}
                        {instalment.safeHarborApplied ? " (cleared by the safe harbour)" : ""}
                      </span>
                      <strong>
                        {instalment.safeHarborApplied
                          ? "₹0"
                          : `₹${formatAmount(instalment.interest)} (${instalment.monthsCharged} month${instalment.monthsCharged === 1 ? "" : "s"})`}
                      </strong>
                    </div>
                  ))}
                <div className="regime-result-row">
                  <span>Estimated Section 234C interest, total</span>
                  <strong>₹{formatAmount(result234c.totalInterest)}</strong>
                </div>
              </>
            ) : null}
            {result234c.required ? (
              <p className="step-lede">{rule.values.section_234c.later_income_caveat}</p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
