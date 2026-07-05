import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToString } from "react-dom/server";
import App from "../src/App";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { WelcomeScreen } from "../src/components/WelcomeScreen";
import { ChecklistPanel } from "../src/components/ChecklistPanel";
import { OrientationForm } from "../src/components/OrientationForm";
import { ResultsStep } from "../src/components/ResultsStep";
import { Dashboard, type ThisYearSnapshot } from "../src/components/Dashboard";
import { HelpPanel } from "../src/components/HelpPanel";
import { CapabilitiesPanel } from "../src/components/CapabilitiesPanel";
import { ToolTour } from "../src/components/ToolTour";
import { UploadStep } from "../src/components/UploadStep";
import {
  BLANK_AIS_REPORTED_FIGURES,
  BLANK_ORIENTATION,
  BLANK_SUPPLEMENTAL_FIGURES,
  STEP_ORDER
} from "../src/state/types";
import {
  CAPABILITIES,
  DISCLAIMER_FULL,
  HOW_IT_WORKS,
  ITR_FORM_REASONS,
  REPORT_ISSUE_URL,
  TOOL_TOUR_USE_CASES,
  WELCOME_DISCLAIMER_BANNER,
  WHO_ITS_FOR,
  WHO_ITS_FOR_EXCLUDES
} from "../src/lib/copy";
import {
  clubbedMinorIncome,
  deriveProfileFlags,
  profileScopeCaveats,
  selectItrForm
} from "../src/lib/profile";
import { applySummaryFiguresToSupplemental } from "../src/lib/summaryFigures";
import type { ProfileFlags } from "../src/state/types";
import { saveSession } from "../src/lib/persistence";
import {
  deriveHistoryInsights,
  normalizeAssessmentYear,
  parseItrJson,
  parseItrVText,
  type PastFiling
} from "../src/lib/pastFilings";
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
  {
    head: "CA review recommendation",
    ruleSection: "",
    amount: "Get a CA to review this before filing",
    notes: ""
  }
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

// No documents uploaded in these fixtures, so there's no dated capital-gains
// tax to allocate by instalment - matches BLANK/SAMPLE-figures profiles below.
const EMPTY_CAPITAL_GAINS_TAX = { cumulativeByInstalment: [0, 0, 0, 0], totalForYear: 0 };

function checkWelcomeScreen() {
  const html = renderToString(<App />);

  // "Show value first" redesign: welcome no longer funnels straight into
  // orientation. It offers 3 equally-weighted entry paths as cards.
  assertIncludes(html, "Checklist");
  assertIncludes(html, "Add Documents");
  assertIncludes(html, "Get To Know The Tool");
  assertIncludes(html, 'class="entry-path-cards"');
  const entryPathCardCount = html.split('class="entry-path-card"').length - 1;
  if (entryPathCardCount !== 3) {
    throw new Error(
      `Expected exactly 3 entry-path cards on the welcome screen, found ${entryPathCardCount}.`
    );
  }

  // The standalone sample-data link is gone - it's now step 3 of the
  // "Get to know the tool" tour, so it's not a second, redundant entry point.
  if (html.includes("See with Sample Data")) {
    throw new Error(
      "The standalone 'See with Sample Data' link should be removed; sample data is reachable via the tour instead."
    );
  }
  assertIncludes(html, "Unravel Tax");
  // The crisp FY-scope-and-CA line lives once, in the footer, shown on every
  // screen including welcome - not duplicated on the card. Non-affiliation and
  // the rest of the legal detail live only in the linked full disclaimer
  // (LEGAL_SECTIONS), also rendered on the welcome screen, not in this line.
  assertIncludes(html, "For FY 2025-26 (AY 2026-27) filings.");
  assertIncludes(
    html,
    "not affiliated with, endorsed by, or connected to the Income Tax Department"
  );
  assertIncludes(html, 'class="app-footer"');

  for (const jargon of [
    "Milestone readiness",
    "Static Constraints",
    "Next Slices",
    "M4E",
    "Working plan"
  ]) {
    if (html.includes(jargon)) {
      throw new Error(
        `End-user welcome screen must not contain developer/milestone jargon: "${jargon}"`
      );
    }
  }

  assertIncludes(html, 'aria-label="How this works');
  if (html.includes("Who it's for") || html.includes(DISCLAIMER_FULL.slice(0, 20))) {
    throw new Error(
      "Help panel content should be closed by default, not present in the initial render."
    );
  }

  // "Tools Features" is a small corner trigger on the welcome
  // card itself, in addition to the "Get to know the tool" card - both open
  // the same capabilities panel/state, just two doors into it.
  assertIncludes(html, "Tools Features");
  assertIncludes(html, 'class="welcome-card-header"');
  if (html.includes("Available now") || html.includes(CAPABILITIES[0].detail.slice(0, 20))) {
    throw new Error(
      "Capabilities panel content should be closed by default, not present in the initial render."
    );
  }

  // The entry-path cards are icon-led now, not paragraph-heavy: one short
  // supporting line each, no separate "arrow" call-to-action line.
  if (html.includes('class="entry-path-cta"')) {
    throw new Error(
      "Entry-path cards should no longer have a separate CTA line; the icon+heading+one-line format replaced it."
    );
  }
  assertIncludes(html, 'class="entry-path-icon"');

  // The side nav shows on every screen, including welcome - as an inert
  // preview there (nothing's been reached yet), never a way to skip ahead.
  assertIncludes(html, 'class="side-nav"');
  assertIncludes(html, "About You");
  // The Dashboard is a standalone destination in the side nav's utility group,
  // reachable from every screen (including welcome), never a way to skip ahead
  // in the filing flow.
  assertIncludes(html, ">Dashboard<");
  // Match step buttons specifically (they carry a side-nav-step-<state> class);
  // the always-available utility buttons (Help/Features/Tour/Legal) also reuse
  // side-nav-step for layout but are not steps and are fine to be clickable.
  if (html.includes('<button type="button" class="side-nav-step side-nav-step-')) {
    throw new Error(
      "No step should be a clickable button before the user has reached any of them."
    );
  }

  // The header logo is a non-destructive way back to welcome from anywhere.
  assertIncludes(html, 'class="brand-mark-button"');

  // "Start over" lives in the welcome resume-banner now, shown only when a
  // saved session exists. This render has none (Node has no localStorage), so
  // it should be absent here - and it's confirmed present in the saved-session
  // render inside checkSideNavReflectsResumedSession().
  if (html.includes("Start Over")) {
    throw new Error(
      "'Start Over' should only render on the welcome screen when a saved session exists."
    );
  }

  console.log(
    "Validated welcome screen: 3 entry-path cards (Checklist / Add documents / Get to know the tool), no dev/milestone jargon leaking into the UI."
  );
}

/**
 * "Add documents" is the least-friction path that still produces a
 * correct number: it jumps straight to the documents step and leaves
 * orientation answers at their null/blank defaults. deriveProfileFlags()
 * treats every null answer as "No" (see lib/profile.ts), and caSummaryRows()
 * never reads orientation at all, only transactions and rules - so capital
 * gains/dividends/interest figures come out right immediately, while
 * profile-driven bits (ITR form, risk triggers, checklist, CA
 * recommendation) fall back to a resident/no-special-circumstances default
 * until the user goes back and answers the questions. STEP_ORDER already
 * puts "documents" after "orientation", so App's existing generic
 * furthestStepIndex effect (bump to Math.max(prev, index of new step))
 * makes orientation reachable again from the side nav without any
 * special-cased jump logic.
 */
