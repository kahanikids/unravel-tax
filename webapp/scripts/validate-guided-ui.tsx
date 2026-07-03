import { renderToString } from "react-dom/server";
import App from "../src/App";
import { ChecklistPanel } from "../src/components/ChecklistPanel";
import { OrientationForm } from "../src/components/OrientationForm";
import { ResultsStep } from "../src/components/ResultsStep";
import { HelpPanel } from "../src/components/HelpPanel";
import { CapabilitiesPanel } from "../src/components/CapabilitiesPanel";
import { UploadStep } from "../src/components/UploadStep";
import { BLANK_AIS_REPORTED_FIGURES, BLANK_ORIENTATION, BLANK_SUPPLEMENTAL_FIGURES, STEP_ORDER } from "../src/state/types";
import { CAPABILITIES, DISCLAIMER_FULL, HOW_IT_WORKS, WHO_ITS_FOR, WHO_ITS_FOR_EXCLUDES } from "../src/lib/copy";
import { deriveProfileFlags } from "../src/lib/profile";
import { saveSession } from "../src/lib/persistence";
import { ruleCatalog } from "../src/rules";
import type { CaSummaryRow } from "../src/lib/calculations";
import type { ConfidenceReport } from "../src/lib/confidence";
import type { CaRecommendation } from "../src/lib/riskTriggers";

/** Minimal in-memory localStorage stand-in - Node has no global localStorage. */
function withMockLocalStorage(seed: Record<string, string>, run: () => void) {
  const store = new Map<string, string>(Object.entries(seed));
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    length: 0,
    key: () => null,
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear()
  };
  try {
    run();
  } finally {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }
}

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

  // "Show value first" redesign: welcome no longer funnels straight into
  // orientation. It offers 3 equally-weighted entry paths as cards.
  assertIncludes(html, "Checklist");
  assertIncludes(html, "Start with Computation");
  assertIncludes(html, "Get to know the tool");
  assertIncludes(html, 'class="entry-path-cards"');
  const entryPathCardCount = html.split('class="entry-path-card"').length - 1;
  if (entryPathCardCount !== 3) {
    throw new Error(`Expected exactly 3 entry-path cards on the welcome screen, found ${entryPathCardCount}.`);
  }

  assertIncludes(html, "See with Sample Data");
  assertIncludes(html, "Unravel Tax");
  // The merged FY-scope-and-CA-disclaimer line lives once, in the footer,
  // shown on every screen including welcome - not duplicated on the card.
  // (Checked as a substring before the apostrophe: React's SSR renderer
  // escapes "doesn't" to "doesn&#x27;t" in the rendered HTML.)
  assertIncludes(html, "Built for FY 2025-26 (AY 2026-27) filings only. It organizes your numbers.");
  assertIncludes(html, 'class="app-footer"');

  for (const jargon of ["Milestone readiness", "Static Constraints", "Next Slices", "M4E", "Working plan"]) {
    if (html.includes(jargon)) {
      throw new Error(`End-user welcome screen must not contain developer/milestone jargon: "${jargon}"`);
    }
  }

  assertIncludes(html, 'aria-label="How this works');
  if (html.includes("Who it's for") || html.includes(DISCLAIMER_FULL.slice(0, 20))) {
    throw new Error("Help panel content should be closed by default, not present in the initial render.");
  }

  // "What can this do?" is back as a small corner trigger on the welcome
  // card itself, in addition to the "Get to know the tool" card - both open
  // the same capabilities panel/state, just two doors into it.
  assertIncludes(html, "What can this do?");
  assertIncludes(html, 'class="welcome-card-header"');
  if (html.includes("Available now") || html.includes(CAPABILITIES[0].detail.slice(0, 20))) {
    throw new Error("Capabilities panel content should be closed by default, not present in the initial render.");
  }

  // The entry-path cards are icon-led now, not paragraph-heavy: one short
  // supporting line each, no separate "arrow" call-to-action line.
  if (html.includes('class="entry-path-cta"')) {
    throw new Error("Entry-path cards should no longer have a separate CTA line; the icon+heading+one-line format replaced it.");
  }
  assertIncludes(html, 'class="entry-path-icon"');

  // The side nav shows on every screen, including welcome - as an inert
  // preview there (nothing's been reached yet), never a way to skip ahead.
  assertIncludes(html, 'class="side-nav"');
  assertIncludes(html, "About you");
  if (html.includes('<button type="button" class="side-nav-step')) {
    throw new Error("No step should be a clickable button before the user has reached any of them.");
  }

  // "Start over" now lives inside OrientationForm only, so it should never
  // appear on the welcome screen, where OrientationForm hasn't mounted yet.
  if (html.includes("Start over")) {
    throw new Error("'Start over' should not render on the welcome screen; it now lives inside OrientationForm.");
  }

  console.log("Validated welcome screen: 3 entry-path cards (Checklist / Start with Computation / Get to know the tool), no dev/milestone jargon leaking into the UI.");
}

