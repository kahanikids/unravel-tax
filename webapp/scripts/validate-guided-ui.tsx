import { renderToString } from "react-dom/server";
import App from "../src/App";
import { ChecklistPanel } from "../src/components/ChecklistPanel";
import { OrientationForm } from "../src/components/OrientationForm";
import { ResultsStep } from "../src/components/ResultsStep";
import { HelpPanel } from "../src/components/HelpPanel";
import { BLANK_ORIENTATION, BLANK_SUPPLEMENTAL_FIGURES } from "../src/state/types";
import { DISCLAIMER_FULL, HOW_IT_WORKS, WHO_ITS_FOR, WHO_ITS_FOR_EXCLUDES } from "../src/lib/copy";
import type { CaSummaryRow } from "../src/lib/calculations";
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

function noop() {
  return undefined;
}

function checkWelcomeScreen() {
  const html = renderToString(<App />);

  assertIncludes(html, "Get started");
  assertIncludes(html, "See it with sample data first");
  assertIncludes(html, "This organizes your numbers");
  assertIncludes(html, "Unravel Tax");

  for (const jargon of ["Milestone readiness", "Static Constraints", "Next Slices", "M4E", "Working plan"]) {
    if (html.includes(jargon)) {
      throw new Error(`End-user welcome screen must not contain developer/milestone jargon: "${jargon}"`);
    }
  }

  assertIncludes(html, 'aria-label="How this works');
  if (html.includes("Who it's for") || html.includes(DISCLAIMER_FULL.slice(0, 20))) {
    throw new Error("Help panel content should be closed by default, not present in the initial render.");
  }

  // The step nav shows on every screen, including welcome - as an inert
  // preview there (nothing's been reached yet), never a way to skip ahead.
  assertIncludes(html, 'class="progress-steps"');
  assertIncludes(html, "About you");
  if (html.includes('<button type="button" class="progress-step')) {
    throw new Error("No step should be a clickable button before the user has reached any of them.");
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

function checkOrientationForm() {
  const html = renderToString(
    <OrientationForm answers={BLANK_ORIENTATION} onChange={noop as never} onComplete={noop} />
  );
  assertIncludes(html, "Question 1 of");
  assertIncludes(html, "Are you living in India right now");
  console.log("Validated orientation flow: renders one question at a time, starting with residency.");
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

function assertIncludes(value: string, expected: string) {
  if (!value.includes(expected)) {
    throw new Error(`Rendered output is missing: ${expected}`);
  }
}

function main() {
  checkWelcomeScreen();
  checkHelpPanel();
  checkOrientationForm();
  checkChecklistPanel();
  checkResultsStepDefaultsToSimple();
  checkResultsStepAdvancedToggle();
}

main();