function checkComputationFirstPathIsReachable() {
  const documentsIndex = STEP_ORDER.indexOf("documents");
  const orientationIndex = STEP_ORDER.indexOf("orientation");
  if (!(documentsIndex > orientationIndex)) {
    throw new Error(
      "STEP_ORDER must keep 'documents' after 'orientation' for the computation-first jump to leave it reachable."
    );
  }

  // deriveProfileFlags() must treat every still-null orientation answer as a
  // safe "No"/baseline default, since the computation-first path can reach
  // documents/results with orientation left exactly at BLANK_ORIENTATION.
  const flags = deriveProfileFlags(BLANK_ORIENTATION);
  if (
    flags.nri ||
    flags.huf ||
    flags.seniorCitizen ||
    flags.singleParent ||
    flags.hasCapitalGains
  ) {
    throw new Error(
      "Blank orientation answers must resolve to the resident/no-special-circumstances default, or the computation-first shortcut isn't safe."
    );
  }

  console.log(
    "Validated 'Add documents' jump: documents step stays reachable back to orientation, and blank orientation resolves to a safe default profile."
  );
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

    // ...and because a saved session exists, the resume-banner offers both
    // "Resume where you left off" and "Start over" (moved here from the
    // orientation card, so it sits next to Resume).
    assertIncludes(html, "Resume Where You Left Off");
    assertIncludes(html, "Start Over");

    // ...but orientation/documents are already clickable in the side nav,
    // since they're all <= the saved furthestStepIndex.
    const reachableStepCount =
      html.split('<button type="button" class="side-nav-step side-nav-step-').length - 1;
    if (reachableStepCount !== 2) {
      throw new Error(
        `Expected 2 reachable side-nav steps (orientation/documents) from the saved session, found ${reachableStepCount}.`
      );
    }
    // "Current Filing" (results step) is past furthestStepIndex, so it should still be inert.
    assertIncludes(html, 'title="Current Filing"');
    assertIncludes(html, 'aria-disabled="true"');
  });

  console.log(
    "Validated side nav: reflects a saved session's furthestStepIndex on the welcome screen itself, without requiring an explicit Resume click first."
  );
}

function checkToolTour() {
  const closedHtml = renderToString(<ToolTour open={false} onClose={noop} onTrySample={noop} />);
  if (closedHtml.trim().length > 0) {
    throw new Error("Tool tour should render nothing when closed.");
  }

  const html = renderToString(<ToolTour open onClose={noop} onTrySample={noop} />);
  assertIncludes(html, "Step 1 of 3");
  assertIncludes(html, "What can it do");
  assertIncludes(html, 'class="tour-dots"');
  assertIncludes(html, ">Skip<");
  assertIncludes(html, ">Next<");
  // HOW_IT_WORKS itself is already validated in checkHelpPanel(); this just
  // covers the new content this component adds.
  if (TOOL_TOUR_USE_CASES.length === 0 || TOOL_TOUR_USE_CASES.some((useCase) => !useCase.trim())) {
    throw new Error("Every tool tour use case needs non-empty copy.");
  }

  console.log(
    "Validated tool tour: closed by default, step 1 renders use cases and step dots, reuses HOW_IT_WORKS copy."
  );
}

