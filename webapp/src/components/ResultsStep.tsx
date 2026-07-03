import type { BrokerGainCheck, CaSummaryRow } from "../lib/calculations";
import type { ConfidenceReport } from "../lib/confidence";
import type { CaRecommendation } from "../lib/riskTriggers";
import type { TdsRow } from "../lib/reconciliation";
import { computeLoanDeductions } from "../lib/loanDeductions";
import { ruleCatalog, type AdvanceTaxRule, type LoanTreatmentRule, type RegimeChoiceRule } from "../rules";
import type { AisReportedFigures, SupplementalFigures } from "../state/types";
import { AdvanceTaxPanel } from "./AdvanceTaxPanel";
import { RuleSourceLink } from "./RuleSourceLink";
import { ConfidenceReportPanel } from "./ConfidenceReportPanel";
import { LoanDeductionsPanel } from "./LoanDeductionsPanel";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { RegimeComparisonPanel } from "./RegimeComparisonPanel";
import type { UploadedDocument } from "./UploadStep";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/** Rows whose "why this number?" explanation is grounded in a rule with a
 * linkable source. Keeps the source link on genuine claims (ITR-form choice,
 * capital-gains treatment) rather than every summary row. */
const CAPITAL_GAINS_RULE_SECTIONS = new Set(["Business income", "111A", "112A", "50AA"]);

function sourceRefsForRow(row: CaSummaryRow): readonly string[] | null {
  if (row.head === "Recommended ITR form") {
    return ruleCatalog.itrFormSelection.source_refs;
  }
  if (CAPITAL_GAINS_RULE_SECTIONS.has(row.ruleSection)) {
    return ruleCatalog.capitalGainsEquity.source_refs;
  }
  return null;
}

const SUPPLEMENTAL_FIELDS: { key: keyof SupplementalFigures; label: string }[] = [
  { key: "dividends", label: "Dividends received this year" },
  { key: "interestOtherIncome", label: "Bank interest & other income" },
  { key: "eligibleInterestDeduction", label: "Interest deduction (savings/FD — Section 80TTA/B)" },
  { key: "deductibleTransactionCharges", label: "Brokerage/STT charges you can deduct" },
  { key: "carryForwardLossesAvailable", label: "Losses you're carrying forward from a previous year" }
];

/** NRI only: kept out of the general list above so it only shows for that profile. */
const NRI_SUPPLEMENTAL_FIELDS: { key: keyof SupplementalFigures; label: string }[] = [
  { key: "nreExemptInterest", label: "NRE interest (exempt, keep out of the field above)" }
];

/** Single parent/guardian only: kept out of the general list above so it only shows for that profile. */
const SINGLE_PARENT_SUPPLEMENTAL_FIELDS: { key: keyof SupplementalFigures; label: string }[] = [
  { key: "minorIncomeToClub", label: "Minor's income to club (before the per-child exemption)" },
  { key: "numberOfMinors", label: "Number of minor children with this income" }
];

