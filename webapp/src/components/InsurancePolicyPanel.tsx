import {
  BLANK_INSURANCE_POLICY,
  newInsurancePolicyId,
  summarizeInsurancePolicies,
  type InsurancePolicy
} from "../lib/insurance";
import type { CapitalGainsEquityRule, InsuranceRule } from "../rules";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const TAX_TREATMENT_LABELS: Record<string, string> = {
  exempt: "Exempt",
  capital_gains_lt: "Taxable - long-term capital gains",
  capital_gains_st: "Taxable - short-term capital gains",
  other_sources_slab: "Taxable - income from other sources (slab rate)"
};

/**
 * Optional deeper input than the dashboard's aggregate-premium check: one
 * card per policy, with the issue date, sum assured, premium history, and
 * this year's payout needed to actually compute whether Section 10(10D)
 * exemption survives, and if not, the taxable amount. Entirely skippable -
 * leaving the list empty falls back to the dashboard's simpler premium-cap
 * check. See rules/insurance.md.
 */
export function InsurancePolicyPanel({
  policies,
  onChangePolicies,
  insuranceRule,
  capitalGainsRule
}: {
  policies: InsurancePolicy[];
  onChangePolicies: (policies: InsurancePolicy[]) => void;
  insuranceRule: InsuranceRule;
  capitalGainsRule: CapitalGainsEquityRule;
}) {
  const summary = summarizeInsurancePolicies(policies, insuranceRule, capitalGainsRule);

  function updatePolicy(id: string, patch: Partial<InsurancePolicy>) {
    onChangePolicies(
      policies.map((policy) => (policy.id === id ? { ...policy, ...patch } : policy))
    );
  }

  function removePolicy(id: string) {
    onChangePolicies(policies.filter((policy) => policy.id !== id));
  }

  function addPolicy() {
    onChangePolicies([...policies, { ...BLANK_INSURANCE_POLICY, id: newInsurancePolicyId() }]);
  }

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        Add one card per policy to compute whether its Section 10(10D) exemption survives, and if
        not, the taxable amount - the aggregate-premium check on the dashboard only checks a single
        combined premium figure, not each policy's own issue date and history.{" "}
        <RuleSourceLink refs={insuranceRule.source_refs} />
      </p>

      {policies.length === 0 ? (
        <p className="checklist-empty">No policies added yet.</p>
      ) : (
        summary.results.map(
          ({ policy, exempt, reason, taxableAmount, taxTreatment, estimatedTax }) => (
            <div className="insurance-policy-card" key={policy.id}>
              <div className="supplemental-grid">
                <label className="supplemental-field">
                  Policy type
                  <select
                    value={policy.policyType}
                    onChange={(event) =>
                      updatePolicy(policy.id, {
                        policyType: event.target.value as InsurancePolicy["policyType"]
                      })
                    }
                  >
                    <option value="ulip">ULIP</option>
                    <option value="traditional">Traditional (endowment/money-back)</option>
                  </select>
                </label>
                <label className="supplemental-field">
                  <input
                    type="checkbox"
                    checked={policy.isDeathBenefit}
                    onChange={(event) =>
                      updatePolicy(policy.id, { isDeathBenefit: event.target.checked })
                    }
                  />{" "}
                  This is a death benefit, not a maturity/survival payout
                </label>
                {!policy.isDeathBenefit ? (
                  <>
                    <label className="supplemental-field">
                      Issue date
                      <input
                        type="date"
                        value={policy.issueDate}
                        onChange={(event) =>
                          updatePolicy(policy.id, { issueDate: event.target.value })
                        }
                      />
                    </label>
                    <label className="supplemental-field">
                      Sum assured
                      <input
                        type="number"
                        min={0}
                        value={policy.sumAssured}
                        placeholder="₹0"
                        onChange={(event) =>
                          updatePolicy(policy.id, { sumAssured: Number(event.target.value) || 0 })
                        }
                      />
                    </label>
                    <label className="supplemental-field">
                      This policy year's premium
                      <input
                        type="number"
                        min={0}
                        value={policy.annualPremium}
                        placeholder="₹0"
                        onChange={(event) =>
                          updatePolicy(policy.id, {
                            annualPremium: Number(event.target.value) || 0
                          })
                        }
                      />
                    </label>
                    <label className="supplemental-field">
                      Total premiums paid to date (cost basis for a taxable payout)
                      <input
                        type="number"
                        min={0}
                        value={policy.totalPremiumsPaidToDate}
                        placeholder="₹0"
                        onChange={(event) =>
                          updatePolicy(policy.id, {
                            totalPremiumsPaidToDate: Number(event.target.value) || 0
                          })
                        }
                      />
                    </label>
                    <label className="supplemental-field">
                      Maturity/survival payout received this year
                      <input
                        type="number"
                        min={0}
                        value={policy.maturityPayoutThisYear}
                        placeholder="₹0"
                        onChange={(event) =>
                          updatePolicy(policy.id, {
                            maturityPayoutThisYear: Number(event.target.value) || 0
                          })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </div>
              <div className="regime-result">
                <p className="regime-verdict">
                  {TAX_TREATMENT_LABELS[taxTreatment]}: {reason}
                </p>
                {!exempt ? (
                  <div className="regime-result-row">
                    <span>Taxable amount (payout − premiums paid)</span>
                    <strong>₹{formatAmount(taxableAmount)}</strong>
                  </div>
                ) : null}
                {taxTreatment === "capital_gains_lt" || taxTreatment === "capital_gains_st" ? (
                  <div className="regime-result-row">
                    <span>Estimated capital-gains tax on this policy alone</span>
                    <strong>₹{formatAmount(estimatedTax)}</strong>
                  </div>
                ) : null}
              </div>
              <button type="button" className="text-button" onClick={() => removePolicy(policy.id)}>
                Remove This Policy
              </button>
            </div>
          )
        )
      )}

      <button type="button" className="text-button" onClick={addPolicy}>
        + Add A Policy
      </button>

      {summary.totalOtherSourcesSlabIncome > 0 ? (
        <p className="step-lede">
          ₹{formatAmount(summary.totalOtherSourcesSlabIncome)} of taxable traditional-policy payout
          is added automatically to your slab income in the regime comparison below - don't re-enter
          it in "Bank interest &amp; other income".
        </p>
      ) : null}
      {summary.totalUlipCapitalGainsTax > 0 ? (
        <p className="step-lede">
          Each taxable ULIP above uses the full ₹1,25,000 annual LTCG exemption on its own. If you
          also have other equity long-term gains this year, the two share one exemption combined, so
          your real combined tax may be higher than the per-policy figures shown here. A CA should
          combine both under the one limit before you file.
        </p>
      ) : null}
    </section>
  );
}