function checkHelpPanel() {
  const closedHtml = renderToString(<HelpPanel />);
  assertIncludes(closedHtml, 'aria-label="How this works');

  const html = renderToString(<HelpPanel initialOpen />);
  assertIncludes(html, "Report It On GitHub");
  assertIncludes(html, REPORT_ISSUE_URL);

  if (
    HOW_IT_WORKS.length === 0 ||
    HOW_IT_WORKS.some((step) => !step.title.trim() || !step.detail.trim())
  ) {
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
  for (const term of [
    "Chartered Accountant",
    "browser",
    "not affiliated",
    "Income Tax Department"
  ]) {
    if (!DISCLAIMER_FULL.includes(term)) {
      throw new Error(`Full disclaimer copy should mention "${term}".`);
    }
  }

  console.log(
    "Validated help panel: closed by default, How It Works/Who It's For/disclaimer copy all present."
  );
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
  // A fresh start (blank answers) goes straight into the questions, one at a
  // time, beginning with residency - no summary, and no "Start over" (that
  // now lives on the welcome resume-banner, not the orientation card).
  const html = renderToString(
    <OrientationForm answers={BLANK_ORIENTATION} onChange={noop as never} onComplete={noop} />
  );
  assertIncludes(html, "Question 1 of");
  assertIncludes(html, "Are you living in India right now");
  if (html.includes("Start Over")) {
    throw new Error(
      "'Start Over' no longer belongs in the orientation card; it moved to the welcome resume-banner."
    );
  }
  if (html.includes(">Skip<")) {
    throw new Error(
      "Residency decides the whole checklist/rules branch and should not be skippable."
    );
  }

  // Returning to "About you" with answers already saved shows a scannable
  // recap first (not question 1 again), with a way to edit them - so users
  // don't feel like they're redoing questions they already answered.
  const summaryHtml = renderToString(
    <OrientationForm
      answers={{
        ...BLANK_ORIENTATION,
        residency: "resident",
        seniorCitizen: false,
        incomeSources: ["salary_pension"]
      }}
      onChange={noop as never}
      onComplete={noop}
    />
  );
  assertIncludes(summaryHtml, "Your answers");
  assertIncludes(summaryHtml, "Where you live");
  assertIncludes(summaryHtml, "I live in India");
  assertIncludes(summaryHtml, "Salary or pension");
  assertIncludes(summaryHtml, ">Continue<");
  assertIncludes(summaryHtml, ">Update Answers<");

  console.log(
    "Validated orientation flow: blank answers start the one-question flow at residency; saved answers show an editable recap first; Start over is no longer in the card."
  );

  // The 80+ follow-up only shows once seniorCitizen is answered Yes.
  const notSeniorHtml = renderToString(
    <OrientationForm
      answers={{
        ...BLANK_ORIENTATION,
        residency: "resident",
        seniorCitizen: false,
        incomeSources: ["salary_pension"]
      }}
      onChange={noop as never}
      onComplete={noop}
    />
  );
  if (notSeniorHtml.includes("80 or older")) {
    throw new Error("The 80+ super-senior follow-up should be hidden when seniorCitizen is No.");
  }
  const seniorHtml = renderToString(
    <OrientationForm
      answers={{
        ...BLANK_ORIENTATION,
        residency: "resident",
        seniorCitizen: true,
        incomeSources: ["salary_pension"]
      }}
      onChange={noop as never}
      onComplete={noop}
    />
  );
  assertIncludes(seniorHtml, "80 or older");

  console.log(
    "Validated super-senior follow-up: hidden unless 60+ is Yes, shown and labelled once it is."
  );
}

function checkNriOrientationAndDtaa() {
  const nriFlowHtml = renderToString(
    <OrientationForm
      answers={{ ...BLANK_ORIENTATION, residency: "nri" }}
      onChange={noop as never}
      onComplete={noop}
    />
  );
  // Saved NRI residency shows the recap first; country and days-in-India are dedicated follow-up rows.
  assertIncludes(nriFlowHtml, "Country of tax residence");
  assertIncludes(nriFlowHtml, "Days in India this year");
  if (nriFlowHtml.includes("HRA")) {
    throw new Error("HRA questions should be hidden for the NRI profile.");
  }

  const residentHtml = renderToString(
    <OrientationForm
      answers={{ ...BLANK_ORIENTATION, residency: "resident" }}
      onChange={noop as never}
      onComplete={noop}
    />
  );
  if (residentHtml.includes("Days in India this year")) {
    throw new Error("Days-in-India question should only show for the NRI profile.");
  }

  const singaporeFlags = deriveProfileFlags({
    ...BLANK_ORIENTATION,
    residency: "nri",
    nriCountry: "Singapore",
    incomeSources: ["capital_gains"]
  });
  if (!profileScopeCaveats(singaporeFlags).some((caveat) => caveat.id === "nri_mf_dtaa_exempt")) {
    throw new Error("Singapore NRI with MF gains should surface the DTAA exempt caveat.");
  }

  const usFlags = deriveProfileFlags({
    ...BLANK_ORIENTATION,
    residency: "nri",
    nriCountry: "United States",
    incomeSources: ["capital_gains"]
  });
  if (!profileScopeCaveats(usFlags).some((caveat) => caveat.id === "nri_mf_dtaa_taxable_india")) {
    throw new Error("US NRI with MF gains should surface the taxable-in-India DTAA caveat.");
  }

  console.log(
    "Validated NRI orientation branch: country-of-residence question, resident-only questions hidden, DTAA MF caveats by country."
  );
}

function checkUploadStep() {
  const html = renderToString(
    <UploadStep
      documents={[{ fileName: "broker-statement.csv", rowCount: 5 }]}
      onCommit={noop as never}
      onCommitReference={noop}
      onRemove={noop}
      onContinue={noop}
      localFolderSupported={false}
      localFolderName={null}
      onChooseLocalFolder={noop}
    />
  );
  assertIncludes(html, "Add your documents");
  assertIncludes(html, "Choose Files");
  assertIncludes(html, "broker-statement.csv");
  if (html.includes("Here's what we read from")) {
    throw new Error(
      "The extraction review modal should be closed until a document is actually parsed."
    );
  }
  console.log(
    "Validated upload step: multi-file upload action, previously added documents listed, review modal closed by default."
  );
}

function checkChecklistPanel() {
  const html = renderToString(
    <ChecklistPanel
      checklistItems={[
        {
          document: "Broker/AMC capital gains statement",
          needed: "Yes",
          status: "Needed",
          whyNeeded: "Needed to classify gains."
        }
      ]}
      riskTriggers={[
        {
          id: "business_income_itr_form",
          label: "Speculative/intraday trading income is considered Business Income",
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
  assertIncludes(html, "Things to gather");
  assertIncludes(html, "Broker/AMC capital gains statement");
  assertIncludes(html, "Speculative/intraday trading income is considered Business Income");
  assertIncludes(html, "checklist-item-flag");
  assertIncludes(html, "Heads up: this tool has limits");
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
  assertIncludes(html, "Show Full Detail");
  assertIncludes(html, "Download CA Summary CSV");
  assertIncludes(html, "Download full workbook");

  if (html.includes("Show Simple View")) {
    throw new Error(
      "First-time default view should be simple; advanced detail must require the explicit toggle."
    );
  }

  console.log(
    "Validated results step: simple view is the default, recommendation and exports both present."
  );
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
  assertIncludes(html, "Show Simple View");
  assertIncludes(html, "sample.csv");
  console.log(
    "Validated results step: advanced toggle reveals full detail and the documents ledger."
  );
}

/**
 * The recognised summary figures must actually LAND in the supplemental fields
 * (not just show a guidance message): dividendIncome -> dividends, interestIncome
 * -> interestOtherIncome, deductibleCharges -> deductibleTransactionCharges,
 * tdsDeducted -> advanceTaxPaid, filling only fields still at 0 so a user's own
 * typed value is never clobbered, and reporting exactly which keys were touched.
 * Synthetic figures only.
 */
function checkSummaryFiguresPopulateFields() {
  const { next, applied } = applySummaryFiguresToSupplemental(BLANK_SUPPLEMENTAL_FIGURES, {
    dividendIncome: 123456.78,
    interestIncome: 4459.5,
    deductibleCharges: 137827.48,
    tdsDeducted: 83493.85,
    netRealisedGainNoDetail: 99999
  });
  if (next.dividends !== 123456.78 || next.interestOtherIncome !== 4459.5) {
    throw new Error(
      `Dividend/interest figures did not route into their fields: ${JSON.stringify(next)}`
    );
  }
  if (next.deductibleTransactionCharges !== 137827.48) {
    throw new Error(
      `deductibleCharges did not route into deductibleTransactionCharges: ${next.deductibleTransactionCharges}`
    );
  }
  if (next.advanceTaxPaid !== 83493.85) {
    throw new Error(`tdsDeducted did not route into advanceTaxPaid: ${next.advanceTaxPaid}`);
  }
  const expectedApplied = [
    "dividends",
    "interestOtherIncome",
    "deductibleTransactionCharges",
    "advanceTaxPaid"
  ];
  if (JSON.stringify([...applied].sort()) !== JSON.stringify([...expectedApplied].sort())) {
    throw new Error(
      `Prefilled keys should be exactly the four mapped fields, got ${JSON.stringify(applied)}.`
    );
  }
  // netRealisedGainNoDetail is a gap, never a figure - it must not become a field.
  if (JSON.stringify(next).includes("99999")) {
    throw new Error(
      "A net realised gain with no detail must not be written into any supplemental field."
    );
  }

  // Merge rule: a field the user already typed is never clobbered or doubled.
  const typed = { ...BLANK_SUPPLEMENTAL_FIGURES, dividends: 5000 };
  const merged = applySummaryFiguresToSupplemental(typed, {
    dividendIncome: 123456.78,
    interestIncome: 4459.5
  });
  if (merged.next.dividends !== 5000) {
    throw new Error(
      `A user's typed dividends (5000) must not be overwritten, got ${merged.next.dividends}.`
    );
  }
  if (merged.next.interestOtherIncome !== 4459.5 || merged.applied.includes("dividends")) {
    throw new Error(
      "Only the still-zero fields should be filled, and only those should be reported as prefilled."
    );
  }

  console.log(
    "Validated summary-figure routing: annual totals land in dividends/interest/charges/advance-tax fields, fill-only-when-0 keeps typed values, net-gain-only stays a gap, prefilled keys reported."
  );
}

function checkResultsStepSummaryPrefill() {
  // Synthetic figures only (never real data): a pasted PMS-style summary that
  // auto-filled the "A few more numbers" fields and left a net-gain-only gap.
  const baseProps = {
    rows: SAMPLE_ROWS,
    documents: [],
    openIssueCount: 0,
    caRecommendation: SAMPLE_RECOMMENDATION,
    onChangeSupplementalFigures: noop,
    debtMfShortTermDeemedGain: 0,
    intradayGain: 0,
    seniorCitizen: false,
    regimeChoiceRule: ruleCatalog.regimeChoice,
    advanceTaxRule: ruleCatalog.advanceTax,
    hufMembers: [],
    onChangeHufMembers: noop,
    hufTransfers: [],
    onChangeHufTransfers: noop,
    foreignAccounts: [],
    onChangeForeignAccounts: noop,
    foreignEquityHoldings: [],
    onChangeForeignEquityHoldings: noop,
    capitalGainsTaxByInstalment: EMPTY_CAPITAL_GAINS_TAX,
    insurancePolicies: [],
    onChangeInsurancePolicies: noop,
    aisFigures: BLANK_AIS_REPORTED_FIGURES,
    onChangeAisFigures: noop,
    tdsRows: [],
    onChangeTdsRows: noop,
    brokerCheck: null,
    confidenceReport: SAMPLE_CONFIDENCE_REPORT,
    showAdvanced: false,
    onToggleAdvanced: noop,
    exportMessage: "",
    onExportCsv: noop,
    onExportXlsx: noop,
    onExportFullWorkbook: noop,
    localFolderSupported: false,
    localFolderName: null,
    onChooseLocalFolder: noop
  };

  // The refine panel is renamed to "A few more numbers" everywhere, and the old
  // "Add more numbers to refine" label is gone.
  const plainHtml = renderToString(
    <ResultsStep {...baseProps} supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES} />
  );
  assertIncludes(plainHtml, "A few more numbers");
  if (plainHtml.includes("Add more numbers to refine")) {
    throw new Error(
      "The refine panel should be renamed to 'A few more numbers' to match copy used elsewhere."
    );
  }
  if (plainHtml.includes("please check them")) {
    throw new Error(
      "The prefill banner should not show when nothing was auto-filled from a statement."
    );
  }
  if (plainHtml.includes("Still needed:")) {
    throw new Error("The still-needed note should not show without a net-gain-only situation.");
  }

  const prefilledHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{
        ...BLANK_SUPPLEMENTAL_FIGURES,
        dividends: 12000,
        advanceTaxPaid: 3400
      }}
      prefilledFigureKeys={["dividends", "advanceTaxPaid"]}
      netGainMissingDetail
    />
  );
  assertIncludes(
    prefilledHtml,
    "Some of these were filled in from your statement. Please check them."
  );
  assertIncludes(prefilledHtml, "Still needed:");
  // Auto-fill/missing-detail forces the panel open so it isn't left undiscovered.
  assertIncludes(prefilledHtml, 'class="refine-panel" open');

  console.log(
    "Validated results 'A few more numbers': renamed panel, prefill banner + still-needed note appear only when signalled, panel opens by default when there's something to check."
  );
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
  // At Rs 12L salary the new regime is already zero-tax, so the break-even
  // block explains there's no break-even to reach rather than a large figure.
  assertIncludes(withSalaryHtml, "Break-even deductions");
  assertIncludes(withSalaryHtml, "no amount of old-regime deductions can beat");

  console.log(
    "Validated regime comparison panel: scope caveat always shown, estimate appears only once salary is entered."
  );
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={props.aisFigures}
      onChangeAisFigures={noop}
      tdsRows={props.tdsRows}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
    throw new Error(
      "Reconciliation panel should not claim a clean match before anything is entered."
    );
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
    throw new Error(
      "Reconciliation panel should surface a planted mismatch, not report a clean match."
    );
  }

  console.log(
    "Validated reconciliation panel: blank/matched/mismatched AIS and TDS states all render correctly."
  );
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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

function checkAdvanceTaxPanel() {
  const html = renderToString(
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
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
  assertIncludes(html, "Section 234B or 234C interest");
  assertIncludes(html, "Total tax liability for the year");
  assertIncludes(html, "Enter your total tax liability above to see an estimate.");
  // The 234C instalment inputs only appear once there's a liability to
  // estimate from - a blank panel stays skip-friendly.
  if (html.includes("instalment-by-instalment")) {
    throw new Error(
      "The 234C instalment section should stay hidden until a tax liability is entered."
    );
  }

  const withLiabilityHtml = renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, advanceTaxLiability: 100000 }}
      onChangeSupplementalFigures={noop}
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={EMPTY_CAPITAL_GAINS_TAX}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
  // With a liability entered: the per-instalment inputs, the total, and the
  // later-income caveat (never shown without it) all render.
  assertIncludes(withLiabilityHtml, "instalment-by-instalment");
  // React SSR splits "Paid by {date}" text nodes with comment markers, so
  // the label and the rule-driven date are asserted separately.
  assertIncludes(withLiabilityHtml, "Paid by");
  assertIncludes(withLiabilityHtml, "15 Jun 2025");
  assertIncludes(withLiabilityHtml, "15 Mar 2026");
  assertIncludes(withLiabilityHtml, "Estimated Section 234C interest, total");
  assertIncludes(
    withLiabilityHtml,
    "so their tax is still spread evenly across all four instalments"
  );
  // No dated capital-gains tax in this fixture, so the ordinary/capital-gains
  // split note (only shown once there's something to split) must stay hidden.
  if (withLiabilityHtml.includes("dated from your actual transactions below")) {
    throw new Error(
      "The capital-gains split note should only render when capitalGainsTaxByInstalment has a nonzero total."
    );
  }

  // With dated capital-gains tax supplied, the split note must render and
  // name both the capital-gains and ordinary portions.
  const withCapitalGainsHtml = renderToString(
    <ResultsStep
      rows={SAMPLE_ROWS}
      documents={[]}
      openIssueCount={0}
      caRecommendation={SAMPLE_RECOMMENDATION}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, advanceTaxLiability: 100000 }}
      onChangeSupplementalFigures={noop}
      debtMfShortTermDeemedGain={0}
      intradayGain={0}
      seniorCitizen={false}
      regimeChoiceRule={ruleCatalog.regimeChoice}
      advanceTaxRule={ruleCatalog.advanceTax}
      hufMembers={[]}
      onChangeHufMembers={noop}
      hufTransfers={[]}
      onChangeHufTransfers={noop}
      foreignAccounts={[]}
      onChangeForeignAccounts={noop}
      foreignEquityHoldings={[]}
      onChangeForeignEquityHoldings={noop}
      capitalGainsTaxByInstalment={{
        cumulativeByInstalment: [0, 0, 0, 40000],
        totalForYear: 40000
      }}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
      aisFigures={BLANK_AIS_REPORTED_FIGURES}
      onChangeAisFigures={noop}
      tdsRows={[]}
      onChangeTdsRows={noop}
      brokerCheck={null}
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
  assertIncludes(withCapitalGainsHtml, "dated from your actual transactions below");
  assertIncludes(withCapitalGainsHtml, "40,000");
  assertIncludes(withCapitalGainsHtml, "60,000");

  console.log(
    "Validated advance tax panel: Section 234B estimator renders with its inputs and skip-friendly default, the 234C instalment estimate appears with its always-on later-income caveat once a liability is entered, and the capital-gains/ordinary split note only appears once there's dated capital-gains tax to split out."
  );
}

