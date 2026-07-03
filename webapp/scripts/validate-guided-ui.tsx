import { renderToString } from "react-dom/server";
import App from "../src/App";
import { ChecklistPanel } from "../src/components/ChecklistPanel";
import { OrientationForm } from "../src/components/OrientationForm";
import { ResultsStep } from "../src/components/ResultsStep";
import { HelpPanel } from "../src/components/HelpPanel";
import { CapabilitiesPanel } from "../src/components/CapabilitiesPanel";
import { BLANK_AIS_REPORTED_FIGURES, BLANK_ORIENTATION, BLANK_SUPPLEMENTAL_FIGURES } from "../src/state/types";
import { CAPABILITIES, DISCLAIMER_FULL, HOW_IT_WORKS, SCOPE_YEAR_NOTE, WHO_ITS_FOR, WHO_ITS_FOR_EXCLUDES } from "../src/lib/copy";
import type { CaSummaryRow } from "../src/lib/calculations";
import type { ConfidenceReport } from "../src/lib/confidence";
import type { CaRecommendation } from "../src/lib/riskTriggers";

const SAMPLE_ROWS: CaSummaryRow[] = [
  { head: "Short-Term Capital Gains", ruleSection: "111A", amount: -500, notes: "" },
  { head: "Long-Term Capital Gains", ruleSection: "112A", amount: 5500, notes: "" },
  { head: "Recommended ITR form", ruleSection: "", amount: "ITR-3", notes: "" },
  { head: "CA review recommendation", ruleSection: "", amount: "Get a CA to review this before filing", notes: "" }
];

const SAMPLE_RECOMMENDATION: CaRecommendation = {
  recommendCa: true,
  headline: "Get a CA to review this before filing",
  reason: "Speculative income detected."
};

const SAMPLE_CONFIDENCE_REPORT: ConfidenceReport = {
  missing: [],
  mayChange: [],
  safeToIgnore: [],
  ready: true
};

function noop() {
  return undefined;
}

function checkWelcomeScreen() {
  const html = renderToString(<App />);

  assertIncludes(html, "Get started");
  assertIncludes(html, "See with Sample Data");
  assertIncludes(html, "This organizes your numbers");
  assertIncludes(html, "Unravel Tax");
  assertIncludes(html, SCOPE_YEAR_NOTE);

  for (const jargon of ["Milestone readiness", "Static Constraints", "Next Slices", "M4E", "Working plan"]) {
    if (html.includes(jargon)) {
      throw new Error(`End-user welcome screen must not contain developer/milestone jargon: "${jargon}"`);
    }
  }

  assertIncludes(html, 'aria-label="How this works');
  if (html.includes("Who it's for") || html.includes(DISCLAIMER_FULL.slice(0, 20))) {
    throw new Error("Help panel content should be closed by default, not present in the initial render.");
  }

  // The capabilities preview must be reachable from welcome, since that's
  // exactly when a skeptical first-time user wants to check scope before
  // entering anything. One trigger only, in the welcome card's corner, not
  // duplicated in the persistent header - closed by default, same as HelpPanel.
  assertIncludes(html, "What can this do?");
  assertIncludes(html, 'class="welcome-card-header"');
  assertIncludes(html, 'class="text-button welcome-capabilities-trigger"');
  if (html.includes("Available now") || html.includes(CAPABILITIES[0].detail.slice(0, 20))) {
    throw new Error("Capabilities panel content should be closed by default, not present in the initial render.");
  }
  if (html.includes('class="text-button capabilities-button"')) {
    throw new Error("The header should no longer have its own 'What can this do?' trigger; the welcome card owns it.");
  }

  // The step nav shows on every screen, including welcome - as an inert
  // preview there (nothing's been reached yet), never a way to skip ahead.
  assertIncludes(html, 'class="progress-steps"');
  assertIncludes(html, "About you");
  if (html.includes('<button type="button" class="progress-step')) {
    throw new Error("No step should be a clickable button before the user has reached any of them.");
  }

  // "Start over" only makes sense once there's something to reset; it sits
  // right next to the step nav (the app's closest equivalent to a "back"
  // control) and stays hidden on the welcome screen itself.
  if (html.includes("Start over")) {
    throw new Error("'Start over' should not render on the welcome screen, where there's nothing to reset yet.");
  }

  console.log("Validated welcome screen: single clear next action, no dev/milestone jargon leaking into the UI.");
}

function checkHelpPanel() {
  const html = renderToString(<HelpPanel />);
  assertIncludes(html, 'aria-label="How this works');

  if (HOW_IT_WORKS.length === 0 || HOW_IT_WORKS.some((step) => !step.title.trim() || !step.detail.trim())) {
    throw new Error("Every How It Works step needs a non-empty title and detail.");
  }
  if (WHO_ITS_FOR.length === 0 || WHO_ITS_FOR.some((reason) => !reason.trim())) {
    throw new Error("Every 'Who it's for' reason needs to be non-empty.");
  }
  for (const term of ["business", "bookkeeping"]) {
    if (!WHO_ITS_FOR_EXCLUDES.includes(term)) {
      throw new Error(`"Who it's for" exclusion copy should mention "${term}".`);
    }
  }
  for (const term of ["Chartered Accountant", "browser"]) {
    if (!DISCLAIMER_FULL.includes(term)) {
      throw new Error(`Full disclaimer copy should mention "${term}".`);
    }
  }

  console.log("Validated help panel: closed by default, How It Works/Who It's For/disclaimer copy all present.");
}

