import { useState } from "react";
import { checklistGaps, type ChecklistItem } from "../lib/reconciliation";
import type { RiskTrigger } from "../lib/riskTriggers";
import type { ProfileScopeCaveat } from "../lib/profile";
import { DocumentSourceHint } from "./DocumentSourceHint";

const MOBILE_TABLET_BREAKPOINT = 860;

/**
 * The persistent "things to check" panel (BUILD_PLAN.md Section 4). This
 * runs on every render, not on request, and is meant to be visible from the
 * Checklist step onward - not a screen the user has to remember to visit.
 *
 * On mobile/tablet this panel stacks above the main content (see the
 * max-width: 860px rules in styles.css), so a long list of items can push
 * everything else below the fold. It starts collapsed there - just the
 * heading and open-count pill - and expands on tap. The toggle itself is
 * only shown at that breakpoint (styles.css); on desktop the panel is
 * always fully expanded, same as before.
 */
export function ChecklistPanel({
  checklistItems,
  riskTriggers,
  profileScopeCaveats
}: {
  checklistItems: ChecklistItem[];
  riskTriggers: RiskTrigger[];
  profileScopeCaveats: ProfileScopeCaveat[];
}) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= MOBILE_TABLET_BREAKPOINT
  );
  const gaps = checklistGaps(checklistItems);
  const openCount = gaps.length + riskTriggers.length;

  return (
    <aside className="checklist-panel" aria-labelledby="checklist-title">
      <div className="checklist-panel-heading">
        <h2 id="checklist-title">Things to check</h2>
        <span className={openCount === 0 ? "pill pill-ready" : "pill pill-open"}>
          {openCount === 0 ? "All clear" : `${openCount} open`}
        </span>
        <button
          type="button"
          className="checklist-toggle"
          aria-expanded={!collapsed}
          aria-controls="checklist-panel-body"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? "Show" : "Hide"}
          <svg className="checklist-toggle-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d={collapsed ? "M4 6l4 4 4-4" : "M4 10l4-4 4 4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div id="checklist-panel-body" className={collapsed ? "checklist-panel-body is-collapsed" : "checklist-panel-body"}>
        {profileScopeCaveats.length > 0 ? (
          <div className="checklist-group">
            <h3>Heads up — this tool has limits</h3>
            {profileScopeCaveats.map((caveat) => (
              <article className="checklist-item checklist-item-flag" key={caveat.id}>
                <strong>{caveat.label}</strong>
                <p>{caveat.note}</p>
              </article>
            ))}
          </div>
        ) : null}

        {riskTriggers.length > 0 ? (
          <div className="checklist-group">
            <h3>Check these before filing</h3>
            {riskTriggers.map((trigger) => (
              <article
                key={trigger.id}
                className={trigger.severity === "form-changing" ? "checklist-item checklist-item-flag" : "checklist-item"}
              >
                <strong>{trigger.label}</strong>
                <p>{trigger.consequence}</p>
              </article>
            ))}
          </div>
        ) : null}

        <div className="checklist-group">
          <h3>Still needed</h3>
          {gaps.length === 0 ? (
            <p className="checklist-empty">Nothing outstanding on your document checklist.</p>
          ) : (
            gaps.map((gap) => (
              <article className="checklist-item" key={gap.document}>
                <strong>{gap.document}</strong>
                <p>{gap.whyNeeded}</p>
                <DocumentSourceHint document={gap.document} />
              </article>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