function checkNriHufSingleParentPartialCalculations() {
  const baseProps = {
    rows: SAMPLE_ROWS,
    documents: [],
    openIssueCount: 0,
    caRecommendation: SAMPLE_RECOMMENDATION,
    onChangeSupplementalFigures: noop,
    debtMfShortTermDeemedGain: 0,
    intradayGain: 0,
    seniorCitizen: false,
    regimeChoiceRule: ruleCatalog.regimeChoice,
    advanceTaxRule: ruleCatalog.advanceTax,
    hufMembers: [],
    onChangeHufMembers: noop,
    hufTransfers: [],
    onChangeHufTransfers: noop,
    foreignAccounts: [],
    onChangeForeignAccounts: noop,
    foreignEquityHoldings: [],
    onChangeForeignEquityHoldings: noop,
    capitalGainsTaxByInstalment: EMPTY_CAPITAL_GAINS_TAX,
    insurancePolicies: [],
    onChangeInsurancePolicies: noop,
    aisFigures: BLANK_AIS_REPORTED_FIGURES,
    onChangeAisFigures: noop,
    tdsRows: [],
    onChangeTdsRows: noop,
    brokerCheck: null,
    confidenceReport: SAMPLE_CONFIDENCE_REPORT,
    showAdvanced: false,
    onToggleAdvanced: noop,
    exportMessage: "",
    onExportCsv: noop,
    onExportXlsx: noop,
    onExportFullWorkbook: noop,
    localFolderSupported: false,
    localFolderName: null,
    onChooseLocalFolder: noop
  };

  const defaultHtml = renderToString(
    <ResultsStep {...baseProps} supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES} />
  );
  if (defaultHtml.includes("NRE interest")) {
    throw new Error("NRE interest field should only render for the NRI profile.");
  }
  if (defaultHtml.includes("Minor's income to club")) {
    throw new Error("Minor's income field should only render for the single-parent profile.");
  }

  const nriHtml = renderToString(
    <ResultsStep {...baseProps} supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES} nri />
  );
  assertIncludes(nriHtml, "NRE interest");
  assertIncludes(nriHtml, "NRI: DTAA relief");
  assertIncludes(nriHtml, "NRI: repatriation check");
  if (defaultHtml.includes("NRI: DTAA relief") || defaultHtml.includes("NRI: repatriation check")) {
    throw new Error(
      "The NRI DTAA/TDS and repatriation panels should only render for the NRI profile."
    );
  }

  // Past the Rs 5 lakh CA-certificate threshold, the repatriation panel
  // names the (renamed) forms and doesn't claim the USD cap is breached.
  const nriRepatriationHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{
        ...BLANK_SUPPLEMENTAL_FIGURES,
        nriRepatriatedThisYearUsd: 50000,
        nriRepatriatedThisYearInr: 600000
      }}
      nri
    />
  );
  assertIncludes(nriRepatriationHtml, "Form 145");
  assertIncludes(nriRepatriationHtml, "Form 146");
  assertIncludes(nriRepatriationHtml, "will need");
  if (nriRepatriationHtml.includes("talk to your bank before repatriating more")) {
    throw new Error(
      "The USD 1M cap warning should not show when only the Rs 5L certificate threshold is crossed."
    );
  }

  // With a UAE country and dividends entered, the panel shows the treaty rate
  // (10%, lower than the 20% domestic rate) applying.
  const nriUaeHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, dividends: 100000 }}
      nri
      nriCountry="United Arab Emirates"
    />
  );
  // React SSR splits "flat {rate}" text nodes with comment markers, so the
  // label and the rule-driven rate are asserted separately.
  assertIncludes(nriUaeHtml, "taxed at a flat");
  assertIncludes(nriUaeHtml, "10%");
  assertIncludes(nriUaeHtml, "the lower treaty rate for United Arab Emirates");

  const hufHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, salaryIncome: 1_200_000 }}
      huf
    />
  );
  assertIncludes(hufHtml, "Skip it here and get slab-tax figures");
  if (hufHtml.includes("Old regime deductions")) {
    throw new Error(
      "HUF profile should not see the regime comparison inputs, which don't fit HUF's numbers."
    );
  }
  assertIncludes(hufHtml, "HUF: members");
  if (defaultHtml.includes("HUF: members")) {
    throw new Error("The HUF members/transfers panel should only render for the HUF profile.");
  }

  // A transfer without adequate consideration clubs its income to the
  // transferring member's own return (Section 64(2)); one with adequate
  // consideration doesn't.
  const hufClubbedHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      huf
      hufTransfers={[
        {
          id: "t1",
          transferringMemberName: "Priya",
          assetDescription: "Rental flat",
          transferDate: "2020-01-01",
          adequateConsideration: false,
          annualIncomeFromAsset: 240000
        }
      ]}
    />
  );
  assertIncludes(hufClubbedHtml, "Priya");
  assertIncludes(hufClubbedHtml, "belongs on");
  assertIncludes(hufClubbedHtml, "2,40,000");

  const hufNotClubbedHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      huf
      hufTransfers={[
        {
          id: "t2",
          transferringMemberName: "Arjun",
          assetDescription: "Fixed deposit",
          transferDate: "2020-01-01",
          adequateConsideration: true,
          annualIncomeFromAsset: 50000
        }
      ]}
    />
  );
  assertIncludes(hufNotClubbedHtml, "No adequate-consideration issue");
  if (hufNotClubbedHtml.includes("belongs on")) {
    throw new Error(
      "A transfer with adequate consideration should not trigger the Section 64(2) clubbing note."
    );
  }

  // Schedule FA Phase 1: hidden without the foreign-assets profile flag,
  // shown with the calendar-year framing and account totals once it's on.
  const foreignAssetsHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      hasForeignAssets
      foreignAccounts={[
        {
          id: "fa1",
          accountType: "depository",
          country: "United States",
          institutionName: "Chase",
          accountNumber: "1234",
          openingDate: "",
          peakBalanceInr: 500000,
          closingBalanceInr: 300000,
          grossInterestInr: 10000
        }
      ]}
    />
  );
  assertIncludes(foreignAssetsHtml, "Schedule FA rows");
  assertIncludes(foreignAssetsHtml, "calendar year");
  assertIncludes(foreignAssetsHtml, "5,00,000");
  assertIncludes(foreignAssetsHtml, "taxable at slab rate under income from other sources");
  if (defaultHtml.includes("Schedule FA rows")) {
    throw new Error("The Schedule FA panel should only render for the foreign-assets profile.");
  }

  // Schedule FA Phase 2: a long-term foreign-share sale shows its computed
  // gain/LTCG tax/credit; the foreign-tax-credit estimate note only appears
  // once there's a regime result (salary entered) to compute an average rate.
  const foreignEquityNoSalaryHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      hasForeignAssets
      foreignEquityHoldings={[
        {
          id: "fe1",
          entityName: "Acme Inc",
          isRsuOrEspp: false,
          acquisitionDate: "2022-01-01",
          costBasisInr: 100000,
          perquisiteValueInr: 0,
          closingValueInr: 0,
          saleDate: "2025-06-01",
          saleProceedsInr: 300000,
          foreignTaxPaidOnGainInr: 30000
        }
      ]}
    />
  );
  assertIncludes(foreignEquityNoSalaryHtml, "Foreign shares, RSU");
  assertIncludes(foreignEquityNoSalaryHtml, "unlisted");
  assertIncludes(foreignEquityNoSalaryHtml, "2,00,000");
  assertIncludes(foreignEquityNoSalaryHtml, "25,000");
  assertIncludes(
    foreignEquityNoSalaryHtml,
    "Enter your salary income above to see a foreign tax credit estimate"
  );
  if (defaultHtml.includes("Foreign shares, RSU")) {
    throw new Error("The foreign-equity panel should only render for the foreign-assets profile.");
  }

  const foreignEquityWithSalaryHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, salaryIncome: 1_200_000 }}
      hasForeignAssets
      foreignEquityHoldings={[]}
    />
  );
  assertIncludes(foreignEquityWithSalaryHtml, "average-rate method");
  if (
    foreignEquityWithSalaryHtml.includes(
      "Enter your salary income above to see a foreign tax credit estimate"
    )
  ) {
    throw new Error("The foreign tax credit estimate note should show once salary is entered.");
  }

  const singleParentHtml = renderToString(
    <ResultsStep {...baseProps} supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES} singleParent />
  );
  assertIncludes(singleParentHtml, "income to club");
  assertIncludes(singleParentHtml, "income the law never clubs");
  assertIncludes(singleParentHtml, "Number of minor children");

  // Loans section (hasLoans profile): the capped interest lines plus the
  // let-out house-property inputs and the 80C-principal field all render,
  // with a Rs 1,60,000 loss shown and explained per regime.
  const loansHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{
        ...BLANK_SUPPLEMENTAL_FIGURES,
        letOutRentReceived: 240000,
        letOutMunicipalTaxes: 40000,
        homeLoanInterestLetOut: 300000
      }}
      hasLoans
    />
  );
  assertIncludes(loansHtml, "Rented-out home (both regimes)");
  assertIncludes(loansHtml, "Rent received this year");
  assertIncludes(loansHtml, "Home-loan principal repaid (Section 80C)");
  assertIncludes(loansHtml, "1,60,000 loss");
  assertIncludes(loansHtml, "it can&#x27;t offset other income at all");

  const clubbed = clubbedMinorIncome(10000, 2, ruleCatalog.singleParentClubbing);
  if (clubbed !== 7000) {
    throw new Error(
      `Expected clubbedMinorIncome(10000, 2, rule) to be 7000 (10000 - 2x1500), got ${clubbed}.`
    );
  }
  const clubbedCapped = clubbedMinorIncome(10000, 5, ruleCatalog.singleParentClubbing);
  if (clubbedCapped !== clubbed) {
    throw new Error(
      `Expected clubbedMinorIncome to cap the exemption at max_children_for_exemption, got ${clubbedCapped}.`
    );
  }
  const clubbedFloor = clubbedMinorIncome(1000, 1, ruleCatalog.singleParentClubbing);
  if (clubbedFloor !== 0) {
    throw new Error(
      `Expected clubbedMinorIncome to floor at zero when income is below the exemption, got ${clubbedFloor}.`
    );
  }

  console.log(
    "Validated NRI/HUF/single-parent partial calculations: NRE exempt line, NRI repatriation check with renamed forms, HUF regime-comparison skip, HUF Section 64(2) transfer clubbing note, Schedule FA Phases 1-2 panel visibility/totals and the salary-gated foreign tax credit note, minor's-income clubbing math."
  );
}