/**
 * "Start with Computation" is the least-friction path that still produces a
 * correct number: it jumps straight to the documents step and leaves
 * orientation answers at their null/blank defaults. deriveProfileFlags()
 * treats every null answer as "No" (see lib/profile.ts), and caSummaryRows()
 * never reads orientation at all, only transactions and rules - so capital
 * gains/dividends/interest figures come out right immediately, while
 * profile-driven bits (ITR form, risk triggers, checklist, CA
 * recommendation) fall back to a resident/no-special-circumstances default
 * until the user goes back and answers the questions. STEP_ORDER already
 * puts "documents" after "orientation" and "checklist", so App's existing
 * generic furthestStepIndex effect (bump to Math.max(prev, index of new
 * step)) makes both of those steps reachable again from the header nav
 * without any special-cased jump logic.
 */
function checkComputationFirstPathIsReachable() {
  const documentsIndex = STEP_ORDER.indexOf("documents");
  const orientationIndex = STEP_ORDER.indexOf("orientation");
  const checklistIndex = STEP_ORDER.indexOf("checklist");
  if (!(documentsIndex > orientationIndex && documentsIndex > checklistIndex)) {
    throw new Error("STEP_ORDER must keep 'documents' after 'orientation' and 'checklist' for the computation-first jump to leave them reachable.");
  }

  // deriveProfileFlags() must treat every still-null orientation answer as a
  // safe "No"/baseline default, since the computation-first path can reach
  // documents/results with orientation left exactly at BLANK_ORIENTATION.
  const flags = deriveProfileFlags(BLANK_ORIENTATION);
  if (flags.nri || flags.huf || flags.seniorCitizen || flags.singleParent || flags.hasCapitalGains) {
    throw new Error("Blank orientation answers must resolve to the resident/no-special-circumstances default, or the computation-first shortcut isn't safe.");
  }

  console.log("Validated 'Start with Computation' jump: documents step stays reachable back to orientation/checklist, and blank orientation resolves to a safe default profile.");
}

/**
 * If a saved session exists, its furthestStepIndex should already be
 * reflected in the side nav on the very first render, on the welcome
 * screen, before the user clicks "Resume" - otherwise a reload/crash that
 * lands back on welcome would look like a reset to step 1 even though
 * progress is safely cached in localStorage.
 */
