import type { ProfileScopeCaveat } from "./profile";
import type { ChecklistGap, FigureMismatch } from "./reconciliation";
import type { RiskTrigger } from "./riskTriggers";

export type ConfidenceItem = { label: string; detail: string };

export type ConfidenceReport = {
  missing: ConfidenceItem[];
  mayChange: ConfidenceItem[];
  safeToIgnore: ConfidenceItem[];
  ready: boolean;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.abs(value));
}

/**
 * A single pre-export "here's what's missing, what might change your
 * numbers, and what's safe to ignore" summary, pulling together checks that
 * otherwise live in separate places (the sidebar checklist, the
 * form-changing popup, the reconciliation panel, the profile scope
 * caveats). Nothing here is new logic: it just groups existing signals by
 * how urgently they matter before you export, so you don't have to
 * remember everything the app flagged earlier in the flow.
 */
export function buildConfidenceReport({
  checklistGaps,
  riskTriggers,
  mismatches,
  scopeCaveats
}: {
  checklistGaps: ChecklistGap[];
  riskTriggers: RiskTrigger[];
  mismatches: FigureMismatch[];
  scopeCaveats: ProfileScopeCaveat[];
}): ConfidenceReport {
  const missing: ConfidenceItem[] = checklistGaps.map((gap) => ({
    label: gap.document,
    detail: gap.whyNeeded
  }));

  const mayChange: ConfidenceItem[] = [
    ...riskTriggers
      .filter((trigger) => trigger.severity === "form-changing")
      .map((trigger) => ({ label: trigger.label, detail: trigger.consequence })),
    ...mismatches.map((mismatch) => ({
      label: `${mismatch.field}: figures don't match`,
      detail: `${mismatch.source}. Calculated ₹${formatAmount(mismatch.expected)}, reported ₹${formatAmount(mismatch.reported)}, a difference of ₹${formatAmount(mismatch.difference)}.`
    }))
  ];

  const safeToIgnore: ConfidenceItem[] = [
    ...riskTriggers
      .filter((trigger) => trigger.severity === "routine")
      .map((trigger) => ({
        label: trigger.label,
        detail: `${trigger.consequence} Worth mentioning to your CA, but it doesn't change your ITR form or block exporting.`
      })),
    ...scopeCaveats.map((caveat) => ({
      label: caveat.label,
      detail: `${caveat.note} Already the reason this profile gets a CA recommendation, so no separate action needed before exporting.`
    }))
  ];

  return {
    missing,
    mayChange,
    safeToIgnore,
    ready: missing.length === 0 && mayChange.length === 0
  };
}