function checkInsurancePolicyPanel() {
  const baseProps = {
    rows: SAMPLE_ROWS,
    documents: [],
    openIssueCount: 0,
    caRecommendation: SAMPLE_RECOMMENDATION,
    onChangeSupplementalFigures: noop,
    debtMfShortTermDeemedGain: 0,
    intradayGain: 0,
    seniorCitizen: false,
    regimeChoiceRule: ruleCatalog.regimeChoice,
    advanceTaxRule: ruleCatalog.advanceTax,
    hufMembers: [],
    onChangeHufMembers: noop,
    hufTransfers: [],
    onChangeHufTransfers: noop,
    foreignAccounts: [],
    onChangeForeignAccounts: noop,
    foreignEquityHoldings: [],
    onChangeForeignEquityHoldings: noop,
    capitalGainsTaxByInstalment: EMPTY_CAPITAL_GAINS_TAX,
    aisFigures: BLANK_AIS_REPORTED_FIGURES,
    onChangeAisFigures: noop,
    tdsRows: [],
    onChangeTdsRows: noop,
    brokerCheck: null,
    confidenceReport: SAMPLE_CONFIDENCE_REPORT,
    showAdvanced: false,
    onToggleAdvanced: noop,
    exportMessage: "",
    onExportCsv: noop,
    onExportXlsx: noop,
    onExportFullWorkbook: noop,
    localFolderSupported: false,
    localFolderName: null,
    onChooseLocalFolder: noop
  };

  const withoutFlagHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
    />
  );
  if (withoutFlagHtml.includes("is it actually taxable?")) {
    throw new Error(
      "The insurance policy panel should only render for the hasInsurancePayout profile."
    );
  }

  const withFlagNoPoliciesHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={BLANK_SUPPLEMENTAL_FIGURES}
      hasInsurancePayout
      insurancePolicies={[]}
      onChangeInsurancePolicies={noop}
    />
  );
  assertIncludes(withFlagNoPoliciesHtml, "is it actually taxable?");
  assertIncludes(withFlagNoPoliciesHtml, "No policies added yet.");

  // A traditional policy over the Rs 5L aggregate cap: taxable amount and
  // treatment render, and the regime-comparison note about the auto-added
  // other-income figure appears.
  const taxablePolicy = {
    id: "p1",
    policyType: "traditional" as const,
    isDeathBenefit: false,
    issueDate: "2024-01-01",
    sumAssured: 10000000,
    annualPremium: 600000,
    totalPremiumsPaidToDate: 2000000,
    maturityPayoutThisYear: 3000000
  };
  const withTaxablePolicyHtml = renderToString(
    <ResultsStep
      {...baseProps}
      supplementalFigures={{ ...BLANK_SUPPLEMENTAL_FIGURES, salaryIncome: 1_200_000 }}
      hasInsurancePayout
      insurancePolicies={[taxablePolicy]}
      onChangeInsurancePolicies={noop}
    />
  );
  assertIncludes(withTaxablePolicyHtml, "Taxable - income from other sources");
  assertIncludes(withTaxablePolicyHtml, "10,00,000");
  assertIncludes(withTaxablePolicyHtml, "already added to the");
  assertIncludes(withTaxablePolicyHtml, "other income");
  assertIncludes(withTaxablePolicyHtml, "side of both regimes");

  console.log(
    "Validated insurance policy panel: hidden without the profile flag, renders empty-state and per-policy taxable computation, and feeds the taxable amount into the regime comparison's other-income note."
  );
}