function checkSideNavReflectsResumedSession() {
  withMockLocalStorage({}, () => {
    saveSession({
      step: "documents",
      furthestStepIndex: STEP_ORDER.indexOf("documents"),
      orientation: BLANK_ORIENTATION,
      documents: [],
      supplementalFigures: BLANK_SUPPLEMENTAL_FIGURES,
      acknowledgedTriggerIds: [],
      aisFigures: BLANK_AIS_REPORTED_FIGURES,
      tdsRows: []
    });

    const html = renderToString(<App />);

    // Still mounts on welcome (nothing auto-jumps the user anywhere)...
    assertIncludes(html, 'class="entry-path-cards"');

    // ...but orientation/checklist/documents are already clickable in the
    // side nav, since they're all <= the saved furthestStepIndex.
    const reachableStepCount = html.split('<button type="button" class="side-nav-step').length - 1;
    if (reachableStepCount !== 3) {
      throw new Error(
        `Expected 3 reachable side-nav steps (orientation/checklist/documents) from the saved session, found ${reachableStepCount}.`
      );
    }
    // "Your results" is past furthestStepIndex, so it should still be inert.
    assertIncludes(html, 'aria-disabled="true" title="Your results"');
  });

  console.log(
    "Validated side nav: reflects a saved session's furthestStepIndex on the welcome screen itself, without requiring an explicit Resume click first."
  );
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
    <OrientationForm answers={BLANK_ORIENTATION} onChange={noop as never} onComplete={noop} onStartOver={noop} />
  );
  assertIncludes(html, "Question 1 of");
  assertIncludes(html, "Are you living in India right now");
  assertIncludes(html, ">Start over<");
  if (html.includes(">Skip<")) {
    throw new Error("Residency decides the whole checklist/rules branch and should not be skippable.");
  }

  // A yes-no question with a safe null-means-No default (deriveProfileFlags)
  // should offer Skip, visually secondary to Yes/No.
  const hufHtml = renderToString(
    <OrientationForm
      answers={{ ...BLANK_ORIENTATION, residency: "resident" }}
      onChange={noop as never}
      onComplete={noop}
      onStartOver={noop}
    />
  );
  assertIncludes(hufHtml, "Is any of this income or investment held through a family");
  assertIncludes(hufHtml, ">Skip<");

  console.log("Validated orientation flow: renders one question at a time, starting with residency, Start over available, Skip offered only where it's safe.");
}

function checkUploadStep() {
  const html = renderToString(
    <UploadStep
      documents={[{ fileName: "broker-statement.csv", rowCount: 5 }]}
      onCommit={noop as never}
      onRemove={noop}
      onContinue={noop}
      localFolderSupported={false}
      localFolderName={null}
      onChooseLocalFolder={noop}
    />
  );
  assertIncludes(html, "Add your documents");
  assertIncludes(html, "Choose a file");
  assertIncludes(html, "broker-statement.csv");
  if (html.includes("Here's what we read from")) {
    throw new Error("The extraction review modal should be closed until a document is actually parsed.");
  }
  console.log("Validated upload step: single upload action, previously added documents listed, review modal closed by default.");
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
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
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
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
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

function checkRegimeComparisonPanel() {
  const withoutSalaryHtml = renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      onChangeSupplementalFigures={noop}
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
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
  assertIncludes(withoutSalaryHtml, "Old vs new regime: which costs less?");
  assertIncludes(withoutSalaryHtml, "Capital gains taxed under Sections 111A");
  assertIncludes(withoutSalaryHtml, "Enter your salary/pension income above to see an estimate.");

  const withSalaryHtml = renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, salaryIncome: 1_200_000 }}
      onChangeSupplementalFigures={noop}
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
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
  assertIncludes(withSalaryHtml, "New regime");
  assertIncludes(withSalaryHtml, "new regime looks cheaper");
  if (withSalaryHtml.includes("Enter your salary/pension income above to see an estimate.")) {
    throw new Error("Regime comparison should show an estimate once salary income is entered.");
  }

  console.log("Validated regime comparison panel: scope caveat always shown, estimate appears only once salary is entered.");
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
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
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
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
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
  checkComputationFirstPathIsReachable();
  checkSideNavReflectsResumedSession();
  checkHelpPanel();
  checkCapabilitiesPanel();
  checkOrientationForm();
  checkUploadStep();
  checkRegimeComparisonPanel();
  checkChecklistPanel();
  checkResultsStepDefaultsToSimple();
  checkResultsStepAdvancedToggle();
  checkReconciliationPanel();
  checkConfidenceReportPanel();
}

main();
