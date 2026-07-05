import { computeNriRepatriationCheck } from "../lib/nriRepatriation";
import type { NriRepatriationRule } from "../rules";
import type { SupplementalFigures } from "../state/types";
import { Meter } from "./DashboardWidgets";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/**
 * NRI-only planning check: how much has been repatriated out of NRO
 * accounts this year, against the USD 1 million annual cap and the ₹5 lakh
 * CA-certificate threshold. Purely informational - it never changes a tax
 * figure, since repatriation is a banking/FEMA compliance step outside the
 * return itself. See rules/nri-repatriation.md.
 */
export function NriRepatriationPanel({
  supplementalFigures,
  onChangeSupplementalFigures,
  rule
}: {
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  rule: NriRepatriationRule;
}) {
  const check = computeNriRepatriationCheck(
    {
      amountUsd: supplementalFigures.nriRepatriatedThisYearUsd,
      amountInr: supplementalFigures.nriRepatriatedThisYearInr
    },
    rule
  );

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        This is a planning check, not part of your tax return - Form 145/146 (the renamed Form
        15CA/15CB) are filed with your bank, separately from your ITR.{" "}
        <RuleSourceLink refs={rule.source_refs} />
      </p>
      <div className="supplemental-grid">
        <label className="supplemental-field">
          NRO repatriated so far this year (USD)
          <input
            type="number"
            min={0}
            value={supplementalFigures.nriRepatriatedThisYearUsd}
            placeholder="$0"
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                nriRepatriatedThisYearUsd: Number(event.target.value) || 0
              })
            }
          />
        </label>
        <label className="supplemental-field">
          The same amount, in rupees
          <input
            type="number"
            min={0}
            value={supplementalFigures.nriRepatriatedThisYearInr}
            placeholder="₹0"
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                nriRepatriatedThisYearInr: Number(event.target.value) || 0
              })
            }
          />
        </label>
      </div>
      {check.amountUsd > 0 || check.amountInr > 0 ? (
        <div className="regime-result">
          <Meter
            used={check.amountUsd}
            limit={check.annualLimitUsd}
            caption={`$${formatAmount(check.amountUsd)} repatriated vs the $${formatAmount(check.annualLimitUsd)}/year NRO cap.`}
            overLabel={`$${formatAmount(check.amountUsd)} is past the $${formatAmount(check.annualLimitUsd)}/year NRO cap - talk to your bank before repatriating more this year.`}
          />
          <p className="regime-verdict">
            {check.requiresCaCertificate
              ? `Past the ₹${formatAmount(check.ceilingCertificateThresholdInr)} mark: your bank will need ${check.formNames.join(" and ")} - the CA certificate confirms the tax due on this money is already paid.`
              : `Below the ₹${formatAmount(check.ceilingCertificateThresholdInr)} mark - usually just your own declaration (${check.formNames[0]}) is needed, no CA certificate yet.`}
          </p>
        </div>
      ) : null}
    </section>
  );
}