function checkConfidenceReportPanel() {
  const cleanHtml = resultsStepWithConfidence({
    missing: [],
    mayChange: [],
    safeToIgnore: [],
    ready: true
  });
  assertIncludes(cleanHtml, "Before you export");
  if (cleanHtml.includes("Still missing") || cleanHtml.includes("May change your numbers")) {
    throw new Error("Confidence report should not show empty groups when nothing is flagged.");
  }

  const flaggedHtml = resultsStepWithConfidence({
    missing: [{ label: "Form 16", detail: "Shows salary and TDS already deducted." }],
    mayChange: [{ label: "Speculative income detected", detail: "Moves your filing to ITR-3." }],
    safeToIgnore: [
      { label: "More than one employer this year", detail: "Worth mentioning to your CA." }
    ],
    ready: false
  });
  assertIncludes(flaggedHtml, "Still missing");
  assertIncludes(flaggedHtml, "Form 16");
  assertIncludes(flaggedHtml, "May change your numbers");
  assertIncludes(flaggedHtml, "Speculative income detected");
  assertIncludes(flaggedHtml, "Flagged, but safe to export as-is");
  assertIncludes(flaggedHtml, "More than one employer this year");

  console.log(
    "Validated confidence report panel: clean and flagged states both render the right groups."
  );
}

const BLANK_FLAGS: ProfileFlags = {
  nri: false,
  nriCountry: null,
  huf: false,
  seniorCitizen: false,
  superSeniorCitizen: false,
  singleParent: false,
  hasCapitalGains: false,
  hasDividends: false,
  hasBankInterest: false,
  hasRent: false,
  multipleEmployers: false,
  hraRisk: false,
  epfRisk: false,
  hasLoans: false,
  hasInsurancePayout: false,
  hasForeignAssets: false
};

function checkItrFormSelection() {
  const rule = ruleCatalog.itrFormSelection;
  const cap = rule.values.itr1_conditions.total_income_max_inr;

  const expect = (
    label: string,
    flags: ProfileFlags,
    hasBusinessIncome: boolean,
    totalIncome: number,
    expectedForm: string,
    expectedKey: string
  ) => {
    const choice = selectItrForm(flags, hasBusinessIncome, rule, totalIncome);
    if (choice.form !== expectedForm || choice.key !== expectedKey) {
      throw new Error(
        `ITR selection for ${label}: expected ${expectedForm} (${expectedKey}), got ${choice.form} (${choice.key}).`
      );
    }
  };

  expect(
    "resident, only salary/interest, under the cap",
    BLANK_FLAGS,
    false,
    cap - 1,
    "ITR-1",
    "resident_simple"
  );
  // The Rs 50 lakh ceiling: the same simple profile above the cap must move to ITR-2, not stay on ITR-1.
  expect(
    "resident, only salary/interest, above the cap",
    BLANK_FLAGS,
    false,
    cap + 1,
    "ITR-2",
    "resident_above_itr1_limit"
  );
  expect(
    "resident with capital gains",
    { ...BLANK_FLAGS, hasCapitalGains: true },
    false,
    100000,
    "ITR-2",
    "resident_capital_gains_or_clubbing"
  );
  expect(
    "single parent (clubbing)",
    { ...BLANK_FLAGS, singleParent: true },
    false,
    100000,
    "ITR-2",
    "resident_capital_gains_or_clubbing"
  );
  // Intraday is speculative business income - it must win even above the income cap.
  expect(
    "resident with intraday/business income",
    BLANK_FLAGS,
    true,
    cap + 1,
    "ITR-3",
    "business_or_speculative_non_audit"
  );
  expect(
    "NRI without business",
    { ...BLANK_FLAGS, nri: true },
    false,
    100000,
    "ITR-2",
    "nri_no_business"
  );
  expect(
    "HUF without business",
    { ...BLANK_FLAGS, huf: true },
    false,
    100000,
    "ITR-2",
    "huf_no_business"
  );
  // Unknown income (0) must never trip the ceiling - the safe direction.
  expect("resident, income not yet known", BLANK_FLAGS, false, 0, "ITR-1", "resident_simple");

  // The ITR-1 recommendation must be honest about disqualifiers this tool can't see.
  const itr1Reason = ITR_FORM_REASONS.resident_simple;
  for (const phrase of ["50 lakh", "foreign", "director"]) {
    if (!itr1Reason.toLowerCase().includes(phrase)) {
      throw new Error(
        `ITR-1 recommendation note should caveat "${phrase}" but doesn't: ${itr1Reason}`
      );
    }
  }

  console.log(
    "Validated ITR form selection: Rs 50 lakh ITR-1 ceiling, capital-gains/clubbing/NRI/HUF/intraday routing, and the honest ITR-1 disqualifier caveat."
  );
}

// Synthetic (clearly fictional) past filings - never real data, per CLAUDE.md.
const SAMPLE_PAST_FILINGS: PastFiling[] = [
  {
    id: "pf-a",
    assessmentYear: "2023-24",
    itrForm: "ITR-2",
    regime: "old",
    grossTotalIncome: 1_000_000,
    totalTaxPaid: 90_000,
    refundOrPayable: 3_000,
    capitalGains: 40_000,
    carryForwardLosses: 0,
    loanPrincipal: 120_000,
    loanInterest: 180_000,
    source: "manual"
  },
  {
    id: "pf-b",
    assessmentYear: "2024-25",
    itrForm: "ITR-2",
    regime: "new",
    grossTotalIncome: 1_200_000,
    totalTaxPaid: 90_000,
    refundOrPayable: -5_000,
    capitalGains: -20_000,
    carryForwardLosses: 20_000,
    loanPrincipal: 150_000,
    loanInterest: 160_000,
    source: "itr-json"
  }
];

const SAMPLE_THIS_YEAR: ThisYearSnapshot = {
  hasStartedFiling: true,
  financialYear: "2025-26",
  assessmentYear: "AY 2026-27",
  itrForm: "ITR-3",
  itrDueDate: "2026-08-31",
  regimeNote: "New regime by default",
  capitalGains: {
    stcg: -500,
    ltcg: 90000,
    debtMf: 12000,
    intraday: 4000,
    ltcgExemptionLimit: 125000
  },
  estimatedCapitalGainsTax: 0,
  regime: {
    comparable: true,
    newRegimeTax: 90000,
    oldRegimeTax: 105000,
    cheaper: "new",
    saving: 15000,
    breakEvenDeductions: 250000,
    actualDeductions: 90000,
    newAlwaysWins: false
  },
  deductions: [
    {
      key: "deduction80C",
      section: "80C",
      label: "Section 80C investments",
      used: 90000,
      limit: 150000
    },
    {
      key: "deduction80D",
      section: "80D",
      label: "Section 80D health cover",
      used: 12000,
      limit: 25000
    },
    {
      key: "deductionNps80ccd1b",
      section: "80CCD(1B)",
      label: "NPS extra deduction",
      used: 50000,
      limit: 50000
    }
  ],
  insurance: {
    applies: false,
    annualPremium: 0,
    ulipCap: 250000,
    traditionalCap: 500000,
    tdsRate: 0.02,
    tdsThresholdInr: 100000,
    overUlipCap: false,
    overTraditionalCap: false,
    sourceRefs: ruleCatalog.insurance.source_refs
  },
  foreignInvestments: {
    applies: false,
    remittance: 0,
    purpose: "investment_gift_other",
    threshold: 1000000,
    rate: 0.2,
    estimatedTcs: 0,
    overThreshold: false,
    scheduleFaMinValueInr: 0,
    requiresItrForms: ["ITR-2", "ITR-3"],
    blackMoneyPenaltyInr: 1000000,
    sourceRefs: ruleCatalog.foreignInvestments.source_refs
  },
  variance: { checkCount: 3, mismatchCount: 1, totalAbsVariance: 4200 }
};

