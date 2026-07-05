import { useState } from "react";
import {
  BLANK_PAST_FILING_FIELDS,
  deriveHistoryInsights,
  FILING_SOURCE_LABELS,
  normalizeAssessmentYear,
  parseItrJson,
  parseItrVText,
  REGIME_LABELS,
  type FilingRegime,
  type FilingSource,
  type PastFiling,
  type PastFilingFields
} from "../lib/pastFilings";
import type { InsurancePayoutCheck } from "../lib/insurance";
import { REMITTANCE_PURPOSE_LABELS, type ForeignRemittanceTcs } from "../lib/foreignInvestments";
import type { RemittancePurpose } from "../state/types";
import { RuleSourceLink } from "./RuleSourceLink";
import { InfoTooltip } from "./InfoTooltip";
import {
  DeductionBar,
  Donut,
  formatCompactInr,
  Meter,
  SignedBarChart,
  TrendChart,
  VarianceGauge,
  type ChartSeries,
  type DonutSegment
} from "./DashboardWidgets";
import { IconPlus } from "./icons";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const CAPITAL_GAINS_COLORS = {
  stcg: "#2bb673",
  ltcg: "#147a47",
  debtMf: "#9361e2",
  intraday: "#e0982f"
} as const;

function formatSignedInr(value: number) {
  if (value > 0) {
    return `₹${formatAmount(value)} refund`;
  }
  if (value < 0) {
    return `₹${formatAmount(-value)} payable`;
  }
  return "Nil";
}

function formatPercent(rate: number) {
  return `${(rate * 100).toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`;
}

