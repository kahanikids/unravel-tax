import type { ConfidenceItem, ConfidenceReport } from "../lib/confidence";

function ConfidenceGroup({ title, items, tone }: { title: string; items: ConfidenceItem[]; tone: string }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={`confidence-group confidence-${tone}`}>
      <h4>
        {title} ({items.length})
      </h4>
      <ul>
        {items.map((item) => (
          <li key={item.label}>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One glanceable check right before export, per the strategist's "missing /
 * may-change / safe-to-ignore" framing. Everything shown here already came
 * up earlier in the flow (checklist, risk triggers, reconciliation, scope
 * caveats); this just regroups it by how urgently it matters before you
 * hand the files off, so nothing gets forgotten between the checklist step
 * and here.
 */
export function ConfidenceReportPanel({ report }: { report: ConfidenceReport }) {
  return (
    <section className="confidence-report" aria-labelledby="confidence-title">
      <h3 id="confidence-title">Before you export</h3>
      {report.ready && report.safeToIgnore.length === 0 ? (
        <p className="reconciliation-clean">Nothing flagged. You're clear to export.</p>
      ) : (
        <>
          <ConfidenceGroup title="Still missing" items={report.missing} tone="missing" />
          <ConfidenceGroup title="May change your numbers" items={report.mayChange} tone="may-change" />
          <ConfidenceGroup title="Flagged, but safe to export as-is" items={report.safeToIgnore} tone="safe" />
        </>
      )}
    </section>
  );
}