function checkDashboardDestination() {
  // Defaults to the simple view: full detail (e.g. the effective-rate column)
  // is behind the explicit toggle, per CLAUDE.md.
  const simpleHtml = renderToString(
    <Dashboard
      thisYear={SAMPLE_THIS_YEAR}
      pastFilings={SAMPLE_PAST_FILINGS}
      onAddPastFiling={noop}
      onRemovePastFiling={noop}
      onGoToFiling={noop}
      onChangeDeduction={noop}
      onChangeFigure={noop}
      onChangeRemittancePurpose={noop}
      showAdvanced={false}
      onToggleAdvanced={noop}
    />
  );
  assertIncludes(simpleHtml, "Your tax dashboard");
  assertIncludes(simpleHtml, "This year: AY 2026-27");
  // The this-year panel is a visual command centre, distinct from the Results
  // working view: an ITR-form badge + tax-year timeline, and the five widgets.
  assertIncludes(simpleHtml, "Recommended form");
  assertIncludes(simpleHtml, "FY 2025-26");
  assertIncludes(simpleHtml, "New vs old regime");
  assertIncludes(simpleHtml, "New regime saves about");
  // Break-even deductions surface on the regime widget (a headline number + a
  // progress bar of entered deductions vs the break-even target).
  assertIncludes(simpleHtml, "Break-even deductions");
  assertIncludes(simpleHtml, "Capital gains by type");
  assertIncludes(simpleHtml, "Tax-free LTCG left");
  assertIncludes(simpleHtml, "Deductions used");
  assertIncludes(simpleHtml, "80CCD(1B)");
  // The 80C bar can carry home-loan principal from the Loans section: it
  // shows in the meter's note without becoming part of the editable field.
  const with80cExtraHtml = renderToString(
    <Dashboard
      thisYear={{
        ...SAMPLE_THIS_YEAR,
        deductions: SAMPLE_THIS_YEAR.deductions.map((deduction) =>
          deduction.key === "deduction80C"
            ? {
                ...deduction,
                extra: 80000,
                extraNote:
                  "Includes ₹80,000 of home-loan principal from the Loans section - it counts inside this ceiling, not on top."
              }
            : deduction
        )
      }}
      pastFilings={SAMPLE_PAST_FILINGS}
      onAddPastFiling={noop}
      onRemovePastFiling={noop}
      onGoToFiling={noop}
      onChangeDeduction={noop}
      onChangeFigure={noop}
      onChangeRemittancePurpose={noop}
      showAdvanced={false}
      onToggleAdvanced={noop}
    />
  );
  assertIncludes(with80cExtraHtml, "home-loan principal from the Loans section");
  assertIncludes(simpleHtml, "AIS / TDS match");
  assertIncludes(simpleHtml, "mismatch");
  // A conic-gradient donut (no charting dependency) renders the gains split.
  assertIncludes(simpleHtml, "conic-gradient");
  // The old plain-number restatements of Results must be gone from here.
  if (simpleHtml.includes("Recommended ITR form") || simpleHtml.includes("Gains this year")) {
    throw new Error(
      "Dashboard should no longer duplicate the Results-style plain stat grid ('Recommended ITR form'/'Gains this year')."
    );
  }
  assertIncludes(simpleHtml, "Your filing history");
  // Year-over-year history table renders both synthetic years and their heads.
  assertIncludes(simpleHtml, "Assessment year");
  assertIncludes(simpleHtml, "Gross total income");
  assertIncludes(simpleHtml, "2023-24");
  assertIncludes(simpleHtml, "2024-25");
  assertIncludes(simpleHtml, "From JSON");
  assertIncludes(simpleHtml, "Entered");
  // Income-growth insight is derived, not fabricated: 1.0M -> 1.2M = +20%.
  assertIncludes(simpleHtml, "+20%");
  assertIncludes(simpleHtml, "Show Full Detail");
  if (simpleHtml.includes("Show Simple View")) {
    throw new Error(
      "Dashboard should default to the simple view; advanced detail must require the explicit toggle."
    );
  }
  if (simpleHtml.includes(">Effective rate<")) {
    throw new Error(
      "The per-year effective-rate column is advanced detail and should be hidden in the simple view."
    );
  }

  const advancedHtml = renderToString(
    <Dashboard
      thisYear={SAMPLE_THIS_YEAR}
      pastFilings={SAMPLE_PAST_FILINGS}
      onAddPastFiling={noop}
      onRemovePastFiling={noop}
      onGoToFiling={noop}
      onChangeDeduction={noop}
      onChangeFigure={noop}
      onChangeRemittancePurpose={noop}
      showAdvanced
      onToggleAdvanced={noop}
    />
  );
  assertIncludes(advancedHtml, ">Effective rate<");
  assertIncludes(advancedHtml, "Effective tax rate over time");

  // Foreign widget: the LRS purpose selector renders all three Section
  // 206C(1G) rate branches, and the education-loan-funded branch reports the
  // exemption instead of a 20% figure.
  const foreignHtml = renderToString(
    <Dashboard
      thisYear={{
        ...SAMPLE_THIS_YEAR,
        foreignInvestments: {
          ...SAMPLE_THIS_YEAR.foreignInvestments,
          applies: true,
          remittance: 1_500_000,
          purpose: "education_loan_funded",
          rate: 0,
          estimatedTcs: 0,
          overThreshold: true
        }
      }}
      pastFilings={SAMPLE_PAST_FILINGS}
      onAddPastFiling={noop}
      onRemovePastFiling={noop}
      onGoToFiling={noop}
      onChangeDeduction={noop}
      onChangeFigure={noop}
      onChangeRemittancePurpose={noop}
      showAdvanced={false}
      onToggleAdvanced={noop}
    />
  );
  assertIncludes(foreignHtml, "Investment, gift, or anything else");
  assertIncludes(foreignHtml, "Education or medical treatment");
  assertIncludes(foreignHtml, "Education, funded by an education loan");
  assertIncludes(foreignHtml, "fully exempt from LRS TCS");

  // Empty state: one obvious next action (the add form is open).
  const emptyHtml = renderToString(
    <Dashboard
      thisYear={{ ...SAMPLE_THIS_YEAR, hasStartedFiling: false }}
      pastFilings={[]}
      onAddPastFiling={noop}
      onRemovePastFiling={noop}
      onGoToFiling={noop}
      onChangeDeduction={noop}
      onChangeFigure={noop}
      onChangeRemittancePurpose={noop}
      showAdvanced={false}
      onToggleAdvanced={noop}
    />
  );
  assertIncludes(emptyHtml, "No past years yet");
  assertIncludes(emptyHtml, "Add a past year");
  assertIncludes(emptyHtml, "Prefill From ITR JSON");
  // The add-past-filing upload now also accepts an ITR-V acknowledgement PDF.
  assertIncludes(emptyHtml, "ITR-V PDF");
  assertIncludes(emptyHtml, "Start This Year");

  console.log(
    "Validated dashboard destination: this-year panel, year-over-year history table + derived growth, JSON/manual add form, simple-by-default with advanced toggle."
  );
}

