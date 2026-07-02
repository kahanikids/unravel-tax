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
    status: "Current",
    detail: "Rule JSON loading and fixture parity are the next implementation slice."
  }
];

const buildChecks: CheckItem[] = [
  { label: "Backend", value: "None" },
  { label: "Database", value: "None" },
  { label: "Accounts", value: "None" },
  { label: "Required API keys", value: "None" },
  { label: "Validation command", value: "npm run build" }
];

const nextSlices: CheckItem[] = [
  { label: "M4D", value: "Guided UI and reconciliation panel" },
  { label: "M4E", value: "Exports" }
];

const ingestionFormats: CheckItem[] = [
  { label: "CSV", value: "Parsed with PapaParse" },
  { label: "Excel", value: "Parsed with read-excel-file" },
  { label: "HTML", value: "Transaction table selected by expected headers" },
  { label: "Structured text", value: "Tab-separated rows normalized directly" },
  { label: "PDF/free-form", value: "Routed to prompts/01-extract-statement.md" }
];

function App() {
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
            rule, reconciliation, and fixture-ingestion work into one browser flow.
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

      <section className="work-grid" aria-label="Current webapp status">
        <div className="panel ingestion-panel">
          <h2>M4B Ingestion</h2>
          <dl>
            {ingestionFormats.map((item) => (
              <div className="fact-row" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

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

export default App;