function checkCapabilitiesPanel() {
  const closedHtml = renderToString(<CapabilitiesPanel open={false} onClose={noop} />);
  if (closedHtml.trim().length > 0) {
    throw new Error("Capabilities panel should render nothing when closed.");
  }

  const html = renderToString(<CapabilitiesPanel open onClose={noop} />);
  assertIncludes(html, "What this tool can do");
  assertIncludes(html, "Available now");
  assertIncludes(html, "Planned, not yet available");

  if (CAPABILITIES.length === 0) {
    throw new Error("Capabilities list should not be empty.");
  }
  for (const capability of CAPABILITIES) {
    if (!capability.label.trim() || !capability.detail.trim()) {
      throw new Error("Every capability needs a non-empty label and detail.");
    }
  }
  if (!CAPABILITIES.some((capability) => capability.status === "available")) {
    throw new Error("Capabilities list should include at least one shipped ('available') entry.");
  }
  if (!CAPABILITIES.some((capability) => capability.status === "planned")) {
    throw new Error(
      "Capabilities list should include at least one 'planned' entry - this panel exists to show honest scope, not just what's shipped."
    );
  }

  console.log(
    `Validated capabilities panel: reachable via button, ${CAPABILITIES.length} entries, both available and planned statuses present.`
  );
}

function checkOrientationForm() {
  const html = renderToString(
    <OrientationForm answers={BLANK_ORIENTATION} onChange={noop as never} onComplete={noop} />
  );
  assertIncludes(html, "Question 1 of");
  assertIncludes(html, "Are you living in India right now");
  if (html.includes("Skip this question")) {
    throw new Error("Residency decides the whole checklist/rules branch and should not be skippable.");
  }

  // A yes-no question with a safe null-means-No default (deriveProfileFlags)
  // should offer Skip, visually secondary to Yes/No.
  const hufHtml = renderToString(
    <OrientationForm
      answers={{ ...BLANK_ORIENTATION, residency: "resident" }}
      onChange={noop as never}
      onComplete={noop}
    />
  );
  assertIncludes(hufHtml, "Is any of this income or investment held through a family");
  assertIncludes(hufHtml, "Skip this question");

  console.log("Validated orientation flow: renders one question at a time, starting with residency, with Skip offered only where it's safe.");
}

function checkChecklistPanel() {
  const html = renderToString(
    <ChecklistPanel
      checklistItems={[
        { document: "Broker/AMC capital gains statement", needed: "Yes", status: "Needed", whyNeeded: "Needed to classify gains." }
      ]}
      riskTriggers={[
        {
          id: "business_income_itr_form",
          label: "Speculative/intraday trading income in your documents",
          consequence: "Moves your filing to ITR-3.",
          severity: "form-changing"
        }
      ]}
      profileScopeCaveats={[
        {
          id: "nri_scope",
          label: "NRI-specific numbers aren't calculated here yet",
          note: "Bring TDS certificates and Form 26AS to a CA."
        }
      ]}
    />
  );
  assertIncludes(html, "Things to check");
  assertIncludes(html, "Broker/AMC capital gains statement");
  assertIncludes(html, "Speculative/intraday trading income");
  assertIncludes(html, "checklist-item-flag");
  assertIncludes(html, "Known limits for your profile");
  assertIncludes(html, "NRI-specific numbers");
  console.log(
    "Validated checklist panel: missing documents, form-changing risk triggers, and profile-scope caveats all render, flagged visually."
  );
}

function checkResultsStepDefaultsToSimple() {
  const html = renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={2}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      onChangeSupplementalFigures={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      confidenceReport={SAMPLE_CONFIDENCE_REPORT}
      showAdvanced={false}
      onToggleAdvanced={noop}
      exportMessage="Exports are generated in this browser."
      onExportCsv={noop}
      onExportXlsx={noop}
      onExportFullWorkbook={noop}
      localFolderSupported={false}
      localFolderName={null}
      onChooseLocalFolder={noop}
    />
  );

  assertIncludes(html, "Get a CA to review this before filing");
  assertIncludes(html, "Show full detail");
  assertIncludes(html, "Download CA Summary CSV");
  assertIncludes(html, "Download full workbook");

  if (html.includes("Show simple view")) {
    throw new Error("First-time default view should be simple; advanced detail must require the explicit toggle.");
  }

  console.log("Validated results step: simple view is the default, recommendation and exports both present.");
}

