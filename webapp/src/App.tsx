import { caSummaryRows, summarizeWithRules } from "./lib";
import { parseCsvText } from "./ingest";
import { ruleCatalog, ruleVerificationSummary } from "./rules";

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
    detail: "Checklist state and simple/advanced views are the next implementation slice."
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
  { label: "M4E", value: "Exports" }
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
            rule, reconciliation, ingestion, and calculation work into one browser flow.
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
        <div className="panel calculation-panel">
          <h2>M4C Calculation Ledger</h2>
          <dl>
            {calculationLedger.map((item) => (
              <div className="fact-row" key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="panel ca-summary-panel">
          <h2>CA Summary Parity</h2>
          <dl>
            {calculationRows.slice(0, 5).map((row) => (
              <div className="fact-row" key={row.head}>
                <dt>{row.head}</dt>
                <dd>{typeof row.amount === "number" ? formatAmount(row.amount) : row.amount}</dd>
              </div>
            ))}
          </dl>
        </div>

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

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value);
}

export default App;
