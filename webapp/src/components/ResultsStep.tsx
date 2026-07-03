import type { CaSummaryRow } from "../lib/calculations";
import type { ConfidenceReport } from "../lib/confidence";
import type { CaRecommendation } from "../lib/riskTriggers";
import type { TdsRow } from "../lib/reconciliation";
import type { RegimeChoiceRule } from "../rules";
import type { AisReportedFigures, SupplementalFigures } from "../state/types";
import { ConfidenceReportPanel } from "./ConfidenceReportPanel";
import { ReconciliationPanel } from "./ReconciliationPanel";
import { RegimeComparisonPanel } from "./RegimeComparisonPanel";
import type { UploadedDocument } from "./UploadStep";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const SUPPLEMENTAL_FIELDS: { key: keyof SupplementalFigures; label: string }[] = [
  { key: "dividends", label: "Dividends received this year" },
  { key: "interestOtherIncome", label: "Bank interest & other income" },
  { key: "eligibleInterestDeduction", label: "Eligible interest deduction (80TTA/80TTB)" },
  { key: "deductibleTransactionCharges", label: "Deductible transaction charges" },
  { key: "carryForwardLossesAvailable", label: "Carry-forward losses available" }
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
  regimeChoiceRule,
  aisFigures,
  onChangeAisFigures,
  tdsRows,
  onChangeTdsRows,
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
  regimeChoiceRule: RegimeChoiceRule;
  aisFigures: AisReportedFigures;
  onChangeAisFigures: (figures: AisReportedFigures) => void;
  tdsRows: TdsRow[];
  onChangeTdsRows: (rows: TdsRow[]) => void;
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

      <section className="supplemental-form">
        <h3>A few more numbers</h3>
        <p className="step-lede">
          These don't come from an uploaded document. Enter them yourself, or leave at zero to skip.
        </p>
        <div className="supplemental-grid">
          {SUPPLEMENTAL_FIELDS.map((field) => (
            <label key={field.key} className="supplemental-field">
              {field.label}
              <input
                type="number"
                min={0}
                value={supplementalFigures[field.key]}
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

      <RegimeComparisonPanel
        supplementalFigures={supplementalFigures}
        onChangeSupplementalFigures={onChangeSupplementalFigures}
        debtMfShortTermDeemedGain={debtMfShortTermDeemedGain}
        intradayGain={intradayGain}
        seniorCitizen={seniorCitizen}
        rule={regimeChoiceRule}
      />

      <ReconciliationPanel
        calculatedDividends={supplementalFigures.dividends}
        calculatedInterestOtherIncome={supplementalFigures.interestOtherIncome}
        aisFigures={aisFigures}
        onChangeAisFigures={onChangeAisFigures}
        tdsRows={tdsRows}
        onChangeTdsRows={onChangeTdsRows}
      />

      <section className="result-summary">
        <div className="panel-heading">
          <h3>{showAdvanced ? "Full detail" : "Summary"}</h3>
          <button type="button" className="view-toggle" onClick={onToggleAdvanced}>
            {showAdvanced ? "Show simple view" : "Show full detail"}
          </button>
        </div>

        <div className="summary-rows">
          {(showAdvanced ? rows : rows.slice(0, 5)).map((row) => (
            <article className="summary-row" key={row.head}>
              <div className="summary-row-main">
                <span>{row.head}</span>
                <strong>{typeof row.amount === "number" ? formatAmount(row.amount) : row.amount}</strong>
              </div>
              {row.notes ? (
                <details className="summary-row-why">
                  <summary>Why this number?</summary>
                  <p>{row.notes}</p>
                </details>
              ) : null}
            </article>
          ))}
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
          </div>
        ) : null}
      </section>

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
        <div className="export-actions">
          <button type="button" onClick={onExportCsv}>
            {localFolderName ? "Save CA Summary CSV" : "Download CA Summary CSV"}
          </button>
          <button type="button" onClick={onExportXlsx}>
            {localFolderName ? "Save CA Summary XLSX" : "Download CA Summary XLSX"}
          </button>
          <button type="button" onClick={onExportFullWorkbook}>
            {localFolderName ? "Save full workbook" : "Download full workbook"}
          </button>
        </div>
        {localFolderSupported ? (
          <p className="folder-status">
            {localFolderName ? (
              <>Saving to <strong>{localFolderName}</strong> on your computer instead of your Downloads folder.</>
            ) : (
              <button type="button" className="text-button" onClick={onChooseLocalFolder}>
                Save these to a folder on your computer instead of downloading each one
              </button>
            )}
          </p>
        ) : null}
        <p className="export-message">{exportMessage}</p>
      </section>

      <p className="closing-note">
        Once you've filed, keep the full workbook, not this chat or session. It's the record you'll want next year,
        especially for carrying forward any losses. The CA Summary file is the one to hand off for review.
      </p>
    </div>
  );
}
