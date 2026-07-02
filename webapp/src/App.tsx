import { useEffect, useState } from "react";
import { caSummaryRows, reconciliationReport, summarizeWithRules } from "./lib";
import { parseCsvText } from "./ingest";
import { ruleCatalog, ruleVerificationSummary } from "./rules";
import type { ChecklistItem, TdsRow } from "./lib";

type Milestone = {
  label: string;
  status: "Done" | "Current" | "Next";
  detail: string;
};

type CheckItem = {
  label: string;
  value: string;
};

const milestones: Milestone[] = [
  {
    label: "Template + prompts",
    status: "Done",
    detail: "Guided prompt path, Excel workbook template, and manual dry run."
  },
  {
    label: "Notebook",
    status: "Done",
    detail: "CSV, Excel, HTML, and structured text fixtures produce matching exports."
  },
  {
    label: "Rules + reconciliation",
    status: "Done",
    detail: "Rule JSON pairs and planted reconciliation mismatches validate locally."
  },
  {
    label: "Webapp scaffold",
    status: "Done",
    detail: "Vite React TypeScript shell; static and client-side only."
  },
  {
    label: "Client-side ingestion",
    status: "Done",
    detail: "CSV, Excel, HTML, and structured text normalize to one transaction shape."
  },
  {
    label: "Calculation and rules wiring",
    status: "Done",
    detail: "Rule JSON drives fixture totals and CA Summary parity checks."
  },
  {
    label: "Guided UI and reconciliation panel",
    status: "Current",
    detail: "Checklist gaps and planted mismatches appear before totals."
  }
];

const buildChecks: CheckItem[] = [
  { label: "Backend", value: "None" },
  { label: "Database", value: "None" },
  { label: "Accounts", value: "None" },
  { label: "Required API keys", value: "None" },
  { label: "Validation command", value: "npm run build" }
];

const nextSlices: CheckItem[] = [{ label: "M4E", value: "Exports" }];

const orientationAnswers: CheckItem[] = [
  { label: "Residency", value: "Resident fixture" },
  { label: "Profile flags", value: "No NRI, HUF, senior citizen, or single-parent flag" },
  { label: "Income sources", value: "Capital gains, dividends, bank interest" },
  { label: "Review trigger", value: "Speculative intraday income selects ITR-3" }
];

const ingestionFormats: CheckItem[] = [
  { label: "CSV", value: "Parsed with PapaParse" },
  { label: "Excel", value: "Parsed with read-excel-file" },
  { label: "HTML", value: "Transaction table selected by expected headers" },
  { label: "Structured text", value: "Tab-separated rows normalized directly" },
  { label: "PDF/free-form", value: "Routed to prompts/01-extract-statement.md" }
];

const fixtureCsv = [
  "Scrip Name,Purchase Date,Sell Date,Units,Buy Value,Sell Value,Buy Price,Sell Price",
  "Acme Industries,01-Apr-2025,15-Apr-2025,100,50000,51000,500,510",
  "Acme Industries,10-Jan-2024,20-May-2025,50,25000,27500,500,550",
  "Sample Metals Ltd,05-Jun-2025,05-Jun-2025,200,40000,40800,200,204",
  "Sample Metals Ltd,12-Feb-2023,18-Jun-2025,75,30000,33000,400,440",
  "Test Pharma Co,01-Aug-2025,30-Aug-2025,150,45000,43500,300,290"
].join("\n");

const checklistItems: ChecklistItem[] = [
  {
    document: "Form 16 or pension statement",
    needed: "Yes",
    status: "Loaded",
    whyNeeded: "Salary/pension income"
  },
  {
    document: "AIS / Form 26AS",
    needed: "Yes",
    status: "Needed",
    whyNeeded: "TDS and reported transactions"
  },
  {
    document: "Bank interest certificates",
    needed: "Yes",
    status: "Needed",
    whyNeeded: "Other income and deductions"
  },
  {
    document: "Broker/AMC capital gains statement",
    needed: "Yes",
    status: "Sample loaded",
    whyNeeded: "Capital gains classification"
  },
  {
    document: "Dividend statement",
    needed: "Yes",
    status: "Loaded",
    whyNeeded: "Quarter-wise Schedule OS"
  },
  {
    document: "NRI documents",
    needed: "Profile-dependent",
    status: "Not applicable",
    whyNeeded: "TRC, 10F, NRE/NRO, TDS"
  }
];

const reportedSummary = {
  "Speculative / Intraday income": 800,
  "Short-Term Capital Gains": -450,
  "Long-Term Capital Gains": 5500,
  Dividends: 4000,
  "Interest & other income": 24000,
  "Eligible interest deduction": 0,
  "Deductible transaction charges": 160,
  "Carry-forward losses available": 500
};

const tdsRows: TdsRow[] = [
  { source: "Sample Bank", tdsPerDocument: 1800, tdsPerAis: 1800 },
  { source: "Sample Broker", tdsPerDocument: 1200, tdsPerAis: 900 }
];

