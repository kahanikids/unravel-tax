import { figureMismatches, tdsMismatches, type TdsRow } from "../lib/reconciliation";
import type { AisReportedFigures } from "../state/types";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/**
 * BUILD_PLAN.md Section 4: the reconciliation engine runs on every dashboard
 * view, not only on request. This is the manual half of that: we can't fetch
 * a user's AIS/Form 26AS/Form 16 for them, but once they type in what those
 * documents say, every mismatch shows up here immediately, no button to
 * press. Entirely optional: leaving every field blank is a valid, supported
 * state, and never blocks an export.
 */
export function ReconciliationPanel({
  calculatedDividends,
  calculatedInterestOtherIncome,
  aisFigures,
  onChangeAisFigures,
  tdsRows,
  onChangeTdsRows
}: {
  calculatedDividends: number;
  calculatedInterestOtherIncome: number;
  aisFigures: AisReportedFigures;
  onChangeAisFigures: (figures: AisReportedFigures) => void;
  tdsRows: TdsRow[];
  onChangeTdsRows: (rows: TdsRow[]) => void;
}) {
  const expectedFigures: Record<string, number> = {};
  const reportedFigures: Record<string, number> = {};
  if (aisFigures.dividends !== null) {
    expectedFigures.Dividends = calculatedDividends;
    reportedFigures.Dividends = aisFigures.dividends;
  }
  if (aisFigures.interestOtherIncome !== null) {
    expectedFigures["Interest & other income"] = calculatedInterestOtherIncome;
    reportedFigures["Interest & other income"] = aisFigures.interestOtherIncome;
  }

  const mismatches = [
    ...figureMismatches(expectedFigures, reportedFigures, "AIS/Form 26AS"),
    ...tdsMismatches(tdsRows)
  ];
  const nothingEnteredYet = aisFigures.dividends === null && aisFigures.interestOtherIncome === null && tdsRows.length === 0;

  function updateTdsRow(index: number, patch: Partial<TdsRow>) {
    onChangeTdsRows(tdsRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeTdsRow(index: number) {
    onChangeTdsRows(tdsRows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <section className="reconciliation-panel">
      <h3>Check against your AIS, Form 26AS, or Form 16</h3>
      <p className="step-lede">
        Optional, and never required to export. Enter what those documents say. Anything that doesn't match what we
        calculated shows up below right away.
      </p>

      <div className="supplemental-grid">
        <label className="supplemental-field">
          Dividends per AIS/Form 26AS
          <input
            type="number"
            value={aisFigures.dividends ?? ""}
            placeholder="Not entered yet"
            onChange={(event) =>
              onChangeAisFigures({
                ...aisFigures,
                dividends: event.target.value === "" ? null : Number(event.target.value)
              })
            }
          />
        </label>
        <label className="supplemental-field">
          Interest & other income per AIS/Form 26AS
          <input
            type="number"
            value={aisFigures.interestOtherIncome ?? ""}
            placeholder="Not entered yet"
            onChange={(event) =>
              onChangeAisFigures({
                ...aisFigures,
                interestOtherIncome: event.target.value === "" ? null : Number(event.target.value)
              })
            }
          />
        </label>
      </div>

      <div className="tds-rows">
        <h4>TDS: document vs AIS/26AS</h4>
        {tdsRows.length === 0 ? (
          <p className="checklist-empty">No TDS rows added yet.</p>
        ) : (
          tdsRows.map((row, index) => (
            <div className="tds-row" key={index}>
              <input
                type="text"
                value={row.source}
                placeholder="Source (employer, bank, broker)"
                onChange={(event) => updateTdsRow(index, { source: event.target.value })}
              />
              <input
                type="number"
                value={row.tdsPerDocument}
                placeholder="TDS per document"
                onChange={(event) => updateTdsRow(index, { tdsPerDocument: Number(event.target.value) || 0 })}
              />
              <input
                type="number"
                value={row.tdsPerAis}
                placeholder="TDS per AIS/26AS"
                onChange={(event) => updateTdsRow(index, { tdsPerAis: Number(event.target.value) || 0 })}
              />
              <button type="button" className="text-button" onClick={() => removeTdsRow(index)}>
                Remove
              </button>
            </div>
          ))
        )}
        <button
          type="button"
          className="text-button"
          onClick={() => onChangeTdsRows([...tdsRows, { source: "", tdsPerDocument: 0, tdsPerAis: 0 }])}
        >
          + Add A TDS Row
        </button>
      </div>

      <div className="reconciliation-status">
        {nothingEnteredYet ? (
          <p className="checklist-empty">Add a figure or a TDS row above to check for mismatches.</p>
        ) : mismatches.length === 0 ? (
          <p className="reconciliation-clean">Everything you've entered matches. No mismatches found.</p>
        ) : (
          <ul className="mismatch-list">
            {mismatches.map((mismatch, index) => (
              <li key={`${mismatch.field}-${index}`}>
                <strong>{mismatch.field}</strong>
                <p>
                  {mismatch.source}: calculated ₹{formatAmount(mismatch.expected)}, but shows ₹
                  {formatAmount(mismatch.reported)}. Difference: ₹{formatAmount(Math.abs(mismatch.difference))}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
