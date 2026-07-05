import { combined80cUsage, computeLetOutHouseProperty, computeLoanDeductions } from "../lib/loanDeductions";
import { ruleCatalog, type DeductionLimitsRule, type LoanTreatmentRule } from "../rules";
import type { NumericFigureKey, SupplementalFigures } from "../state/types";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const LET_OUT_FIELDS: { key: NumericFigureKey; label: string }[] = [
  { key: "letOutRentReceived", label: "Rent received this year" },
  { key: "letOutMunicipalTaxes", label: "Municipal/property taxes you paid" },
  { key: "homeLoanInterestLetOut", label: "Home-loan interest on that home (no cap)" }
];

/**
 * Loan deductions: the capped old-regime interest lines, the let-out
 * house-property computation (both regimes, loss set-off capped per
 * rules/loan-treatment.json), and the home-loan principal that shares the
 * Section 80C ceiling. The capped interest total and the let-out figures feed
 * the regime comparison so the loans actually move the numbers. Skippable by
 * leaving every field at zero.
 */
export function LoanDeductionsPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  rule,
  deductionLimitsRule = ruleCatalog.deductionLimits
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  rule: LoanTreatmentRule;
  deductionLimitsRule?: DeductionLimitsRule;
}) {
  const { lines, total } = computeLoanDeductions(supplementalFigures, rule);
  const letOut = computeLetOutHouseProperty(supplementalFigures, rule);
  const usage80c = combined80cUsage(supplementalFigures, deductionLimitsRule);

  const changeFigure = (key: NumericFigureKey, raw: string) =>
    onChangeSupplementalFigures({ ...supplementalFigures, [key]: Number(raw) || 0 });

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        Enter the interest you paid on each loan this year. These lower your tax under the old regime only (a
        rented-out home is the one exception, covered just below). Each is capped at its legal limit and folded into
        the old-regime side of the comparison below. <RuleSourceLink refs={rule.source_refs} />
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
              onChange={(event) => changeFigure(line.key, event.target.value)}
            />
            {line.limit !== null && line.entered > line.limit ? (
              <span className="field-note">Capped at ₹{formatAmount(line.limit)} for this section.</span>
            ) : null}
          </label>
        ))}
        <label className="supplemental-field">
          Home-loan principal repaid (Section 80C), inside the ₹{formatAmount(usage80c.limit)} ceiling
          <input
            type="number"
            min={0}
            value={supplementalFigures.homeLoanPrincipal80c}
            placeholder="₹0"
            onChange={(event) => changeFigure("homeLoanPrincipal80c", event.target.value)}
          />
          {usage80c.combined > usage80c.limit ? (
            <span className="field-note">
              With your other 80C investments (₹{formatAmount(usage80c.investments)}), this passes the shared ₹
              {formatAmount(usage80c.limit)} ceiling - only ₹{formatAmount(usage80c.allowed)} counts in total.
            </span>
          ) : (
            <span className="field-note">
              Shares the single 80C ceiling with your other 80C investments - it doesn't come on top. Old regime only.
            </span>
          )}
        </label>
      </div>
      <p className="regime-verdict">
        Total loan-interest deduction (old regime): <strong>₹{formatAmount(total)}</strong>
      </p>

      <h4>Rented-out home (both regimes)</h4>
      <p className="step-lede">
        If a home you have a loan on is rented out, the full interest nets against the rent instead of hitting the
        caps above. A resulting loss offsets your other income only up to ₹
        {formatAmount(rule.values.home_loan.let_out_interest_24b.house_property_loss_setoff_cap_against_other_heads_inr)}{" "}
        under the old regime (rest carried forward), and not at all under the new regime.
      </p>
      <div className="supplemental-grid">
        {LET_OUT_FIELDS.map((field) => (
          <label key={field.key} className="supplemental-field">
            {field.label}
            <input
              type="number"
              min={0}
              value={supplementalFigures[field.key]}
              placeholder="₹0"
              onChange={(event) => changeFigure(field.key, event.target.value)}
            />
          </label>
        ))}
      </div>
      {letOut.hasInputs ? (
        <div className="regime-result">
          <div className="regime-result-row">
            <span>
              Rent ₹{formatAmount(letOut.rentReceived)} − municipal taxes ₹{formatAmount(letOut.municipalTaxes)} − 30%
              standard deduction ₹{formatAmount(letOut.standardDeduction)} − interest ₹{formatAmount(letOut.interest)}
            </span>
            <strong>
              {letOut.netIncome < 0 ? `−₹${formatAmount(-letOut.netIncome)} loss` : `₹${formatAmount(letOut.netIncome)}`}
            </strong>
          </div>
          <p className="regime-verdict">
            {letOut.netIncome >= 0
              ? "This house-property income is added to the slab income on both sides of the regime comparison below."
              : letOut.lossCarriedForward > 0
                ? `Old regime: ₹${formatAmount(-letOut.oldRegimeIncome)} of the loss offsets your other income this year and ₹${formatAmount(
                    letOut.lossCarriedForward
                  )} carries forward (up to ${rule.values.home_loan.let_out_interest_24b.old_regime_loss_carry_forward_years} years, against house-property income). New regime: the loss can't offset other income at all.`
                : "Old regime: this loss offsets your other income in the comparison below. New regime: it can't offset other income at all."}
          </p>
        </div>
      ) : null}
    </section>
  );
}
