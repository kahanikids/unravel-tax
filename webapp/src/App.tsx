import { useEffect, useState } from "react";
import {
  buildCaSummaryCsvExport,
  buildCaSummaryWorkbookExport,
  buildFullWorkbookExport,
  downloadExport
} from "./lib";
import {
  calculationSummary,
  calculationLedger,
  calculationRows,
  checksReport,
  checklistItems,
  formatAmount,
  fixtureTransactions,
  ingestionFormats,
  orientationAnswers,
  tdsRows
} from "./demo/sampleState";

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
    status: "Done",
    detail: "Checklist gaps and planted mismatches appear before totals."
  },
  {
    label: "Exports",
    status: "Done",
    detail: "CA Summary and full workbook files generate in the browser."
  }
];

const buildChecks: CheckItem[] = [
  { label: "Backend", value: "None" },
  { label: "Database", value: "None" },
  { label: "Accounts", value: "None" },
  { label: "Required API keys", value: "None" },
  { label: "Validation command", value: "npm run build" }
];

const nextSlices: CheckItem[] = [{ label: "Working plan", value: "All slices complete" }];

function App() {
  const [showAdvanced, setShowAdvanced] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("unravel-tax-view") === "advanced"
  );
  const [exportMessage, setExportMessage] = useState("Exports are generated in this browser.");

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

          <section className="handover-panel" aria-labelledby="handover-title">
            <div>
              <h3 id="handover-title">Exports</h3>
              <p>
                {checksReport.ready
                  ? "Both handover files are ready."
                  : `${checksReport.missingDocuments.length + checksReport.mismatches.length} things are still open. Export anyway, or go back to the checklist.`}
              </p>
            </div>
            <div className="export-actions">
              <button type="button" onClick={() => exportCaSummaryCsv(setExportMessage)}>
                Download CA Summary CSV
              </button>
              <button type="button" onClick={() => exportCaSummaryWorkbook(setExportMessage)}>
                Download CA Summary XLSX
              </button>
              <button type="button" onClick={() => exportFullWorkbook(setExportMessage)}>
                Download full workbook
              </button>
            </div>
            <p className="export-message">{exportMessage}</p>
          </section>

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

async function exportCaSummaryCsv(setExportMessage: (message: string) => void) {
  const file = await buildCaSummaryCsvExport(calculationRows);
  downloadExport(file);
  setExportMessage(`${file.filename} generated in this browser.`);
}

async function exportCaSummaryWorkbook(setExportMessage: (message: string) => void) {
  const file = await buildCaSummaryWorkbookExport(calculationRows);
  downloadExport(file);
  setExportMessage(`${file.filename} generated in this browser.`);
}

async function exportFullWorkbook(setExportMessage: (message: string) => void) {
  const file = await buildFullWorkbookExport({
    caSummaryRows: calculationRows,
    transactions: fixtureTransactions,
    calculationSummary,
    checklistItems,
    tdsRows,
    openIssueCount: checksReport.missingDocuments.length + checksReport.mismatches.length
  });
  downloadExport(file);
  setExportMessage(`${file.filename} generated in this browser.`);
}

export default App;