export function ResultsStep({
  rows,
  documents,
  openIssueCount,
  caRecommendation,
  supplementalFigures,
  onChangeSupplementalFigures,
  debtMfShortTermDeemedGain,
  intradayGain,
  seniorCitizen,
  nri = false,
  huf = false,
  singleParent = false,
  hasLoans = false,
  regimeChoiceRule,
  loanTreatmentRule = ruleCatalog.loanTreatment,
  advanceTaxRule,
  aisFigures,
  onChangeAisFigures,
  tdsRows,
  onChangeTdsRows,
  brokerCheck,
  confidenceReport,
  showAdvanced,
  onToggleAdvanced,
  exportMessage,
  onExportCsv,
  onExportXlsx,
  onExportFullWorkbook,
  localFolderSupported,
  localFolderName,
  onChooseLocalFolder
}: {
  rows: CaSummaryRow[];
  documents: UploadedDocument[];
  openIssueCount: number;
  caRecommendation: CaRecommendation;
  supplementalFigures: SupplementalFigures;
  onChangeSupplementalFigures: (figures: SupplementalFigures) => void;
  debtMfShortTermDeemedGain: number;
  intradayGain: number;
  seniorCitizen: boolean;
  nri?: boolean;
  huf?: boolean;
  singleParent?: boolean;
  hasLoans?: boolean;
  regimeChoiceRule: RegimeChoiceRule;
  loanTreatmentRule?: LoanTreatmentRule;
  advanceTaxRule: AdvanceTaxRule;
  aisFigures: AisReportedFigures;
  onChangeAisFigures: (figures: AisReportedFigures) => void;
  tdsRows: TdsRow[];
  onChangeTdsRows: (rows: TdsRow[]) => void;
  brokerCheck: BrokerGainCheck | null;
  confidenceReport: ConfidenceReport;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  exportMessage: string;
  onExportCsv: () => void;
  onExportXlsx: () => void;
  onExportFullWorkbook: () => void;
  localFolderSupported: boolean;
  localFolderName: string | null;
  onChooseLocalFolder: () => void;
}) {
  return (
    <div className="step-card">
      <div className={caRecommendation.recommendCa ? "recommendation-banner recommendation-ca" : "recommendation-banner"}>
        <h2>{caRecommendation.headline}</h2>
        <p>{caRecommendation.reason}</p>
      </div>

      <section className="result-summary">
        <div className="panel-heading">
          <h3>{showAdvanced ? "Full detail" : "Summary"}</h3>
          <button type="button" className="view-toggle" onClick={onToggleAdvanced}>
            {showAdvanced ? "Show simple view" : "Show full detail"}
          </button>
        </div>

        <div className="summary-rows">
          {/* Simple view: the five income heads. The sale/cost totals rows
              (ruleSection "Totals") are supporting detail, shown in full view. */}
          {(showAdvanced ? rows : rows.filter((row) => row.ruleSection !== "Totals").slice(0, 5)).map((row) => {
            const sourceRefs = sourceRefsForRow(row);
            return (
              <article className="summary-row" key={row.head}>
                <div className="summary-row-main">
                  <span>{row.head}</span>
                  <strong>{typeof row.amount === "number" ? formatAmount(row.amount) : row.amount}</strong>
                </div>
                {row.notes ? (
                  <details className="summary-row-why">
                    <summary>Why this number?</summary>
                    <p>{row.notes}</p>
                    {sourceRefs ? <RuleSourceLink refs={sourceRefs} /> : null}
                  </details>
                ) : null}
              </article>
            );
          })}
        </div>

        {showAdvanced ? (
          <div className="advanced-grid">
            <div className="panel-inline">
              <h4>Documents added</h4>
              {documents.length === 0 ? (
                <p className="checklist-empty">No documents added yet.</p>
              ) : (
                <dl>
                  {documents.map((document, index) => (
                    <div className="fact-row" key={`${document.fileName}-${index}`}>
                      <dt>{document.fileName}</dt>
                      <dd>{document.rowCount} rows</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            <div className="panel-inline">
              <h4>Check against your broker's own figures</h4>
              {brokerCheck ? (
                <>
                  <p className="broker-check-lede">
                    Your statement has its own "{brokerCheck.columnName}" column. Computed gain (sale − cost) vs that
                    column, per bucket:
                  </p>
                  <dl>
                    {brokerCheck.perClass
                      .filter((entry) => entry.computed !== 0 || entry.broker !== 0)
                      .map((entry) => {
                        const matches = Math.abs(entry.computed - entry.broker) <= 1;
                        return (
                          <div className="fact-row" key={entry.label}>
                            <dt>{entry.label}</dt>
                            <dd className={matches ? "broker-check-match" : "broker-check-mismatch"}>
                              {formatAmount(entry.computed)} vs {formatAmount(entry.broker)} {matches ? "✓" : "✗"}
                            </dd>
                          </div>
                        );
                      })}
                  </dl>
                  <p className="broker-check-note">
                    A difference usually means the broker netted charges we kept gross. Mismatches are also counted in
                    the open-issues total above.
                  </p>
                </>
              ) : (
                <p className="checklist-empty">
                  No document carried its own gain/taxable column, so there's no broker figure to check against.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <details className="refine-panel">
        <summary>Add more numbers to refine (optional)</summary>
        <details className="refine-section" open>
          <summary>Income you type in</summary>
          <section className="supplemental-form">
          <p className="step-lede">
            These don't come from an uploaded document. Enter them yourself, or leave at zero to skip.
          </p>
          <div className="supplemental-grid">
            {[
              ...SUPPLEMENTAL_FIELDS,
              ...(nri ? NRI_SUPPLEMENTAL_FIELDS : []),
              ...(singleParent ? SINGLE_PARENT_SUPPLEMENTAL_FIELDS : [])
            ].map((field) => (
              <label key={field.key} className="supplemental-field">
                {field.label}
                <input
                  type="number"
                  min={0}
                  value={supplementalFigures[field.key]}
                  placeholder="₹0"
                  onChange={(event) =>
                    onChangeSupplementalFigures({
                      ...supplementalFigures,
                      [field.key]: Number(event.target.value) || 0
                    })
                  }
                />
              </label>
            ))}
          </div>
          </section>
        </details>

        {hasLoans ? (
          <details className="refine-section" open>
            <summary>Loans (home, education, electric vehicle)</summary>
            <LoanDeductionsPanel
              supplementalFigures={supplementalFigures}
              onChangeSupplementalFigures={onChangeSupplementalFigures}
              rule={loanTreatmentRule}
            />
          </details>
        ) : null}

        <details className="refine-section">
          <summary>Old vs new regime</summary>
          {huf ? (
            <section className="regime-panel">
            <p className="step-lede">
              This comparison assumes salary income and a standard deduction, neither of which apply to an HUF return,
              and it doesn't allow for the missing Section 87A rebate either. Skip it here and get slab-tax figures
              from a CA instead.
            </p>
            </section>
          ) : (
            <RegimeComparisonPanel
              supplementalFigures={supplementalFigures}
              onChangeSupplementalFigures={onChangeSupplementalFigures}
              debtMfShortTermDeemedGain={debtMfShortTermDeemedGain}
              intradayGain={intradayGain}
              seniorCitizen={seniorCitizen}
              loanDeductionsTotal={computeLoanDeductions(supplementalFigures, loanTreatmentRule).total}
              rule={regimeChoiceRule}
            />
          )}
        </details>

        <details className="refine-section">
          <summary>Advance tax</summary>
          <AdvanceTaxPanel
            supplementalFigures={supplementalFigures}
            onChangeSupplementalFigures={onChangeSupplementalFigures}
            seniorCitizen={seniorCitizen}
            hasBusinessOrSpeculativeIncome={intradayGain > 0}
            rule={advanceTaxRule}
          />
        </details>

        <details className="refine-section">
          <summary>AIS/TDS check</summary>
          <ReconciliationPanel
            calculatedDividends={supplementalFigures.dividends}
            calculatedInterestOtherIncome={supplementalFigures.interestOtherIncome}
            aisFigures={aisFigures}
            onChangeAisFigures={onChangeAisFigures}
            tdsRows={tdsRows}
            onChangeTdsRows={onChangeTdsRows}
          />
        </details>
      </details>

      <ConfidenceReportPanel report={confidenceReport} />

      <section className="handover-panel" aria-labelledby="handover-title">
        <div>
          <h3 id="handover-title">Your files</h3>
          <p>
            {openIssueCount === 0
              ? "Both handover files are ready."
              : `${openIssueCount} thing${openIssueCount === 1 ? "" : "s"} still open. Export anyway, or go back and check.`}
          </p>
        </div>
        <p className="closing-note">
          Give the CA Summary to your CA. Keep the full workbook for your own records, especially for carrying forward
          any losses next year.
        </p>
        <div className="export-actions">
          <button
            type="button"
            className="primary-button"
            onClick={onExportXlsx}
            aria-label={localFolderName ? undefined : "Download CA Summary XLSX"}
          >
            {localFolderName ? "Save CA Summary XLSX" : <><DownloadIcon /> CA Summary XLSX</>}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onExportFullWorkbook}
            aria-label={localFolderName ? undefined : "Download full workbook"}
          >
            {localFolderName ? "Save full workbook" : <><DownloadIcon /> full workbook</>}
          </button>
          <details className="other-format">
            <summary>Other format</summary>
            <button
              type="button"
              className="text-button"
              onClick={onExportCsv}
              aria-label={localFolderName ? undefined : "Download CA Summary CSV"}
            >
              {localFolderName ? "Save CA Summary CSV" : <><DownloadIcon /> CA Summary CSV</>}
            </button>
          </details>
        </div>
        {localFolderSupported ? (
          <p className="folder-status">
            {localFolderName ? (
              <>Saving to <strong>{localFolderName}</strong> on your computer instead of your Downloads folder.</>
            ) : (
              <button type="button" className="text-button" onClick={onChooseLocalFolder}>
                Alternate Option: Save to Local Folder
              </button>
            )}
          </p>
        ) : null}
        <p className={exportMessage.startsWith("✓") ? "export-message export-message-success" : "export-message"}>
          {exportMessage}
        </p>
      </section>
    </div>
  );
}