function checkItrJsonParsing() {
  // Synthetic ITR JSON in the income-tax portal's nested shape - not real data.
  const sampleItrJson = JSON.stringify({
    ITR: {
      ITR2: {
        Form_ITR2: { FormName: "ITR2", AssessmentYear: "2024" },
        "PartB-TI": { GrossTotalIncome: 1_200_000, TotalIncome: 1_150_000 },
        PartB_TTI: {
          TaxPaid: { TaxesPaid: { TotalTaxesPaid: 90_000 } },
          Refund: { RefundDue: 5_000 }
        },
        FilingStatus: { OptOutNewTaxRegime: "Y" }
      }
    }
  });
  const parsed = parseItrJson(sampleItrJson);
  if (!parsed.ok) {
    throw new Error(`Expected the synthetic ITR JSON to parse, got: ${parsed.message}`);
  }
  if (parsed.fields.assessmentYear !== "2024-25") {
    throw new Error(`Expected AY 2024-25 from "2024", got ${parsed.fields.assessmentYear}.`);
  }
  if (parsed.fields.itrForm !== "ITR-2") {
    throw new Error(`Expected ITR-2 form, got ${parsed.fields.itrForm}.`);
  }
  if (parsed.fields.grossTotalIncome !== 1_200_000) {
    throw new Error(
      `Expected gross total income 1,200,000, got ${parsed.fields.grossTotalIncome}.`
    );
  }
  if (parsed.fields.totalTaxPaid !== 90_000) {
    throw new Error(`Expected total tax paid 90,000, got ${parsed.fields.totalTaxPaid}.`);
  }
  if (parsed.fields.refundOrPayable !== 5_000) {
    throw new Error(`Expected a 5,000 refund, got ${parsed.fields.refundOrPayable}.`);
  }
  if (parsed.fields.regime !== "old") {
    throw new Error(
      `OptOutNewTaxRegime "Y" should read as the old regime, got ${parsed.fields.regime}.`
    );
  }
  // Tolerant fallback: unreadable input never throws, routes to manual entry.
  const garbage = parseItrJson("not json at all {");
  if (garbage.ok || garbage.readFields.length !== 0) {
    throw new Error(
      "Unreadable input should come back ok:false with no auto-read fields, for manual entry."
    );
  }
  if (normalizeAssessmentYear("AY2025-2026") !== "2025-26") {
    throw new Error("normalizeAssessmentYear should tidy 'AY2025-2026' to '2025-26'.");
  }

  const insights = deriveHistoryInsights(SAMPLE_PAST_FILINGS);
  if (insights.incomeGrowthPct === null || Math.round(insights.incomeGrowthPct) !== 20) {
    throw new Error(
      `Expected +20% income growth across the sample years, got ${insights.incomeGrowthPct}.`
    );
  }
  if (!insights.regimeSwitched) {
    throw new Error("Sample filings switch old -> new regime; regimeSwitched should be true.");
  }

  console.log(
    "Validated ITR-JSON parsing + history metrics: tolerant field extraction, manual-entry fallback, deterministic growth/effective-rate/regime-switch derivation. No PDF parser."
  );
}

function checkItrVTextParsing() {
  // Synthetic ITR-V acknowledgement text, shaped like what pdf.js extraction
  // yields (labels then values on one run) - never real data, per CLAUDE.md.
  const sampleItrVText = [
    "INDIAN INCOME TAX RETURN ACKNOWLEDGEMENT",
    "Assessment Year 2024-25",
    "ITR Form Number ITR-2",
    "Whether opting for new tax regime u/s 115BAC ? No",
    "Gross Total Income 12,00,000",
    "Total Income 11,50,000",
    "Total Taxes Paid 90,000",
    "Refund 5,000",
    "This is ITR-V, the acknowledgement of your e-filed return."
  ].join(" ");
  const parsed = parseItrVText(sampleItrVText);
  if (!parsed.ok) {
    throw new Error(`Expected the synthetic ITR-V text to parse, got: ${parsed.message}`);
  }
  if (parsed.fields.assessmentYear !== "2024-25") {
    throw new Error(`Expected AY 2024-25 from the ITR-V, got ${parsed.fields.assessmentYear}.`);
  }
  if (parsed.fields.itrForm !== "ITR-2") {
    throw new Error(
      `Expected ITR-2 (not the "ITR-V" label) from the acknowledgement, got ${parsed.fields.itrForm}.`
    );
  }
  if (parsed.fields.grossTotalIncome !== 1_200_000) {
    throw new Error(
      `Expected gross total income 1,200,000 from "12,00,000", got ${parsed.fields.grossTotalIncome}.`
    );
  }
  if (parsed.fields.totalTaxPaid !== 90_000) {
    throw new Error(`Expected total taxes paid 90,000, got ${parsed.fields.totalTaxPaid}.`);
  }
  if (parsed.fields.refundOrPayable !== 5_000) {
    throw new Error(`Expected a 5,000 refund, got ${parsed.fields.refundOrPayable}.`);
  }
  if (parsed.fields.regime !== "old") {
    throw new Error(
      `"new tax regime ... No" should read as the old regime, got ${parsed.fields.regime}.`
    );
  }

  // A payable (not refund) ITR-V: negative refundOrPayable, and regime read
  // from the 115BAC phrasing this time.
  const payableItrV = parseItrVText(
    "Assessment Year 2023-24 ITR-1 Opting for section 115BAC Yes Gross Total Income 800000 Net Tax Payable 12500"
  );
  if (payableItrV.fields.refundOrPayable !== -12_500) {
    throw new Error(
      `Expected -12,500 (payable) from the ITR-V, got ${payableItrV.fields.refundOrPayable}.`
    );
  }
  if (payableItrV.fields.regime !== "new") {
    throw new Error(
      `"115BAC ... Yes" should read as the new regime, got ${payableItrV.fields.regime}.`
    );
  }

  // Tolerant fallback: unreadable text never throws, routes to manual entry.
  const unreadable = parseItrVText(
    "just some scanned image text with no recognisable ITR figures at all"
  );
  if (unreadable.ok || unreadable.readFields.length !== 0) {
    throw new Error(
      "Unreadable ITR-V text should come back ok:false with no auto-read fields, for manual entry."
    );
  }
  const empty = parseItrVText("   ");
  if (empty.ok) {
    throw new Error(
      "Empty ITR-V text (e.g. an image-only scan) should not report a successful read."
    );
  }

  console.log(
    "Validated ITR-V text parsing: tolerant label/regex extraction of AY/form/income/tax/refund/regime, refund vs payable sign, and a graceful manual-entry fallback on unreadable or empty text. No PDF table parser."
  );
}

function checkWelcomeDisclaimerBanner() {
  const html = renderToString(
    <WelcomeScreen
      onStart={noop}
      onStartComputationFirst={noop}
      onResume={noop}
      onStartOver={noop}
      hasSavedSession={false}
      onShowCapabilities={noop}
      onShowTour={noop}
      localFolderSupported={false}
      onRestoreFromFolder={noop}
      onImportPreviousWorkbook={noop}
    />
  );
  assertIncludes(html, WELCOME_DISCLAIMER_BANNER);
  assertIncludes(html, 'class="welcome-disclaimer-banner"');
  assertIncludes(html, "Got It");
  console.log(
    "Validated welcome disclaimer banner: Stage-1 dismissible CA line renders on first visit."
  );
}

function checkErrorBoundaryRecovery() {
  const html = renderToString(
    <ErrorBoundary>
      <p>App content</p>
    </ErrorBoundary>
  );
  assertIncludes(html, "App content");
  const source = readFileSync(
    resolve(import.meta.dirname, "../src/components/ErrorBoundary.tsx"),
    "utf8"
  );
  for (const phrase of [
    "Something went wrong",
    "Your filing may still be saved in this browser",
    "Reload This Page",
    "Report An Issue"
  ]) {
    if (!source.includes(phrase)) {
      throw new Error(`ErrorBoundary is missing recovery copy: ${phrase}`);
    }
  }
  console.log(
    "Validated error boundary: wraps app content and ships recovery copy for uncaught render errors."
  );
}

function assertIncludes(value: string, expected: string) {
  if (!value.includes(expected)) {
    throw new Error(`Rendered output is missing: ${expected}`);
  }
}

export function main() {
  checkWelcomeScreen();
  checkWelcomeDisclaimerBanner();
  checkErrorBoundaryRecovery();
  checkComputationFirstPathIsReachable();
  checkSideNavReflectsResumedSession();
  checkToolTour();
  checkHelpPanel();
  checkCapabilitiesPanel();
  checkOrientationForm();
  checkNriOrientationAndDtaa();
  checkItrFormSelection();
  checkUploadStep();
  checkRegimeComparisonPanel();
  checkChecklistPanel();
  checkResultsStepDefaultsToSimple();
  checkResultsStepAdvancedToggle();
  checkSummaryFiguresPopulateFields();
  checkResultsStepSummaryPrefill();
  checkAdvanceTaxPanel();
  checkNriHufSingleParentPartialCalculations();
  checkInsurancePolicyPanel();
  checkReconciliationPanel();
  checkConfidenceReportPanel();
  checkDashboardDestination();
  checkItrJsonParsing();
  checkItrVTextParsing();
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main();
}