/** ISO due date (e.g. "2026-07-31") to a short "31 Jul 2026". */
function formatDueDate(iso: string) {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Capital-gain buckets for the donut + the Section 112A tax-free-LTCG tracker. */
export type CapitalGainsBreakdown = {
  stcg: number;
  ltcg: number;
  debtMf: number;
  intraday: number;
  /** Section 112A tax-free limit, read from rules/capital-gains-equity.json. */
  ltcgExemptionLimit: number;
};

/** Old vs new regime, on the slab-taxed portion of income (see regimeComparison.ts). */
export type RegimeSnapshot = {
  /** False when there's nothing to compare (no salary entered) or it doesn't fit (HUF). */
  comparable: boolean;
  newRegimeTax: number;
  oldRegimeTax: number;
  cheaper: "new" | "old" | "equal";
  saving: number;
  /** Old-regime deductions at which the two regimes' tax matches. */
  breakEvenDeductions: number;
  /** Old-regime deductions actually entered (same total the comparison uses). */
  actualDeductions: number;
  /** True once the new regime is already zero-tax: no deduction can beat it. */
  newAlwaysWins: boolean;
};

/** One deduction's used amount vs its limit (limit from rules/deduction-limits.json). */
export type DeductionProgress = {
  key: "deduction80C" | "deduction80D" | "deductionNps80ccd1b";
  section: string;
  label: string;
  used: number;
  limit: number;
  /** Amount counted toward the same ceiling from elsewhere (e.g. home-loan principal inside 80C): shown in the meter, not editable here. */
  extra?: number;
  /** One line explaining where `extra` comes from. */
  extraNote?: string;
};

/** Section 10(10D) insurance-payout premium-cap check (see lib/insurance.ts).
 * `applies` is the orientation flag (received a payout this year); the widget
 * also shows once a premium is entered, even without the flag. */
export type InsuranceSnapshot = InsurancePayoutCheck & {
  applies: boolean;
  sourceRefs: readonly string[];
};

/** Foreign-asset disclosure reminder + LRS-TCS threshold check (see
 * lib/foreignInvestments.ts). Every rupee figure here is read from
 * rules/foreign-investments.json, never hardcoded. */
export type ForeignInvestmentsSnapshot = ForeignRemittanceTcs & {
  applies: boolean;
  scheduleFaMinValueInr: number;
  requiresItrForms: string[];
  blackMoneyPenaltyInr: number;
  sourceRefs: readonly string[];
};

/** AIS/TDS variance summary, from what the user has entered vs AIS figures. */
export type VarianceSnapshot = {
  /** How many figures were actually compared (AIS + TDS + broker rows). */
  checkCount: number;
  mismatchCount: number;
  totalAbsVariance: number;
};

/** The current in-progress filing, summarized for the "this year" panel.
 * Every figure here is computed deterministically upstream in App - the
 * dashboard only displays it (deduction inputs write straight back to the
 * same session figures). */
export type ThisYearSnapshot = {
  hasStartedFiling: boolean;
  financialYear: string;
  assessmentYear: string;
  itrForm: string;
  itrDueDate: string;
  regimeNote: string;
  capitalGains: CapitalGainsBreakdown;
  estimatedCapitalGainsTax: number;
  regime: RegimeSnapshot;
  deductions: DeductionProgress[];
  insurance: InsuranceSnapshot;
  foreignInvestments: ForeignInvestmentsSnapshot;
  variance: VarianceSnapshot;
};

export function Dashboard({
  thisYear,
  pastFilings,
  onAddPastFiling,
  onRemovePastFiling,
  onGoToFiling,
  onChangeDeduction,
  onChangeFigure,
  onChangeRemittancePurpose,
  showAdvanced,
  onToggleAdvanced
}: {
  thisYear: ThisYearSnapshot;
  pastFilings: PastFiling[];
  onAddPastFiling: (fields: PastFilingFields, source: FilingSource) => void;
  onRemovePastFiling: (id: string) => void;
  onGoToFiling: () => void;
  onChangeDeduction: (key: DeductionProgress["key"], value: number) => void;
  onChangeFigure: (key: "insuranceAnnualPremium" | "foreignRemittanceLrs", value: number) => void;
  onChangeRemittancePurpose: (purpose: RemittancePurpose) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}) {
  const insights = deriveHistoryInsights(pastFilings);
  const hasHistory = insights.sorted.length > 0;
  const maxIncome = Math.max(1, ...insights.sorted.map((filing) => filing.grossTotalIncome));
  const maxRate = Math.max(0.01, ...insights.effectiveRates.map((point) => point.rate));

  // Year-over-year chart data. Older saved rows may predate these fields, so
  // every figure is coerced to a number before it reaches a chart.
  const years = insights.sorted.map((filing) => filing.assessmentYear);
  const num = (value: number) => (Number.isFinite(value) ? value : 0);
  const refundTrend = insights.sorted.map((filing) => num(filing.refundOrPayable));
  const outcomeSeries: ChartSeries[] = [
    {
      label: "Capital gains / losses",
      color: "#2bb673",
      values: insights.sorted.map((f) => num(f.capitalGains))
    },
    {
      label: "Total tax paid",
      color: "#147a47",
      values: insights.sorted.map((f) => num(f.totalTaxPaid))
    },
    {
      label: "Losses carried forward",
      color: "#9361e2",
      values: insights.sorted.map((f) => num(f.carryForwardLosses))
    }
  ];
  const loanSeries: ChartSeries[] = [
    {
      label: "Principal repaid",
      color: "#2b7fff",
      values: insights.sorted.map((f) => num(f.loanPrincipal))
    },
    {
      label: "Interest paid",
      color: "#e0982f",
      values: insights.sorted.map((f) => num(f.loanInterest))
    }
  ];
  const hasAny = (series: ChartSeries[]) =>
    series.some((line) => line.values.some((value) => value !== 0));
  const hasOutcomeData = hasAny(outcomeSeries);
  const hasLoanData = hasAny(loanSeries);
  const hasRefundData = refundTrend.some((value) => value !== 0);

  const cg = thisYear.capitalGains;
  const netGains = cg.stcg + cg.ltcg + cg.debtMf + cg.intraday;
  const gainSegments: DonutSegment[] = [
    { label: "Short-term (equity)", value: cg.stcg, color: CAPITAL_GAINS_COLORS.stcg },
    { label: "Long-term (equity)", value: cg.ltcg, color: CAPITAL_GAINS_COLORS.ltcg },
    { label: "Debt MF (50AA)", value: cg.debtMf, color: CAPITAL_GAINS_COLORS.debtMf },
    { label: "Intraday / speculative", value: cg.intraday, color: CAPITAL_GAINS_COLORS.intraday }
  ];
  const hasGains = gainSegments.some((segment) => Math.abs(segment.value) > 0);

  const ltcgUsed = Math.max(0, cg.ltcg);
  const ltcgHeadroom = Math.max(0, cg.ltcgExemptionLimit - ltcgUsed);
  const ltcgTaxable = Math.max(0, ltcgUsed - cg.ltcgExemptionLimit);

  const variance = thisYear.variance;
  const matched = Math.max(0, variance.checkCount - variance.mismatchCount);

  // Insurance and foreign-investment widgets only clutter the dashboard for
  // someone they apply to: the orientation flag, or once a figure is entered.
  const insurance = thisYear.insurance;
  const foreign = thisYear.foreignInvestments;
  const showInsurance = insurance.applies || insurance.annualPremium > 0;
  const showForeign = foreign.applies || foreign.remittance > 0;
  const insuranceStatus = insurance.overTraditionalCap
    ? `Over both the ${formatCompactInr(insurance.ulipCap)} ULIP and ${formatCompactInr(
        insurance.traditionalCap
      )} traditional lines. A ULIP maturity is taxed as capital gains, a traditional one as income from other sources.`
    : insurance.overUlipCap
      ? `Over the ${formatCompactInr(insurance.ulipCap)} ULIP line. If any policy is a ULIP issued on/after 1-Feb-2021, its maturity is taxable as capital gains; traditional policies are still under the ${formatCompactInr(
          insurance.traditionalCap
        )} line.`
      : insurance.annualPremium > 0
        ? `Under both the ${formatCompactInr(insurance.ulipCap)} ULIP and ${formatCompactInr(
            insurance.traditionalCap
          )} traditional lines, so the maturity stays tax-free under 10(10D).`
        : "Enter your total annual premium to check whether a maturity payout would still be tax-free.";

  return (
    <div className="step-card dashboard">
      <div className="panel-heading">
        <div>
          <h2>Your tax dashboard</h2>
          <p className="step-lede">
            This year at a glance, and how your filings compare year over year. Everything runs in
            this browser.
          </p>
        </div>
        <button type="button" className="view-toggle" onClick={onToggleAdvanced}>
          {showAdvanced ? "Show Simple View" : "Show Full Detail"}
        </button>
      </div>

      {/* ---- This year at a glance: visual command centre ---- */}
      <section className="dashboard-section" aria-labelledby="dashboard-this-year">
        <h3 id="dashboard-this-year">{`This year: ${thisYear.assessmentYear}`}</h3>
        {thisYear.hasStartedFiling ? (
          <>
            {/* ITR form badge + tax-year timeline */}
            <div className="dashboard-timeline-card">
              <div className="itr-badge">
                <span className="itr-badge-label">Recommended form</span>
                <strong className="itr-badge-form">{thisYear.itrForm}</strong>
              </div>
              <ol className="tax-timeline" aria-label="Filing timeline">
                <li className="tax-timeline-step">
                  <span className="tax-timeline-dot" aria-hidden="true" />
                  <span className="tax-timeline-title">{`FY ${thisYear.financialYear}`}</span>
                  <span className="tax-timeline-note">Income earned Apr-Mar</span>
                </li>
                <li className="tax-timeline-step">
                  <span className="tax-timeline-dot" aria-hidden="true" />
                  <span className="tax-timeline-title">{thisYear.assessmentYear}</span>
                  <span className="tax-timeline-note">Filed this year</span>
                </li>
                <li className="tax-timeline-step tax-timeline-step-due">
                  <span className="tax-timeline-dot" aria-hidden="true" />
                  <span className="tax-timeline-title">
                    Due {formatDueDate(thisYear.itrDueDate)}
                  </span>
                  <span className="tax-timeline-note">{thisYear.regimeNote}</span>
                </li>
              </ol>
            </div>

            <div className="dashboard-widgets">
              {/* 1. Regime simulator */}
              <article className="dashboard-widget" aria-labelledby="widget-regime">
                <h4 id="widget-regime">New vs old regime</h4>
                {thisYear.regime.comparable ? (
                  <>
                    <div className="regime-cards">
                      <div
                        className={
                          thisYear.regime.cheaper === "new"
                            ? "regime-card regime-card-win"
                            : "regime-card"
                        }
                      >
                        <span className="regime-card-label">New</span>
                        <strong className="regime-card-value">
                          {formatCompactInr(thisYear.regime.newRegimeTax)}
                        </strong>
                      </div>
                      <div
                        className={
                          thisYear.regime.cheaper === "old"
                            ? "regime-card regime-card-win"
                            : "regime-card"
                        }
                      >
                        <span className="regime-card-label">Old</span>
                        <strong className="regime-card-value">
                          {formatCompactInr(thisYear.regime.oldRegimeTax)}
                        </strong>
                      </div>
                    </div>
                    <p className="widget-note">
                      {thisYear.regime.cheaper === "equal"
                        ? "About the same either way on this estimate."
                        : `${thisYear.regime.cheaper === "new" ? "New" : "Old"} regime saves about ${formatCompactInr(
                            thisYear.regime.saving
                          )}. Slab income only.`}
                    </p>
                    {thisYear.regime.newAlwaysWins ? (
                      <p className="widget-note">
                        New regime is already zero-tax here, so there's no break-even to beat.
                      </p>
                    ) : (
                      <>
                        <p className="widget-note">
                          Break-even deductions{" "}
                          <strong>{formatCompactInr(thisYear.regime.breakEvenDeductions)}</strong>
                        </p>
                        <Meter
                          used={thisYear.regime.actualDeductions}
                          limit={thisYear.regime.breakEvenDeductions}
                          caption={`You've entered ${formatCompactInr(
                            thisYear.regime.actualDeductions
                          )} of old-regime deductions vs the ${formatCompactInr(
                            thisYear.regime.breakEvenDeductions
                          )} break-even.`}
                          overLabel={`You're past the ${formatCompactInr(
                            thisYear.regime.breakEvenDeductions
                          )} break-even, so the old regime wins.`}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <p className="widget-empty">Add your salary in Results to compare regimes.</p>
                )}
              </article>

              {/* 2a. Capital gains donut */}
              <article className="dashboard-widget" aria-labelledby="widget-gains">
                <h4 id="widget-gains">Capital gains by type</h4>
                {hasGains ? (
                  <Donut
                    segments={gainSegments}
                    centerValue={formatCompactInr(netGains)}
                    centerLabel="net"
                    ariaLabel="Capital gains and losses by asset type"
                  />
                ) : (
                  <p className="widget-empty">No capital gains in your documents yet.</p>
                )}
              </article>

              {/* 2b. Section 112A tax-free LTCG harvesting tracker */}
              <article className="dashboard-widget" aria-labelledby="widget-ltcg">
                <h4 id="widget-ltcg">Tax-free LTCG left (112A)</h4>
                <strong className="widget-headline">{formatCompactInr(ltcgHeadroom)}</strong>
                <Meter
                  used={ltcgUsed}
                  limit={cg.ltcgExemptionLimit}
                  caption={`${formatCompactInr(ltcgHeadroom)} of the ${formatCompactInr(
                    cg.ltcgExemptionLimit
                  )} exemption still unused`}
                  overLabel={`Exemption used in full: ${formatCompactInr(ltcgTaxable)} of LTCG is taxable`}
                />
              </article>

              {/* 3. Deduction progress bars */}
              <article className="dashboard-widget" aria-labelledby="widget-deductions">
                <h4 id="widget-deductions">Deductions used (old regime)</h4>
                <div className="deduction-bars">
                  {thisYear.deductions.map((deduction) => (
                    <DeductionBar
                      key={deduction.key}
                      label={deduction.label}
                      section={deduction.section}
                      used={deduction.used}
                      limit={deduction.limit}
                      extra={deduction.extra}
                      extraNote={deduction.extraNote}
                      onChange={(value) => onChangeDeduction(deduction.key, value)}
                    />
                  ))}
                </div>
              </article>

              {/* 4. Reconciliation variance gauge */}
              <article className="dashboard-widget" aria-labelledby="widget-variance">
                <h4 id="widget-variance">AIS / TDS match</h4>
                {variance.checkCount > 0 ? (
                  <>
                    <VarianceGauge matched={matched} total={variance.checkCount} />
                    <p className="widget-note">
                      {variance.mismatchCount === 0
                        ? "Everything you've entered matches your AIS figures."
                        : `${variance.mismatchCount} mismatch${variance.mismatchCount === 1 ? "" : "es"} worth ${formatCompactInr(
                            variance.totalAbsVariance
                          )}, from what you've entered vs AIS.`}
                    </p>
                  </>
                ) : (
                  <p className="widget-empty">
                    Enter your AIS/26AS figures in Results to check for mismatches.
                  </p>
                )}
              </article>

              {/* 5. Insurance payout: Section 10(10D) premium-cap check */}
              {showInsurance ? (
                <article className="dashboard-widget" aria-labelledby="widget-insurance">
                  <h4 id="widget-insurance">Insurance payout still tax-free? (10(10D))</h4>
                  <label className="deduction-bar-input">
                    <span className="visually-hidden">Aggregate annual life-insurance premium</span>
                    <input
                      type="number"
                      min={0}
                      value={insurance.annualPremium}
                      placeholder="₹0"
                      onChange={(event) =>
                        onChangeFigure("insuranceAnnualPremium", Number(event.target.value) || 0)
                      }
                    />
                  </label>
                  <Meter
                    used={insurance.annualPremium}
                    limit={insurance.ulipCap}
                    caption={`Aggregate annual premium vs the ${formatCompactInr(insurance.ulipCap)} ULIP exemption line.`}
                    overLabel={`Past the ${formatCompactInr(insurance.ulipCap)} ULIP line. A ULIP maturity loses its 10(10D) exemption.`}
                  />
                  <p className="widget-note">{insuranceStatus}</p>
                  <p className="widget-note">
                    The exact taxable figure still needs the policy&apos;s issue date and
                    premium-to-sum-assured history, which this tool doesn&apos;t hold. Death
                    benefits stay fully exempt. <RuleSourceLink refs={insurance.sourceRefs} />
                  </p>
                </article>
              ) : null}

              {/* 6. Foreign assets: Schedule FA reminder + LRS TCS threshold */}
              {showForeign ? (
                <article className="dashboard-widget" aria-labelledby="widget-foreign">
                  <h4 id="widget-foreign">Foreign assets &amp; LRS remittances</h4>
                  <p className="widget-note">
                    Every foreign asset held at any point in the calendar year goes in Schedule FA,
                    with{" "}
                    {foreign.scheduleFaMinValueInr === 0
                      ? "no minimum value"
                      : `a floor of ${formatCompactInr(foreign.scheduleFaMinValueInr)}`}
                    , and it needs {foreign.requiresItrForms.join(" or ")} (never ITR-1). Missing
                    one risks a {formatCompactInr(foreign.blackMoneyPenaltyInr)} Black Money Act
                    penalty.
                  </p>
                  <label className="deduction-bar-input">
                    <span className="visually-hidden">LRS money sent abroad this year</span>
                    <input
                      type="number"
                      min={0}
                      value={foreign.remittance}
                      placeholder="₹0"
                      onChange={(event) =>
                        onChangeFigure("foreignRemittanceLrs", Number(event.target.value) || 0)
                      }
                    />
                  </label>
                  <label className="deduction-bar-input">
                    <span className="visually-hidden">What the money was for</span>
                    <select
                      value={foreign.purpose}
                      onChange={(event) =>
                        onChangeRemittancePurpose(event.target.value as RemittancePurpose)
                      }
                    >
                      {(Object.keys(REMITTANCE_PURPOSE_LABELS) as RemittancePurpose[]).map(
                        (purpose) => (
                          <option key={purpose} value={purpose}>
                            {REMITTANCE_PURPOSE_LABELS[purpose]}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <Meter
                    used={foreign.remittance}
                    limit={foreign.threshold}
                    caption={`LRS money sent abroad vs the ${formatCompactInr(foreign.threshold)} yearly TCS-free limit.`}
                    overLabel={
                      foreign.purpose === "education_loan_funded"
                        ? `Over ${formatCompactInr(foreign.threshold)}, but an education-loan-funded remittance collects no TCS at all.`
                        : `Over ${formatCompactInr(foreign.threshold)}: about ${formatCompactInr(
                            foreign.estimatedTcs
                          )} TCS is collected at ${formatPercent(foreign.rate)} on the excess.`
                    }
                  />
                  <p className="widget-note">
                    {foreign.overThreshold
                      ? foreign.purpose === "education_loan_funded"
                        ? "Remittances funded by a Section 80E education loan are fully exempt from LRS TCS, whatever the amount."
                        : `That ${formatCompactInr(
                            foreign.estimatedTcs
                          )} TCS is a prepaid credit shown in your AIS/26AS, recoverable in the return, not an added cost.`
                      : "TCS applies only above the threshold, and even then it's a prepaid credit, not a cost."}{" "}
                    Foreign tax paid abroad is credited via Form 67.{" "}
                    <RuleSourceLink refs={foreign.sourceRefs} />
                  </p>
                </article>
              ) : null}
            </div>

            <button type="button" className="text-button" onClick={onGoToFiling}>
              Go To This Year&apos;s Results →
            </button>
          </>
        ) : (
          <div className="dashboard-empty">
            <p>You haven&apos;t started this year&apos;s filing yet.</p>
            <button type="button" className="primary-button" onClick={onGoToFiling}>
              Start This Year&apos;s Filing
            </button>
          </div>
        )}
      </section>

      {/* ---- Year-over-year history ---- */}
      <section className="dashboard-section" aria-labelledby="dashboard-history">
        <h3 id="dashboard-history">Your filing history</h3>

        {hasHistory ? (
          <>
            {/* Main chart: tax paid vs refunded, year over year. */}
            <div className="dashboard-chart-card">
              <p className="dashboard-bars-caption">Tax paid or refunded, year over year</p>
              {hasRefundData ? (
                <SignedBarChart
                  labels={years}
                  values={refundTrend}
                  positiveLabel="Refund received"
                  negativeLabel="Tax payable"
                  ariaLabel="Refund received or tax payable by assessment year"
                />
              ) : (
                <p className="widget-empty">
                  Add a refund or balance-payable figure to a past year to see this trend.
                </p>
              )}
            </div>

            {hasOutcomeData ? (
              <div className="dashboard-chart-card">
                <p className="dashboard-bars-caption">Gains, tax paid and carried-forward losses</p>
                <TrendChart
                  labels={years}
                  series={outcomeSeries}
                  ariaLabel="Capital gains, total tax paid and carried-forward losses by assessment year"
                />
              </div>
            ) : null}

            {hasLoanData ? (
              <div className="dashboard-chart-card">
                <p className="dashboard-bars-caption">
                  Loan principal and interest, year over year
                </p>
                <TrendChart
                  labels={years}
                  series={loanSeries}
                  ariaLabel="Loan principal repaid and interest paid by assessment year"
                />
              </div>
            ) : null}

            <div className="dashboard-insight-grid">
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Years on record</span>
                <strong>{insights.yearsCount}</strong>
              </article>
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Income growth (latest year)</span>
                <strong>
                  {insights.incomeGrowthPct === null
                    ? "-"
                    : `${insights.incomeGrowthPct >= 0 ? "+" : ""}${insights.incomeGrowthPct.toLocaleString(
                        "en-IN",
                        {
                          maximumFractionDigits: 1
                        }
                      )}%`}
                </strong>
                <span className="dashboard-stat-note">Gross total income vs the year before.</span>
              </article>
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Effective tax rate (latest)</span>
                <strong>
                  {insights.latestEffectiveRate === null
                    ? "-"
                    : formatPercent(insights.latestEffectiveRate)}
                </strong>
                <span className="dashboard-stat-note">Total tax paid ÷ gross total income.</span>
              </article>
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Regime</span>
                <strong>
                  {insights.regimeSwitched
                    ? "Switched"
                    : insights.regimesUsed[0]
                      ? REGIME_LABELS[insights.regimesUsed[0]]
                      : "Not recorded"}
                </strong>
                <span className="dashboard-stat-note">
                  {insights.regimeSwitched
                    ? "You've used more than one regime. Worth confirming you can still switch."
                    : "Across your recorded years."}
                </span>
              </article>
            </div>

            {/* Dependency-free CSS bars: gross total income per year. */}
            <div
              className="dashboard-bars"
              role="img"
              aria-label="Gross total income by assessment year"
            >
              {insights.sorted.map((filing) => (
                <div className="dashboard-bar-row" key={filing.id}>
                  <span className="dashboard-bar-label">{filing.assessmentYear}</span>
                  <span className="dashboard-bar-track">
                    <span
                      className="dashboard-bar-fill"
                      style={{
                        width: `${Math.round((filing.grossTotalIncome / maxIncome) * 100)}%`
                      }}
                    />
                  </span>
                  <span className="dashboard-bar-value">
                    ₹{formatAmount(filing.grossTotalIncome)}
                  </span>
                </div>
              ))}
            </div>

            <div className="preview-table-wrap">
              <table className="preview-table dashboard-table">
                <thead>
                  <tr>
                    <th>Assessment year</th>
                    <th>ITR form</th>
                    <th>Gross total income</th>
                    <th>Total tax paid</th>
                    <th>Refund / payable</th>
                    <th>Regime</th>
                    {showAdvanced ? <th>Effective rate</th> : null}
                    <th>Source</th>
                    <th aria-label="Remove row" />
                  </tr>
                </thead>
                <tbody>
                  {insights.sorted.map((filing) => {
                    const rate =
                      filing.grossTotalIncome > 0
                        ? filing.totalTaxPaid / filing.grossTotalIncome
                        : 0;
                    return (
                      <tr key={filing.id}>
                        <td data-label="Assessment year">{filing.assessmentYear}</td>
                        <td data-label="ITR form">{filing.itrForm || "-"}</td>
                        <td data-label="Gross total income">
                          ₹{formatAmount(filing.grossTotalIncome)}
                        </td>
                        <td data-label="Total tax paid">₹{formatAmount(filing.totalTaxPaid)}</td>
                        <td data-label="Refund / payable">
                          {formatSignedInr(filing.refundOrPayable)}
                        </td>
                        <td data-label="Regime">{REGIME_LABELS[filing.regime]}</td>
                        {showAdvanced ? (
                          <td data-label="Effective rate">{formatPercent(rate)}</td>
                        ) : null}
                        <td data-label="Source">
                          <span
                            className={
                              filing.source === "manual" ? "pill pill-neutral" : "pill pill-ready"
                            }
                          >
                            {FILING_SOURCE_LABELS[filing.source]}
                          </span>
                        </td>
                        <td data-label="Action">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => onRemovePastFiling(filing.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {showAdvanced ? (
              <div
                className="dashboard-bars"
                role="img"
                aria-label="Effective tax rate by assessment year"
              >
                <p className="dashboard-bars-caption">Effective tax rate over time</p>
                {insights.effectiveRates.map((point) => (
                  <div className="dashboard-bar-row" key={point.assessmentYear}>
                    <span className="dashboard-bar-label">{point.assessmentYear}</span>
                    <span className="dashboard-bar-track">
                      <span
                        className="dashboard-bar-fill dashboard-bar-fill-alt"
                        style={{ width: `${Math.round((point.rate / maxRate) * 100)}%` }}
                      />
                    </span>
                    <span className="dashboard-bar-value">{formatPercent(point.rate)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="dashboard-reminder">
              Carry-forward capital losses stay usable for 8 assessment years, and only if each
              year&apos;s return was filed on time. Advance tax for {thisYear.assessmentYear} is due
              in quarterly instalments if your tax after TDS will cross ₹10,000. Worth checking
              early.
            </p>
          </>
        ) : (
          <p className="dashboard-empty-note">
            No past years yet. Add a previous filing below to start seeing your income and tax
            trends year over year.
          </p>
        )}

        <AddPastFilingForm onAdd={onAddPastFiling} startOpen={!hasHistory} />
      </section>
    </div>
  );
}

const REGIME_OPTIONS: FilingRegime[] = ["unknown", "new", "old"];

function AddPastFilingForm({
  onAdd,
  startOpen
}: {
  onAdd: (fields: PastFilingFields, source: FilingSource) => void;
  startOpen: boolean;
}) {
  const [fields, setFields] = useState<PastFilingFields>(BLANK_PAST_FILING_FIELDS);
  const [autoRead, setAutoRead] = useState<Set<keyof PastFilingFields>>(new Set());
  // Which file type the auto-read fields came from, so the saved row is tagged
  // correctly (JSON vs ITR-V PDF vs hand-entered).
  const [autoSource, setAutoSource] = useState<"itr-json" | "itr-v" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PastFilingFields>(key: K, value: PastFilingFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    // A field the user edits by hand is no longer "auto-read from a file".
    setAutoRead((prev) => {
      if (!prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  // One upload path for both formats: JSON is parsed directly, an ITR-V PDF
  // is run through the existing pdf.js text extractor first, then the same
  // tolerant reader. Either way, unreadable input routes to manual entry
  // rather than throwing (the user said skipping-to-manual is fine).
  async function handleFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setError(null);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    try {
      const parsed = isPdf
        ? parseItrVText(
            (await (await import("../ingest/pdfExtract")).extractPdfText(await file.arrayBuffer()))
              .text
          )
        : parseItrJson(await file.text());
      setFields({ ...BLANK_PAST_FILING_FIELDS, ...parsed.fields });
      setAutoRead(new Set(parsed.readFields));
      setAutoSource(parsed.ok ? (isPdf ? "itr-v" : "itr-json") : null);
      setNotice(parsed.message);
    } catch (error) {
      setAutoSource(null);
      const { PdfPasswordError } = await import("../ingest/pdfExtract");
      if (isPdf && error instanceof PdfPasswordError) {
        setError(
          "This PDF is password-protected. Open it, save/print an unprotected copy, and upload that instead - or enter the figures by hand below."
        );
        return;
      }
      setError(
        isPdf
          ? "Couldn't read this ITR-V automatically. Enter the figures by hand below."
          : "Couldn't read that file. Enter the figures by hand instead."
      );
    }
  }

  function reset() {
    setFields(BLANK_PAST_FILING_FIELDS);
    setAutoRead(new Set());
    setAutoSource(null);
    setNotice(null);
    setError(null);
  }

  function submit() {
    const assessmentYear = normalizeAssessmentYear(fields.assessmentYear);
    if (!assessmentYear) {
      setError("Enter the assessment year, e.g. 2024-25.");
      return;
    }
    onAdd({ ...fields, assessmentYear }, autoRead.size > 0 && autoSource ? autoSource : "manual");
    reset();
  }

  const autoTag = (key: keyof PastFilingFields) =>
    autoRead.has(key) ? <span className="dashboard-autoread"> · read from file</span> : null;

  return (
    <details className="refine-panel dashboard-add" open={startOpen}>
      <summary>
        Add a past year
        <InfoTooltip label="About adding a past year" className="dashboard-add-tip align-right">
          Upload the ITR JSON you downloaded from the income-tax portal, or an ITR-V acknowledgement
          PDF, to prefill these, or just type them in. Whatever a file doesn&apos;t give us, fill in
          by hand below.
        </InfoTooltip>
      </summary>
      <div className="dashboard-add-body">
        <label className="secondary-button dashboard-json-button">
          Prefill From ITR JSON Or ITR-V PDF
          <input
            type="file"
            accept=".json,application/json,.pdf,application/pdf"
            hidden
            onChange={(event) => handleFile(event.target.files)}
          />
        </label>
        {notice ? <p className="dashboard-notice">{notice}</p> : null}

        <div className="dashboard-add-grid">
          <label className="supplemental-field">
            Assessment year{autoTag("assessmentYear")}
            <input
              type="text"
              value={fields.assessmentYear}
              placeholder="2024-25"
              onChange={(event) => set("assessmentYear", event.target.value)}
            />
          </label>
          <label className="supplemental-field">
            ITR form{autoTag("itrForm")}
            <input
              type="text"
              value={fields.itrForm}
              placeholder="ITR-2"
              onChange={(event) => set("itrForm", event.target.value)}
            />
          </label>
          <label className="supplemental-field">
            Regime{autoTag("regime")}
            <select
              value={fields.regime}
              onChange={(event) => set("regime", event.target.value as FilingRegime)}
            >
              {REGIME_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {REGIME_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <label className="supplemental-field">
            Gross total income{autoTag("grossTotalIncome")}
            <input
              type="number"
              min={0}
              value={fields.grossTotalIncome}
              onChange={(event) => set("grossTotalIncome", Number(event.target.value) || 0)}
            />
          </label>
          <label className="supplemental-field">
            Total tax paid{autoTag("totalTaxPaid")}
            <input
              type="number"
              min={0}
              value={fields.totalTaxPaid}
              onChange={(event) => set("totalTaxPaid", Number(event.target.value) || 0)}
            />
          </label>
          <label className="supplemental-field">
            Refund (+) / payable (−){autoTag("refundOrPayable")}
            <input
              type="number"
              value={fields.refundOrPayable}
              onChange={(event) => set("refundOrPayable", Number(event.target.value) || 0)}
            />
          </label>
          <label className="supplemental-field">
            Capital gains (− if a loss){autoTag("capitalGains")}
            <input
              type="number"
              value={fields.capitalGains}
              onChange={(event) => set("capitalGains", Number(event.target.value) || 0)}
            />
          </label>
          <label className="supplemental-field">
            Losses carried forward{autoTag("carryForwardLosses")}
            <input
              type="number"
              min={0}
              value={fields.carryForwardLosses}
              onChange={(event) => set("carryForwardLosses", Number(event.target.value) || 0)}
            />
          </label>
          <label className="supplemental-field">
            Loan principal repaid{autoTag("loanPrincipal")}
            <input
              type="number"
              min={0}
              value={fields.loanPrincipal}
              onChange={(event) => set("loanPrincipal", Number(event.target.value) || 0)}
            />
          </label>
          <label className="supplemental-field">
            Loan interest paid{autoTag("loanInterest")}
            <input
              type="number"
              min={0}
              value={fields.loanInterest}
              onChange={(event) => set("loanInterest", Number(event.target.value) || 0)}
            />
          </label>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="step-actions">
          <button
            type="button"
            className="primary-button dashboard-add-submit"
            onClick={submit}
            aria-label="Add to history"
            title="Add to history"
          >
            <IconPlus />
          </button>
        </div>
      </div>
    </details>
  );
}
