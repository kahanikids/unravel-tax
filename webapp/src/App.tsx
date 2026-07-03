import { useEffect, useState } from "react";
import {
  buildCaSummaryCsvExport,
  buildCaSummaryWorkbookExport,
  buildFullWorkbookExport,
  buildChecklist,
  caOrSelfFileRecommendation,
  caSummaryRows,
  checklistGaps,
  chooseLocalFolder,
  classifyTransactionWithRules,
  buildConfidenceReport,
  clearSession,
  clubbedMinorIncome,
  deriveProfileFlags,
  downloadExport,
  evaluateRiskTriggers,
  figureMismatches,
  FOOTER_NOTE,
  ITR_FORM_REASONS,
  SCOPE_AND_DISCLAIMER_NOTE,
  isLocalFolderSupported,
  loadSession,
  profileScopeCaveats as deriveProfileScopeCaveats,
  saveDocumentCopyToFolder,
  saveExportToFolder,
  saveSession,
  selectItrForm,
  summarizeWithRules,
  tdsMismatches,
  transactionsCsv,
  type ChecklistItem,
  type ExportFile,
  type LocalFolderHandle,
  type PersistedSession,
  type TdsRow
} from "./lib";
import type { NormalizedTransaction } from "./ingest";
import { ruleCatalog } from "./rules";
import {
  BLANK_AIS_REPORTED_FIGURES,
  BLANK_ORIENTATION,
  BLANK_SUPPLEMENTAL_FIGURES,
  STEP_ORDER,
  type AisReportedFigures,
  type AppStep,
  type OrientationAnswers,
  type SupplementalFigures
} from "./state/types";
import { fixtureTransactions } from "./demo/sampleState";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { OrientationForm } from "./components/OrientationForm";
import { ChecklistPanel } from "./components/ChecklistPanel";
import { UploadStep, type UploadedDocument } from "./components/UploadStep";
import { ResultsStep } from "./components/ResultsStep";
import { SideNav } from "./components/SideNav";
import { HelpPanel } from "./components/HelpPanel";
import { CapabilitiesPanel } from "./components/CapabilitiesPanel";
import { ToolTour } from "./components/ToolTour";
import { DocumentSourceHint } from "./components/DocumentSourceHint";
import { ConfirmModal } from "./components/ConfirmModal";

type DocumentEntry = UploadedDocument & { transactions: NormalizedTransaction[] };