function checkResultsStepAdvancedToggle() {
  const html = renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[{ fileName: "sample.csv", rowCount: 5 }]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      onChangeSupplementalFigures={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      confidenceReport={SAMPLE_CONFIDENCE_REPORT}
      showAdvanced
      onToggleAdvanced={noop}
      exportMessage=""
      onExportCsv={noop}
      onExportXlsx={noop}
      onExportFullWorkbook={noop}
      localFolderSupported={false}
      localFolderName={null}
      onChooseLocalFolder={noop}
    />
  );
  assertIncludes(html, "Show simple view");
  assertIncludes(html, "sample.csv");
  console.log("Validated results step: advanced toggle reveals full detail and the documents ledger.");
}

function resultsStepWithReconciliation(props: {
  aisFigures: { dividends: number | null; interestOtherIncome: number | null };
  tdsRows: { source: string; tdsPerDocument: number; tdsPerAis: number }[];
  supplementalFigures?: typeof BLANK_SUPPLEMENTAL_FIGURES;
}) {
  return renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={props.supplementalFigures ?? BLANK_SUPPLEMENTAL_FIGURES}
      onChangeSupplementalFigures={noop}
      aisFigures={props.aisFigures}
      onChangeAisFigures={noop}
      tdsRows={props.tdsRows}
      onChangeTdsRows={noop}
      confidenceReport={SAMPLE_CONFIDENCE_REPORT}
      showAdvanced={false}
      onToggleAdvanced={noop}
      exportMessage=""
      onExportCsv={noop}
      onExportXlsx={noop}
      onExportFullWorkbook={noop}
      localFolderSupported={false}
      localFolderName={null}
      onChooseLocalFolder={noop}
    />
  );
}

function checkReconciliationPanel() {
  const emptyHtml = resultsStepWithReconciliation({
    aisFigures: { dividends: null, interestOtherIncome: null },
    tdsRows: []
  });
  assertIncludes(emptyHtml, "Check against your AIS, Form 26AS, or Form 16");
  assertIncludes(emptyHtml, "Add a figure or a TDS row above to check for mismatches.");
  if (emptyHtml.includes("No mismatches found")) {
    throw new Error("Reconciliation panel should not claim a clean match before anything is entered.");
  }

  const matchedHtml = resultsStepWithReconciliation({
    aisFigures: { dividends: 0, interestOtherIncome: 0 },
    tdsRows: []
  });
  assertIncludes(matchedHtml, "No mismatches found.");

  const mismatchedHtml = resultsStepWithReconciliation({
    aisFigures: { dividends: 5000, interestOtherIncome: null },
    tdsRows: [{ source: "Sample Bank", tdsPerDocument: 1000, tdsPerAis: 800 }]
  });
  assertIncludes(mismatchedHtml, "Dividends");
  assertIncludes(mismatchedHtml, "Sample Bank");
  if (mismatchedHtml.includes("Everything you've entered matches")) {
    throw new Error("Reconciliation panel should surface a planted mismatch, not report a clean match.");
  }

  console.log("Validated reconciliation panel: blank/matched/mismatched AIS and TDS states all render correctly.");
}

function resultsStepWithConfidence(report: ConfidenceReport) {
  return renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      onChangeSupplementalFigures={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      confidenceReport={report}
      showAdvanced={false}
      onToggleAdvanced={noop}
      exportMessage=""
      onExportCsv={noop}
      onExportXlsx={noop}
      onExportFullWorkbook={noop}
      localFolderSupported={false}
      localFolderName={null}
      onChooseLocalFolder={noop}
    />
  );
}

function checkConfidenceReportPanel() {
  const cleanHtml = resultsStepWithConfidence({ missing: [], mayChange: [], safeToIgnore: [], ready: true });
  assertIncludes(cleanHtml, "Before you export");
  if (cleanHtml.includes("Still missing") || cleanHtml.includes("May change your numbers")) {
    throw new Error("Confidence report should not show empty groups when nothing is flagged.");
  }

  const flaggedHtml = resultsStepWithConfidence({
    missing: [{ label: "Form 16", detail: "Shows salary and TDS already deducted." }],
    mayChange: [{ label: "Speculative income detected", detail: "Moves your filing to ITR-3." }],
    safeToIgnore: [{ label: "More than one employer this year", detail: "Worth mentioning to your CA." }],
    ready: false
  });
  assertIncludes(flaggedHtml, "Still missing");
  assertIncludes(flaggedHtml, "Form 16");
  assertIncludes(flaggedHtml, "May change your numbers");
  assertIncludes(flaggedHtml, "Speculative income detected");
  assertIncludes(flaggedHtml, "Flagged, but safe to export as-is");
  assertIncludes(flaggedHtml, "More than one employer this year");

  console.log("Validated confidence report panel: clean and flagged states both render the right groups.");
}

function assertIncludes(value: string, expected: string) {
  if (!value.includes(expected)) {
    throw new Error(`Rendered output is missing: ${expected}`);
  }
}

function main() {
  checkWelcomeScreen();
  checkHelpPanel();
  checkCapabilitiesPanel();
  checkOrientationForm();
  checkChecklistPanel();
  checkResultsStepDefaultsToSimple();
  checkResultsStepAdvancedToggle();
  checkReconciliationPanel();
  checkConfidenceReportPanel();
}

main();
