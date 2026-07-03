import { useState } from "react";
import {
  BLANK_PAST_FILING_FIELDS,
  deriveHistoryInsights,
  normalizeAssessmentYear,
  parseItrJson,
  REGIME_LABELS,
  type FilingRegime,
  type FilingSource,
  type PastFiling,
  type PastFilingFields
} from "../lib/pastFilings";
import { CountdownBanner } from "./CountdownBanner";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

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

/** The current in-progress filing, summarized for the "this year" panel.
 * Every figure here is computed deterministically upstream in App - the
 * dashboard only displays it. */
export type ThisYearSnapshot = {
  hasStartedFiling: boolean;
  assessmentYear: string;
  itrForm: string;
  regimeNote: string;
  estimatedCapitalGainsTax: number;
  grossGains: number;
  openIssueCount: number;
};

export function Dashboard({
  thisYear,
  pastFilings,
  onAddPastFiling,
  onRemovePastFiling,
  onGoToFiling,
  showAdvanced,
  onToggleAdvanced
}: {
  thisYear: ThisYearSnapshot;
  pastFilings: PastFiling[];
  onAddPastFiling: (fields: PastFilingFields, source: FilingSource) => void;
  onRemovePastFiling: (id: string) => void;
  onGoToFiling: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}) {
  const insights = deriveHistoryInsights(pastFilings);
  const hasHistory = insights.sorted.length > 0;
  const maxIncome = Math.max(1, ...insights.sorted.map((filing) => filing.grossTotalIncome));
  const maxRate = Math.max(0.01, ...insights.effectiveRates.map((point) => point.rate));

  return (
    <div className="step-card dashboard">
      <div className="panel-heading">
        <div>
          <h2>Your tax dashboard</h2>
          <p className="step-lede">
            This year at a glance, and how your filings compare year over year. History stays in this browser, alongside
            the rest of your filing.
          </p>
        </div>
        <button type="button" className="view-toggle" onClick={onToggleAdvanced}>
          {showAdvanced ? "Show simple view" : "Show full detail"}
        </button>
      </div>

      {/* ---- This year at a glance ---- */}
      <section className="dashboard-section" aria-labelledby="dashboard-this-year">
        <h3 id="dashboard-this-year">{`This year — ${thisYear.assessmentYear}`}</h3>
        {thisYear.hasStartedFiling ? (
          <>
            <div className="dashboard-stat-grid">
              <article className="dashboard-stat">
                <span className="dashboard-stat-label">Open issues to check</span>
                <strong className={thisYear.openIssueCount === 0 ? "dashboard-stat-good" : "dashboard-stat-flag"}>
                  {thisYear.openIssueCount}
                </strong>
                <span className="dashboard-stat-note">
                  {thisYear.openIssueCount === 0 ? "Nothing outstanding right now." : "Missing documents, mismatches, or risk flags."}
                </span>
              </article>
              <article className="dashboard-stat">
                <span className="dashboard-stat-label">Recommended ITR form</span>
                <strong>{thisYear.itrForm}</strong>
                <span className="dashboard-stat-note">{thisYear.regimeNote}</span>
              </article>
              <article className="dashboard-stat">
                <span className="dashboard-stat-label">Gains this year</span>
                <strong>₹{formatAmount(thisYear.grossGains)}</strong>
                <span className="dashboard-stat-note">Short- and long-term capital gains from your documents.</span>
              </article>
              <article className="dashboard-stat">
                <span className="dashboard-stat-label">Estimated capital-gains tax</span>
                <strong>₹{formatAmount(thisYear.estimatedCapitalGainsTax)}</strong>
                <span className="dashboard-stat-note">
                  On equity gains only (Sections 111A/112A). Slab-taxed income depends on your regime.
                </span>
              </article>
            </div>
            <CountdownBanner />
            <button type="button" className="text-button" onClick={onGoToFiling}>
              Go to this year&apos;s results →
            </button>
          </>
        ) : (
          <div className="dashboard-empty">
            <p>You haven&apos;t started this year&apos;s filing yet.</p>
            <button type="button" className="primary-button" onClick={onGoToFiling}>
              Start this year&apos;s filing
            </button>
          </div>
        )}
      </section>

      {/* ---- Year-over-year history ---- */}
      <section className="dashboard-section" aria-labelledby="dashboard-history">
        <h3 id="dashboard-history">Your filing history</h3>

        {hasHistory ? (
          <>
            <div className="dashboard-insight-grid">
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Years on record</span>
                <strong>{insights.yearsCount}</strong>
              </article>
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Income growth (latest year)</span>
                <strong>
                  {insights.incomeGrowthPct === null
                    ? "—"
                    : `${insights.incomeGrowthPct >= 0 ? "+" : ""}${insights.incomeGrowthPct.toLocaleString("en-IN", {
                        maximumFractionDigits: 1
                      })}%`}
                </strong>
                <span className="dashboard-stat-note">Gross total income vs the year before.</span>
              </article>
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Effective tax rate (latest)</span>
                <strong>{insights.latestEffectiveRate === null ? "—" : formatPercent(insights.latestEffectiveRate)}</strong>
                <span className="dashboard-stat-note">Total tax paid ÷ gross total income.</span>
              </article>
              <article className="dashboard-insight">
                <span className="dashboard-stat-label">Regime</span>
                <strong>{insights.regimeSwitched ? "Switched" : insights.regimesUsed[0] ? REGIME_LABELS[insights.regimesUsed[0]] : "Not recorded"}</strong>
                <span className="dashboard-stat-note">
                  {insights.regimeSwitched ? "You've used more than one regime — worth confirming you can still switch." : "Across your recorded years."}
                </span>
              </article>
            </div>

            {/* Dependency-free CSS bars: gross total income per year. */}
            <div className="dashboard-bars" role="img" aria-label="Gross total income by assessment year">
              {insights.sorted.map((filing) => (
                <div className="dashboard-bar-row" key={filing.id}>
                  <span className="dashboard-bar-label">{filing.assessmentYear}</span>
                  <span className="dashboard-bar-track">
                    <span
                      className="dashboard-bar-fill"
                      style={{ width: `${Math.round((filing.grossTotalIncome / maxIncome) * 100)}%` }}
                    />
                  </span>
                  <span className="dashboard-bar-value">₹{formatAmount(filing.grossTotalIncome)}</span>
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
                    const rate = filing.grossTotalIncome > 0 ? filing.totalTaxPaid / filing.grossTotalIncome : 0;
                    return (
                      <tr key={filing.id}>
                        <td data-label="Assessment year">{filing.assessmentYear}</td>
                        <td data-label="ITR form">{filing.itrForm || "—"}</td>
                        <td data-label="Gross total income">₹{formatAmount(filing.grossTotalIncome)}</td>
                        <td data-label="Total tax paid">₹{formatAmount(filing.totalTaxPaid)}</td>
                        <td data-label="Refund / payable">{formatSignedInr(filing.refundOrPayable)}</td>
                        <td data-label="Regime">{REGIME_LABELS[filing.regime]}</td>
                        {showAdvanced ? <td data-label="Effective rate">{formatPercent(rate)}</td> : null}
                        <td data-label="Source">
                          <span className={filing.source === "itr-json" ? "pill pill-ready" : "pill pill-neutral"}>
                            {filing.source === "itr-json" ? "From JSON" : "Entered"}
                          </span>
                        </td>
                        <td data-label="Action">
                          <button type="button" className="text-button" onClick={() => onRemovePastFiling(filing.id)}>
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
              <div className="dashboard-bars" role="img" aria-label="Effective tax rate by assessment year">
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
              Carry-forward capital losses stay usable for 8 assessment years, and only if each year&apos;s return was
              filed on time. Advance tax for {thisYear.assessmentYear} is due in quarterly instalments if your tax after
              TDS will cross ₹10,000 — worth checking early.
            </p>
          </>
        ) : (
          <p className="dashboard-empty-note">
            No past years yet. Add a previous filing below to start seeing your income and tax trends year over year.
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
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PastFilingFields>(key: K, value: PastFilingFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    // A field the user edits by hand is no longer "auto-read from JSON".
    setAutoRead((prev) => {
      if (!prev.has(key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function handleJsonFile(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) {
      return;
    }
    setError(null);
    try {
      const parsed = parseItrJson(await file.text());
      setFields({ ...BLANK_PAST_FILING_FIELDS, ...parsed.fields });
      setAutoRead(new Set(parsed.readFields));
      setNotice(parsed.message);
    } catch {
      setError("Couldn't read that file. Enter the figures by hand instead.");
    }
  }

  function reset() {
    setFields(BLANK_PAST_FILING_FIELDS);
    setAutoRead(new Set());
    setNotice(null);
    setError(null);
  }

  function submit() {
    const assessmentYear = normalizeAssessmentYear(fields.assessmentYear);
    if (!assessmentYear) {
      setError("Enter the assessment year, e.g. 2024-25.");
      return;
    }
    onAdd({ ...fields, assessmentYear }, autoRead.size > 0 ? "itr-json" : "manual");
    reset();
  }

  const autoTag = (key: keyof PastFilingFields) =>
    autoRead.has(key) ? <span className="dashboard-autoread"> · read from JSON</span> : null;

  return (
    <details className="refine-panel dashboard-add" open={startOpen}>
      <summary>Add a past year</summary>
      <div className="dashboard-add-body">
        <p className="step-lede">
          Upload the ITR JSON you downloaded from the income-tax portal to prefill these, or just type them in. PDF
          acknowledgements (ITR-V) aren&apos;t read here — enter those figures by hand.
        </p>

        <label className="secondary-button dashboard-json-button">
          Prefill from ITR JSON
          <input type="file" accept=".json,application/json" hidden onChange={(event) => handleJsonFile(event.target.files)} />
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
            <select value={fields.regime} onChange={(event) => set("regime", event.target.value as FilingRegime)}>
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
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="step-actions">
          <button type="button" className="primary-button" onClick={submit}>
            Add to history
          </button>
        </div>
      </div>
    </details>
  );
}