function App() {
  const [step, setStep] = useState<AppStep>("welcome");
  const [orientation, setOrientation] = useState<OrientationAnswers>(BLANK_ORIENTATION);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [supplementalFigures, setSupplementalFigures] = useState<SupplementalFigures>(BLANK_SUPPLEMENTAL_FIGURES);
  const [aisFigures, setAisFigures] = useState<AisReportedFigures>(BLANK_AIS_REPORTED_FIGURES);
  const [tdsRows, setTdsRows] = useState<TdsRow[]>([]);
  const [sampleMode, setSampleMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("unravel-tax-view") === "advanced"
  );
  const [exportMessage, setExportMessage] = useState("Exports are generated in this browser. Nothing is uploaded anywhere.");
  const [acknowledgedTriggerIds, setAcknowledgedTriggerIds] = useState<string[]>([]);
  // Read once on mount and shared below, so a saved session isn't parsed
  // out of localStorage twice on first render.
  const [initialSession] = useState(() => loadSession());
  const [hasSavedSession] = useState(() => initialSession !== null);
  const [folderHandle, setFolderHandle] = useState<LocalFolderHandle | null>(null);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  // Every step the user has already reached this filing stays reachable from
  // the side nav - lets them jump back to the checklist/documents/results
  // without restarting, without ever offering to skip ahead to a step they
  // haven't gotten to yet. Seeded from any saved session on mount, not just
  // 0, so the side nav shows real progress on the welcome screen even
  // before "Resume" is clicked (e.g. after a reload/crash lands back there).
  const [furthestStepIndex, setFurthestStepIndex] = useState(() =>
    initialSession ? initialSession.furthestStepIndex ?? STEP_ORDER.indexOf(initialSession.step) : 0
  );

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("unravel-tax-view", showAdvanced ? "advanced" : "simple");
    }
  }, [showAdvanced]);

  useEffect(() => {
    setFurthestStepIndex((prev) => Math.max(prev, STEP_ORDER.indexOf(step)));
  }, [step]);

  // BUILD_PLAN.md Section 9: localStorage is a resume convenience only, never
  // the system of record - skip it on the welcome screen and for sample data
  // so a demo run never overwrites someone's real in-progress filing.
  useEffect(() => {
    if (step === "welcome" || sampleMode) {
      return;
    }
    saveSession({
      step,
      furthestStepIndex,
      orientation,
      documents,
      supplementalFigures,
      acknowledgedTriggerIds,
      aisFigures,
      tdsRows
    });
  }, [
    step,
    furthestStepIndex,
    orientation,
    documents,
    supplementalFigures,
    acknowledgedTriggerIds,
    aisFigures,
    tdsRows,
    sampleMode
  ]);

  const transactions = documents.flatMap((document) => document.transactions);
  const flags = deriveProfileFlags(orientation);
  const hasBusinessIncome = transactions.some(
    (transaction) => classifyTransactionWithRules(transaction, ruleCatalog.capitalGainsEquity) === "Intraday"
  );
  const itrForm = selectItrForm(flags, hasBusinessIncome, ruleCatalog.itrFormSelection);
  const riskTriggers = evaluateRiskTriggers(flags, hasBusinessIncome, itrForm, new Date());
  const caRecommendation = caOrSelfFileRecommendation(flags, riskTriggers, hasBusinessIncome);
  const checklistItems: ChecklistItem[] = buildChecklist(flags, transactions.length > 0);
  const scopeCaveats = deriveProfileScopeCaveats(flags);

  // BUILD_PLAN.md Section 1.4: form-changing/recommendation-changing triggers get a
  // hard-block popup, not just inline sidebar text. Show one the first time each
  // such trigger appears; acknowledging it dismisses only that trigger, so a later,
  // newly-fired one still stops the user again.
  const unacknowledgedFormChangingTriggers = riskTriggers.filter(
    (trigger) => trigger.severity === "form-changing" && !acknowledgedTriggerIds.includes(trigger.id)
  );

  const baseRows = caSummaryRows(transactions, ruleCatalog.capitalGainsEquity, ruleCatalog.itrFormSelection, supplementalFigures);
  const rows = baseRows.map((row) => {
    if (row.head === "Recommended ITR form") {
      return {
        ...row,
        amount: itrForm.form,
        notes: ITR_FORM_REASONS[itrForm.key] ?? "Personalized to your NRI/HUF/business-income profile."
      };
    }
    if (row.head === "CA review recommendation") {
      return { ...row, amount: caRecommendation.headline, notes: caRecommendation.reason };
    }
    return row;
  });

  // Profile-specific partial calculations (WORKING_PLAN.md Current Next
  // Slice item 3): shown as their own rows rather than folded into the
  // generic ones above, since each only applies to one profile.
  if (flags.nri) {
    rows.push({
      head: "NRE interest (exempt)",
      ruleSection: "10(4)(ii)",
      amount: supplementalFigures.nreExemptInterest,
      notes:
        "Entered by you under \"A few more numbers\" below. NRE account interest is exempt from Indian income tax entirely, so it's kept separate here rather than folded into the taxable \"Interest & other income\" row above."
    });
  }
  if (flags.singleParent) {
    const perChild = ruleCatalog.singleParentClubbing.values.per_child_exemption_inr;
    rows.push({
      head: "Minor's income clubbed",
      ruleSection: "64(1A)",
      amount: clubbedMinorIncome(
        supplementalFigures.minorIncomeToClub,
        supplementalFigures.numberOfMinors,
        ruleCatalog.singleParentClubbing
      ),
      notes: `Entered by you under "A few more numbers" below. The minor's income minus a ₹${perChild.toLocaleString("en-IN")} exemption per child (Section 10(32)), added to your income under Section 64(1A). Goes in Schedule SPI, not as an income row of its own.`
    });
  }

  const calculationSummary = {
    ...summarizeWithRules(transactions, ruleCatalog.capitalGainsEquity, ruleCatalog.itrFormSelection),
    recommendedItrForm: itrForm.form,
    caReviewRecommendation: caRecommendation.headline
  };

  const displayDocuments: UploadedDocument[] = documents.map(({ fileName, rowCount }) => ({ fileName, rowCount }));

  // BUILD_PLAN.md Section 4: reconciliation runs on every dashboard view, not
  // only on request, so any AIS/26AS/Form 16 figure the user has typed in
  // feeds straight into the same open-issue count as missing documents and
  // risk triggers.
  const aisExpectedFigures: Record<string, number> = {};
  const aisReportedFiguresPresent: Record<string, number> = {};
  if (aisFigures.dividends !== null) {
    aisExpectedFigures.Dividends = supplementalFigures.dividends;
    aisReportedFiguresPresent.Dividends = aisFigures.dividends;
  }
  if (aisFigures.interestOtherIncome !== null) {
    aisExpectedFigures["Interest & other income"] = supplementalFigures.interestOtherIncome;
    aisReportedFiguresPresent["Interest & other income"] = aisFigures.interestOtherIncome;
  }
  const reconciliationMismatches = [
    ...figureMismatches(aisExpectedFigures, aisReportedFiguresPresent, "AIS/Form 26AS"),
    ...tdsMismatches(tdsRows)
  ];

  const openIssueCount = checklistGaps(checklistItems).length + riskTriggers.length + reconciliationMismatches.length;

  // A single pre-export confidence check: the same signals shown throughout
  // the flow (checklist, risk triggers, reconciliation, scope caveats),
  // regrouped by how urgently each one matters before you export.
  const confidenceReport = buildConfidenceReport({
    checklistGaps: checklistGaps(checklistItems),
    riskTriggers,
    mismatches: reconciliationMismatches,
    scopeCaveats
  });

  function startOrientation() {
    setSampleMode(false);
    setStep("orientation");
  }

  // "Add documents": the least-friction path that still produces
  // correct numbers. caSummaryRows() only reads transactions and rules, never
  // orientation answers, so capital gains/dividends/interest figures are
  // right immediately. What DOES depend on orientation (ITR form, risk
  // triggers, CA recommendation, checklist) just falls back to the
  // resident/no-special-circumstances default until the user goes back and
  // answers the questions, which they can always do from the step nav.
  function startComputationFirst() {
    setSampleMode(false);
    setStep("documents");
  }

  function trySampleData() {
    setSampleMode(true);
    setOrientation({
      ...BLANK_ORIENTATION,
      residency: "resident",
      huf: false,
      seniorCitizen: false,
      singleParent: false,
      incomeSources: ["capital_gains", "dividends", "bank_interest"],
      multipleEmployers: false,
      hraClaimed: false,
      epfWithdrawal: false
    });
    setDocuments([
      {
        fileName: "sample-broker-statement.csv (sample data)",
        rowCount: fixtureTransactions.length,
        transactions: fixtureTransactions
      }
    ]);
    setStep("results");
  }

  function commitDocument(newTransactions: NormalizedTransaction[], fileName: string) {
    setDocuments((prev) => [...prev, { fileName, rowCount: newTransactions.length, transactions: newTransactions }]);
    if (folderHandle) {
      saveDocumentCopyToFolder(folderHandle, fileName, transactionsCsv(newTransactions)).catch(() => {
        setExportMessage(`Could not save a copy of ${fileName} to your chosen folder. It's still added to your filing.`);
      });
    }
  }

  function removeDocument(index: number) {
    setDocuments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  // Shared by the "Resume" button and by clicking a side-nav step while
  // still on welcome (a saved session's real data, not just its step
  // pointer): loads everything except step/furthestStepIndex, which each
  // caller sets to wherever it's actually navigating.
  function hydrateSession(session: PersistedSession) {
    setOrientation(session.orientation);
    setDocuments(session.documents);
    // Merge over defaults: sessions saved before salaryIncome/oldRegimeDeductions
    // existed won't have them, and a missing number would break the regime
    // comparison's inputs rather than just showing as zero.
    setSupplementalFigures({ ...BLANK_SUPPLEMENTAL_FIGURES, ...session.supplementalFigures });
    setAcknowledgedTriggerIds(session.acknowledgedTriggerIds);
    setAisFigures(session.aisFigures ?? BLANK_AIS_REPORTED_FIGURES);
    setTdsRows(session.tdsRows ?? []);
    setSampleMode(false);
  }

  function resumeSession() {
    const session = loadSession();
    if (!session) {
      return;
    }
    hydrateSession(session);
    setFurthestStepIndex(session.furthestStepIndex ?? STEP_ORDER.indexOf(session.step));
    setStep(session.step);
  }

  function startFresh() {
    if (step !== "welcome") {
      setShowConfirmClear(true);
      return;
    }
    clearAllProgress();
  }

  function clearAllProgress() {
    clearSession();
    setOrientation(BLANK_ORIENTATION);
    setDocuments([]);
    setSupplementalFigures(BLANK_SUPPLEMENTAL_FIGURES);
    setAcknowledgedTriggerIds([]);
    setAisFigures(BLANK_AIS_REPORTED_FIGURES);
    setTdsRows([]);
    setSampleMode(false);
    setFurthestStepIndex(0);
    setShowConfirmClear(false);
    setStep("welcome");
  }

  /** Only ever jumps to a step the user has already reached - never a way to skip ahead. */
  function goToStep(target: AppStep) {
    if (STEP_ORDER.indexOf(target) > furthestStepIndex) {
      return;
    }
    // furthestStepIndex on welcome only comes from a saved session (see its
    // initializer above) - React state hasn't loaded that session's actual
    // orientation/documents/etc yet unless "Resume" was clicked, so clicking
    // a side-nav step directly from welcome needs to hydrate that data now.
    if (step === "welcome" && target !== "welcome") {
      const session = loadSession();
      if (session) {
        hydrateSession(session);
      }
    }
    setStep(target);
  }

  async function handleChooseFolder() {
    const handle = await chooseLocalFolder();
    if (handle) {
      setFolderHandle(handle);
      setExportMessage(`Files will now be saved to "${handle.name}" on your computer as you go.`);
    }
  }

  async function deliverExport(file: ExportFile) {
    if (folderHandle) {
      await saveExportToFolder(folderHandle, file);
      setExportMessage(`✓ ${file.filename} saved to "${folderHandle.name}" on your computer.`);
      return;
    }
    downloadExport(file);
    setExportMessage(`✓ ${file.filename} generated in this browser.`);
  }

  function acknowledgeFormChangingTriggers() {
    setAcknowledgedTriggerIds((prev) => [
      ...prev,
      ...unacknowledgedFormChangingTriggers.map((trigger) => trigger.id)
    ]);
  }

  async function exportCaSummaryCsv() {
    await deliverExport(await buildCaSummaryCsvExport(rows));
  }

  async function exportCaSummaryWorkbook() {
    await deliverExport(await buildCaSummaryWorkbookExport(rows));
  }

  async function exportFullWorkbook() {
    await deliverExport(
      await buildFullWorkbookExport({
        caSummaryRows: rows,
        transactions,
        calculationSummary,
        checklistItems,
        tdsRows,
        openIssueCount
      })
    );
  }

  return (
    <div className="app-frame">
      <SideNav current={step} furthestIndex={furthestStepIndex} onNavigate={goToStep} />
      <main className="app-shell">
      <header className="app-header">
        <button type="button" className="brand-mark-button" onClick={() => setStep("welcome")} aria-label="Back to home">
          <img
            src={`${import.meta.env?.BASE_URL ?? "/"}unravel-tax-logo.png`}
            alt="Unravel Tax"
            className="brand-mark"
          />
        </button>
        <HelpPanel />
      </header>

      <CapabilitiesPanel open={showCapabilities} onClose={() => setShowCapabilities(false)} />
      <ToolTour open={showTour} onClose={() => setShowTour(false)} onTrySample={trySampleData} />
      {showConfirmClear ? (
        <ConfirmModal
          message="Clear everything you've entered in this browser and start over?"
          confirmLabel="Clear and start over"
          onConfirm={clearAllProgress}
          onCancel={() => setShowConfirmClear(false)}
        />
      ) : null}

      {step === "welcome" ? (
        <div className="stage-single">
          <WelcomeScreen
            onStart={startOrientation}
            onStartComputationFirst={startComputationFirst}
            onResume={resumeSession}
            hasSavedSession={hasSavedSession}
            onShowCapabilities={() => setShowCapabilities(true)}
            onShowTour={() => setShowTour(true)}
          />
        </div>
      ) : null}

      {step === "orientation" ? (
        <div className="stage-single">
          <OrientationForm
            answers={orientation}
            onChange={setOrientation}
            onComplete={() => setStep("checklist")}
            onStartOver={startFresh}
          />
        </div>
      ) : null}

      {(step === "checklist" || step === "documents" || step === "results") &&
      unacknowledgedFormChangingTriggers.length > 0 ? (
        <div className="modal-backdrop">
          <div className="modal-card" role="alertdialog" aria-labelledby="form-changing-title">
            <h3 id="form-changing-title">This changes what you need to file</h3>
            <p>Worth stopping for. These change your ITR form or your self-file/CA recommendation, not just a routine note:</p>
            <ul className="trigger-list">
              {unacknowledgedFormChangingTriggers.map((trigger) => (
                <li key={trigger.id}>
                  <strong>{trigger.label}</strong>
                  <p>{trigger.consequence}</p>
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={acknowledgeFormChangingTriggers}>
                I understand, continue
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "checklist" || step === "documents" || step === "results" ? (
        <div className="stage-with-sidebar">
          <ChecklistPanel
            checklistItems={checklistItems}
            riskTriggers={riskTriggers}
            profileScopeCaveats={scopeCaveats}
          />

          <div className="stage-main">
            {sampleMode ? <p className="sample-banner">You're viewing sample data. Nothing here is real.</p> : null}

            {!sampleMode && orientation.residency === null ? (
              <p className="defaults-banner">
                You skipped the questions, so this checklist and recommendation use default assumptions: resident,
                no special circumstances.{" "}
                <button type="button" className="text-button" onClick={() => setStep("orientation")}>
                  Answer them now
                </button>{" "}
                for a more accurate one.
              </p>
            ) : null}

            {step === "checklist" ? (
              <div className="step-card">
                <h2>Your checklist</h2>
                <p className="step-lede">What to gather, based on your answers. Easiest first.</p>
                <div className="checklist-list">
                  {checklistItems.map((item) => (
                    <article className="checklist-list-item" key={item.document}>
                      <div>
                        <strong>{item.document}</strong>
                        <p>{item.whyNeeded}</p>
                        <DocumentSourceHint document={item.document} />
                      </div>
                      <span className={`pill ${item.status.toLowerCase() === "loaded" ? "pill-ready" : "pill-neutral"}`}>
                        {item.status}
                      </span>
                    </article>
                  ))}
                </div>
                <div className="step-actions">
                  <button type="button" className="primary-button" onClick={() => setStep("documents")}>
                    Continue to add documents
                  </button>
                </div>
              </div>
            ) : null}

            {step === "documents" ? (
              <UploadStep
                documents={displayDocuments}
                onCommit={commitDocument}
                onRemove={removeDocument}
                onContinue={() => setStep("results")}
                localFolderSupported={isLocalFolderSupported()}
                localFolderName={folderHandle?.name ?? null}
                onChooseLocalFolder={handleChooseFolder}
              />
            ) : null}

            {step === "results" ? (
              <ResultsStep
                rows={rows}
                documents={displayDocuments}
                openIssueCount={openIssueCount}
                caRecommendation={caRecommendation}
                supplementalFigures={supplementalFigures}
                onChangeSupplementalFigures={setSupplementalFigures}
                debtMfShortTermDeemedGain={calculationSummary.debtMfShortTermDeemedGain}
                intradayGain={calculationSummary.intradayGain}
                seniorCitizen={flags.seniorCitizen}
                nri={flags.nri}
                huf={flags.huf}
                singleParent={flags.singleParent}
                regimeChoiceRule={ruleCatalog.regimeChoice}
                advanceTaxRule={ruleCatalog.advanceTax}
                aisFigures={aisFigures}
                onChangeAisFigures={setAisFigures}
                tdsRows={tdsRows}
                onChangeTdsRows={setTdsRows}
                confidenceReport={confidenceReport}
                showAdvanced={showAdvanced}
                onToggleAdvanced={() => setShowAdvanced((value) => !value)}
                exportMessage={exportMessage}
                onExportCsv={exportCaSummaryCsv}
                onExportXlsx={exportCaSummaryWorkbook}
                onExportFullWorkbook={exportFullWorkbook}
                localFolderSupported={isLocalFolderSupported()}
                localFolderName={folderHandle?.name ?? null}
                onChooseLocalFolder={handleChooseFolder}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <footer className="app-footer">
        <p className="footer-scope-note">{SCOPE_AND_DISCLAIMER_NOTE}</p>
        <p>{FOOTER_NOTE}</p>
      </footer>
      </main>
    </div>
  );
}

export default App;
