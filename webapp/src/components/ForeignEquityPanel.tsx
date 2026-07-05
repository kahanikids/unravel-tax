import {
  BLANK_FOREIGN_EQUITY_HOLDING,
  newForeignEquityHoldingId,
  summarizeForeignEquityHoldings,
  type ForeignEquityHolding
} from "../lib/foreignEquity";
import type { ForeignInvestmentsRule } from "../rules";
import type { SupplementalFigures } from "../state/types";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const TREATMENT_LABELS: Record<string, string> = {
  not_sold: "Not sold this year",
  long_term: "Sold - long-term (24 months+)",
  short_term: "Sold - short-term (24 months or less)"
};

/**
 * Schedule FA Phase 2: foreign equity/debt holdings (table A3), including
 * RSU/ESPP from a foreign employer. Unlike Phase 1's bank/brokerage
 * accounts, this computes actual Indian tax on a sale - foreign shares are
 * taxed like unlisted Indian shares, not listed equity. See
 * rules/foreign-investments.md and docs/DESIGN-remaining-gaps.md.
 */
export function ForeignEquityPanel({
  holdings,
  onChangeHoldings,
  supplementalFigures,
  onChangeSupplementalFigures,
  rule,
  hasRegimeResult
}: {
  holdings: ForeignEquityHolding[];
  onChangeHoldings: (holdings: ForeignEquityHolding[]) => void;
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  rule: ForeignInvestmentsRule;
  /** Whether the old-vs-new regime comparison has enough (salary entered) to compute an average tax rate - the other-income foreign tax credit estimate needs one. */
  hasRegimeResult: boolean;
}) {
  const summary = summarizeForeignEquityHoldings(holdings, rule);
  const shareRule = rule.values.income_taxation.capital_gains_on_foreign_shares;

  function updateHolding(id: string, patch: Partial<ForeignEquityHolding>) {
    onChangeHoldings(holdings.map((holding) => (holding.id === id ? { ...holding, ...patch } : holding)));
  }
  function removeHolding(id: string) {
    onChangeHoldings(holdings.filter((holding) => holding.id !== id));
  }
  function addHolding() {
    onChangeHoldings([...holdings, { ...BLANK_FOREIGN_EQUITY_HOLDING, id: newForeignEquityHoldingId() }]);
  }

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        Foreign shares (including RSU/ESPP once vested) are taxed like <strong>unlisted</strong> Indian shares, not
        listed equity: long-term only past {shareRule.long_term_holding_period_days_gt} days (24 months), at a flat{" "}
        {(shareRule.ltcg_rate * 100).toLocaleString("en-IN")}% with no indexation; short-term is your slab rate, added
        to the regime comparison's other income. <RuleSourceLink refs={rule.source_refs} />
      </p>

      {holdings.length === 0 ? (
        <p className="checklist-empty">No foreign equity/debt holdings added yet.</p>
      ) : (
        summary.results.map(({ holding, sold, gain, taxTreatment, estimatedLtcgTax, foreignTaxCreditOnGain }) => (
          <div className="insurance-policy-card" key={holding.id}>
            <div className="supplemental-grid">
              <label className="supplemental-field">
                Entity name
                <input
                  type="text"
                  value={holding.entityName}
                  placeholder="e.g. Acme Inc"
                  onChange={(event) => updateHolding(holding.id, { entityName: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                <input
                  type="checkbox"
                  checked={holding.isRsuOrEspp}
                  onChange={(event) => updateHolding(holding.id, { isRsuOrEspp: event.target.checked })}
                />{" "}
                This is RSU/ESPP from a foreign employer
              </label>
              <label className="supplemental-field">
                {holding.isRsuOrEspp ? "Vesting date" : "Acquisition date"}
                <input
                  type="date"
                  value={holding.acquisitionDate}
                  onChange={(event) => updateHolding(holding.id, { acquisitionDate: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                {holding.isRsuOrEspp ? "Cost basis (FMV at vesting, ₹)" : "Cost basis (₹)"}
                <input
                  type="number"
                  min={0}
                  value={holding.costBasisInr}
                  placeholder="₹0"
                  onChange={(event) => updateHolding(holding.id, { costBasisInr: Number(event.target.value) || 0 })}
                />
              </label>
              {holding.isRsuOrEspp ? (
                <label className="supplemental-field">
                  Perquisite value taxed as salary this year (₹)
                  <input
                    type="number"
                    min={0}
                    value={holding.perquisiteValueInr}
                    placeholder="₹0"
                    onChange={(event) => updateHolding(holding.id, { perquisiteValueInr: Number(event.target.value) || 0 })}
                  />
                </label>
              ) : null}
              <label className="supplemental-field">
                Closing value this year (₹, 0 if sold)
                <input
                  type="number"
                  min={0}
                  value={holding.closingValueInr}
                  placeholder="₹0"
                  onChange={(event) => updateHolding(holding.id, { closingValueInr: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="supplemental-field">
                Sale date (leave blank if not sold this year)
                <input
                  type="date"
                  value={holding.saleDate}
                  onChange={(event) => updateHolding(holding.id, { saleDate: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Sale proceeds this year (₹)
                <input
                  type="number"
                  min={0}
                  value={holding.saleProceedsInr}
                  placeholder="₹0"
                  onChange={(event) => updateHolding(holding.id, { saleProceedsInr: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="supplemental-field">
                Foreign tax paid on this sale's gain (₹)
                <input
                  type="number"
                  min={0}
                  value={holding.foreignTaxPaidOnGainInr}
                  placeholder="₹0"
                  onChange={(event) => updateHolding(holding.id, { foreignTaxPaidOnGainInr: Number(event.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="regime-result">
              <p className="regime-verdict">{TREATMENT_LABELS[taxTreatment]}</p>
              {sold ? (
                <>
                  <div className="regime-result-row">
                    <span>Gain</span>
                    <strong>₹{formatAmount(gain)}</strong>
                  </div>
                  {taxTreatment === "long_term" ? (
                    <>
                      <div className="regime-result-row">
                        <span>Estimated LTCG tax</span>
                        <strong>₹{formatAmount(estimatedLtcgTax)}</strong>
                      </div>
                      {foreignTaxCreditOnGain > 0 ? (
                        <div className="regime-result-row">
                          <span>Foreign tax credit (Section 90/91)</span>
                          <strong>₹{formatAmount(foreignTaxCreditOnGain)}</strong>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="regime-verdict">
                      Short-term - taxed at your slab rate, added to the regime comparison's other income below, not
                      shown as a flat amount here.
                    </p>
                  )}
                </>
              ) : null}
            </div>
            <button type="button" className="text-button" onClick={() => removeHolding(holding.id)}>
              Remove This Holding
            </button>
          </div>
        ))
      )}
      <button type="button" className="text-button" onClick={addHolding}>
        + Add A Holding
      </button>

      {summary.totalLtcgTax > 0 ? (
        <p className="step-lede">
          Total foreign-share long-term capital gains tax: <strong>₹{formatAmount(summary.totalLtcgTax)}</strong>,
          shown as its own row in the CA Summary above.
        </p>
      ) : null}
      {summary.totalStcgGain > 0 ? (
        <p className="step-lede">
          ₹{formatAmount(summary.totalStcgGain)} of short-term foreign-share gains is added automatically to your
          slab income in the regime comparison below.
        </p>
      ) : null}
      {summary.totalPerquisiteValueInr > 0 ? (
        <p className="step-lede">
          ₹{formatAmount(summary.totalPerquisiteValueInr)} of RSU/ESPP perquisite value is added automatically to
          your salary income in the regime comparison below - don't re-enter it in the salary field.
        </p>
      ) : null}

      <div className="regime-result">
        <label className="supplemental-field">
          Foreign tax paid on dividends/interest/short-term foreign-share gains/RSU perquisite combined (₹)
          <input
            type="number"
            min={0}
            value={supplementalFigures.foreignTaxPaidOnOtherIncomeInr}
            placeholder="₹0"
            onChange={(event) =>
              onChangeSupplementalFigures({
                ...supplementalFigures,
                foreignTaxPaidOnOtherIncomeInr: Number(event.target.value) || 0
              })
            }
          />
        </label>
        {hasRegimeResult ? (
          <p className="regime-verdict">
            The Section 90/91 foreign tax credit estimate on this slab-taxed foreign income (including any foreign
            dividend/interest from the Schedule FA accounts section) shows as its own CA Summary row above, using the
            average-rate method (Rule 128) against whichever regime looks cheaper. This is a planning estimate, not a
            Form 67 number - Form 67 needs a per-country breakdown a CA should verify.
          </p>
        ) : (
          <p className="checklist-empty">Enter your salary income above to see a foreign tax credit estimate.</p>
        )}
      </div>
    </section>
  );
}