const fixtureTransactions = parseCsvText(fixtureCsv).transactions;
const calculationSummary = summarizeWithRules(
  fixtureTransactions,
  ruleCatalog.capitalGainsEquity,
  ruleCatalog.itrFormSelection
);
const calculationRows = caSummaryRows(
  fixtureTransactions,
  ruleCatalog.capitalGainsEquity,
  ruleCatalog.itrFormSelection
);
const expectedFigures = Object.fromEntries(
  calculationRows
    .filter((row) => typeof row.amount === "number")
    .map((row) => [row.head, row.amount as number])
);
const checksReport = reconciliationReport({
  checklistItems,
  expectedFigures,
  reportedFigures: reportedSummary,
  tdsRows
});
const verificationSummary = ruleVerificationSummary([
  ruleCatalog.capitalGainsEquity,
  ruleCatalog.itrFormSelection
]);

const calculationLedger: CheckItem[] = [
  { label: "Rows", value: String(calculationSummary.rows) },
  { label: "Intraday", value: formatAmount(calculationSummary.intradayGain) },
  { label: "STCG", value: formatAmount(calculationSummary.stcg) },
  { label: "LTCG", value: formatAmount(calculationSummary.ltcg) },
  { label: "Recommended form", value: calculationSummary.recommendedItrForm },
  { label: "Rule verification", value: `${verificationSummary.pendingCurrentSource}/${verificationSummary.total} pending` }
];

function App() {
  const [showAdvanced, setShowAdvanced] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("unravel-tax-view") === "advanced"
  );

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("unravel-tax-view", showAdvanced ? "advanced" : "simple");
    }
  }, [showAdvanced]);

  return (
    <main className="app-shell">
      <section className="hero-grid" aria-labelledby="page-title">
        <div className="brand-block">
          <img src="/unravel-tax-mark.svg" alt="Unravel Tax mark" className="brand-mark" />
          <p className="eyebrow">Static Indian tax workflow</p>
          <h1 id="page-title">Unravel Tax</h1>
        </div>
        <div className="hero-copy">
          <p>
            A client-side webapp for turning validated prompt, workbook, notebook,
            rule, reconciliation, ingestion, calculation, and review work into one browser flow.
          </p>
        </div>
      </section>

      <section className="readiness-ledger" aria-label="Milestone readiness ledger">
        {milestones.map((milestone, index) => (
          <article className="ledger-row" key={milestone.label}>
            <span className="ledger-index">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{milestone.label}</h2>
              <p>{milestone.detail}</p>
            </div>
            <span className={`status status-${milestone.status.toLowerCase()}`}>
              {milestone.status}
            </span>
          </article>
        ))}
      </section>

      <section className="workflow-strip" aria-label="Guided workflow">
        {["Orientation", "Checklist", "Ingestion", "Review", "Exports"].map((step, index) => (
          <div className="workflow-step" key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </div>
        ))}
      </section>

      <section className="review-layout" aria-label="Review dashboard">
        <aside className="things-panel" aria-labelledby="things-title">
          <div className="panel-heading">
            <h2 id="things-title">Things To Check</h2>
            <span>{checksReport.ready ? "Ready" : `${checksReport.missingDocuments.length + checksReport.mismatches.length} open`}</span>
          </div>

          <div className="check-group">
            <h3>Missing Documents</h3>
            {checksReport.missingDocuments.map((item) => (
              <article className="check-item" key={item.document}>
                <strong>{item.document}</strong>
                <p>{item.whyNeeded}</p>
              </article>
            ))}
          </div>

          <div className="check-group">
            <h3>Mismatches</h3>
            {checksReport.mismatches.map((item) => (
              <article className="check-item" key={`${item.field}-${item.source}`}>
                <strong>{item.field}</strong>
                <p>
                  Expected {formatAmount(item.expected)}, reported {formatAmount(item.reported)}.
                </p>
              </article>
            ))}
          </div>
        </aside>

        <section className="result-panel" aria-label="Simple and advanced results">
          <div className="panel-heading">
            <h2>{showAdvanced ? "Advanced Detail" : "Simple Summary"}</h2>
            <button className="view-toggle" type="button" onClick={() => setShowAdvanced((value) => !value)}>
              {showAdvanced ? "Show simple view" : "Show full detail"}
            </button>
          </div>

          <div className="simple-summary">
            {calculationRows.slice(0, 5).map((row) => (
              <article className="summary-row" key={row.head}>
                <span>{row.head}</span>
                <strong>{typeof row.amount === "number" ? formatAmount(row.amount) : row.amount}</strong>
              </article>
            ))}
          </div>

          {showAdvanced ? (
            <div className="advanced-grid">
              <div className="panel-inline">
                <h3>Orientation</h3>
                <dl>
                  {orientationAnswers.map((item) => (
                    <div className="fact-row" key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="panel-inline">
                <h3>Calculation Ledger</h3>
                <dl>
                  {calculationLedger.map((item) => (
                    <div className="fact-row" key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="panel-inline">
                <h3>Ingestion</h3>
                <dl>
                  {ingestionFormats.map((item) => (
                    <div className="fact-row" key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          ) : null}
        </section>
      </section>

      <section className="work-grid" aria-label="Project status">
        <div className="panel">
          <h2>Static Constraints</h2>
          <dl>
            {buildChecks.map((item) => (
              <div className="fact-row" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="panel">
          <h2>Next Slices</h2>
          <dl>
            {nextSlices.map((item) => (
              <div className="fact-row" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value);
}

export default App;
