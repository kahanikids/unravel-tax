import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import {
  buildCaSummaryCsvExport,
  buildCaSummaryWorkbookExport,
  buildFullWorkbookExport,
  brokerGainCheck,
  rateInputsFromRule,
  buildChecklist,
  caOrSelfFileRecommendation,
  caSummaryRows,
  checklistGaps,
  compareRegimes,
  computeRegimeBreakEven,
  chooseLocalFolder,
  buildConfidenceReport,
  clearSession,
  clubbedMinorIncome,
  computeForeignRemittanceTcs,
  computeInsurancePayoutCheck,
  computeLoanDeductions,
  deriveProfileFlags,
  downloadExport,
  evaluateRiskTriggers,
  figureMismatches,
  ITR_FORM_REASONS,
  REPO_URL,
  REPORT_ISSUE_URL,
  SCOPE_AND_DISCLAIMER_NOTE,
  isLocalFolderSupported,
  loadSession,
  newFilingId,
  parseSession,
  profileScopeCaveats as deriveProfileScopeCaveats,
  readTextFromFolder,
  saveDocumentCopyToFolder,
  saveExportToFolder,
  saveSession,
  serializeSession,
  applySummaryFiguresToSupplemental,
  SESSION_BACKUP_FILENAME,
  writeFileToFolder,
  selectItrForm,
  summarizeWithRules,
  tdsMismatches,
  transactionsCsv,
  type ChecklistItem,
  type ExportFile,
  type FilingSource,
  type LocalFolderHandle,
  type PastFiling,
  type PastFilingFields,
  type PersistedSession,
  type RawSheet,
  type TdsRow
} from "./lib";
import type { ExtractionSummaryFigures, NormalizedTransaction } from "./ingest";
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
import { CountdownBanner } from "./components/CountdownBanner";
import { OrientationForm } from "./components/OrientationForm";
import { ChecklistPanel } from "./components/ChecklistPanel";
import { UploadStep, type UploadedDocument } from "./components/UploadStep";
import { ResultsStep } from "./components/ResultsStep";
import { SideNav } from "./components/SideNav";
import { Dashboard, type ThisYearSnapshot } from "./components/Dashboard";
import { HelpPanel } from "./components/HelpPanel";
import { CapabilitiesPanel } from "./components/CapabilitiesPanel";
import { ToolTour } from "./components/ToolTour";
import { ConfirmModal } from "./components/ConfirmModal";

type DocumentEntry = UploadedDocument & { transactions: NormalizedTransaction[]; rawSheet?: RawSheet };

function App() {
  const [step, setStep] = useState<AppStep>("welcome");
  const [orientation, setOrientation] = useState<OrientationAnswers>(BLANK_ORIENTATION);
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [supplementalFigures, setSupplementalFigures] = useState<SupplementalFigures>(BLANK_SUPPLEMENTAL_FIGURES);
  // Which "A few more numbers" fields were auto-filled from a pasted statement
  // (drives the check-these banner on the results screen). Ephemeral UI hint:
  // not persisted, so a resumed session keeps the values but drops the banner.
  const [prefilledFigureKeys, setPrefilledFigureKeys] = useState<(keyof SupplementalFigures)[]>([]);
  // A pasted statement gave a net realised gain with no per-transaction detail:
  // flagged so the results screen can say the detailed statement is still needed.
  const [netGainMissingDetail, setNetGainMissingDetail] = useState(false);
  const [aisFigures, setAisFigures] = useState<AisReportedFigures>(BLANK_AIS_REPORTED_FIGURES);
  const [tdsRows, setTdsRows] = useState<TdsRow[]>([]);
  const [sampleMode, setSampleMode] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("unravel-tax-view") === "advanced"
  );
  // Footer disclaimer collapses on mobile only (see styles.css); mirrors the
  // ChecklistPanel pattern - starts collapsed at the mobile/tablet breakpoint,
  // and the toggle + is-collapsed rule are scoped inside @media so desktop is
  // always fully expanded regardless of this state.
  const [footerCollapsed, setFooterCollapsed] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 860
  );
  const [exportMessage, setExportMessage] = useState("Exports are generated in this browser. Nothing is uploaded anywhere.");
  const [acknowledgedTriggerIds, setAcknowledgedTriggerIds] = useState<string[]>([]);
  // Read once on mount and shared below, so a saved session isn't parsed
  // out of localStorage twice on first render.
  const [initialSession] = useState(() => loadSession());
  const [hasSavedSession, setHasSavedSession] = useState(() => initialSession !== null);
  // Year-over-year filing history for the dashboard. Seeded from any saved
  // session on mount so history survives a reload without a Resume click.
  const [pastFilings, setPastFilings] = useState<PastFiling[]>(() => initialSession?.pastFilings ?? []);
  // The dashboard is a standalone destination outside STEP_ORDER (see
  // SideNav): a separate toggle rather than an AppStep, so opening it never
  // disturbs the linear guided flow's step pointer or its single next action.
  const [showDashboard, setShowDashboard] = useState(false);
  const [folderHandle, setFolderHandle] = useState<LocalFolderHandle | null>(null);
  const [showCapabilities, setShowCapabilities] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  // Width (px) of the left checklist column on the documents/results stage.
  // Driven by dragging the vertical handle between the two cards; clamped in
  // startPanelResize. A CSS var carries it so the mobile media query can
  // cleanly override it with a single-column layout.
  const [panelWidth, setPanelWidth] = useState(300);

  const startPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = panelWidth;
    handle.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => {
      const max = Math.min(520, window.innerWidth * 0.5);
      const next = startWidth + (moveEvent.clientX - startX);
      setPanelWidth(Math.max(260, Math.min(max, next)));
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  };
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
    // A pristine welcome screen isn't worth saving, unless the user has added
    // dashboard history (past filings) - that should persist on its own even
    // before this year's filing is started.
    if (sampleMode || (step === "welcome" && pastFilings.length === 0)) {
      return;
    }
    const timer = window.setTimeout(() => {
      const input = {
        step,
        furthestStepIndex,
        orientation,
        documents,
        supplementalFigures,
        acknowledgedTriggerIds,
        aisFigures,
        tdsRows,
        pastFilings
      };
      saveSession(input);
      // The folder is a disk-durable backup: write the same session there so
      // it can be recovered even if the browser's storage is wiped.
      if (folderHandle) {
        writeFileToFolder(
          folderHandle,
          SESSION_BACKUP_FILENAME,
          new Blob([serializeSession(input)], { type: "application/json" })
        ).catch(() => {
          // Non-fatal: localStorage still has it; the folder copy is a bonus.
        });
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    step,
    furthestStepIndex,
    orientation,
    documents,
    supplementalFigures,
    acknowledgedTriggerIds,
    aisFigures,
    tdsRows,
    pastFilings,
    sampleMode,
    folderHandle
  ]);

  const transactions = useMemo(() => documents.flatMap((document) => document.transactions), [documents]);
  const flags = useMemo(() => deriveProfileFlags(orientation), [orientation]);
  const hasBusinessIncome = useMemo(
    () => transactions.some((transaction) => transaction.taxClass === "Intraday"),
    [transactions]
  );
  const rulesSummary = useMemo(
    () => summarizeWithRules(transactions, ruleCatalog.capitalGainsEquity, ruleCatalog.itrFormSelection),
    [transactions]
  );
  // Total income for the ITR-1 Rs 50 lakh ceiling: the figures the app
  // actually knows (salary, interest, dividends the user typed, plus the
  // positive capital-gain buckets from documents). When nothing is entered
  // this stays low and the ceiling never trips - the safe direction.
  const totalIncomeForItr = useMemo(() => {
    const gains =
      Math.max(0, rulesSummary.stcg) +
      Math.max(0, rulesSummary.ltcg) +
      Math.max(0, rulesSummary.intradayGain) +
      Math.max(0, rulesSummary.debtMfShortTermDeemedGain);
    return supplementalFigures.salaryIncome + supplementalFigures.dividends + supplementalFigures.interestOtherIncome + gains;
  }, [rulesSummary, supplementalFigures]);
  const itrForm = useMemo(
    () => selectItrForm(flags, hasBusinessIncome, ruleCatalog.itrFormSelection, totalIncomeForItr),
    [flags, hasBusinessIncome, totalIncomeForItr]
  );
  const riskTriggers = useMemo(
    () => evaluateRiskTriggers(flags, hasBusinessIncome, itrForm, new Date()),
    [flags, hasBusinessIncome, itrForm]
  );
  const caRecommendation = useMemo(
    () => caOrSelfFileRecommendation(flags, riskTriggers, hasBusinessIncome),
    [flags, riskTriggers, hasBusinessIncome]
  );
  const checklistItems: ChecklistItem[] = useMemo(
    () => buildChecklist(flags, transactions.length > 0),
    [flags, transactions.length]
  );
  const scopeCaveats = useMemo(() => deriveProfileScopeCaveats(flags), [flags]);
  const gaps = useMemo(() => checklistGaps(checklistItems), [checklistItems]);

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
        "Entered by you under \"A few more numbers\" on the Current Filing page. NRE account interest is exempt from Indian income tax entirely, so it's kept separate here rather than folded into the taxable \"Interest & other income\" row above."
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
      notes: `Entered by you under "A few more numbers" on the Current Filing page. The minor's income minus a ₹${perChild.toLocaleString("en-IN")} exemption per child (Section 10(32)), added to your income under Section 64(1A). Goes in Schedule SPI, not as an income row of its own.`
    });
  }

  const calculationSummary = {
    ...rulesSummary,
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
  // The checking value from the broker's own sheet: when a statement carried
  // its own gain/taxable column, compare its per-bucket sum against our
  // computed (sale - cost) figures. Tolerance of Rs 1 absorbs broker rounding;
  // a real difference usually means the broker netted charges we kept gross.
  const brokerCheck = useMemo(
    () => brokerGainCheck(transactions, ruleCatalog.capitalGainsEquity),
    [transactions]
  );
  const brokerExpectedFigures: Record<string, number> = {};
  const brokerReportedFigures: Record<string, number> = {};
  if (brokerCheck) {
    for (const entry of brokerCheck.perClass) {
      if (entry.computed === 0 && entry.broker === 0) {
        continue;
      }
      brokerExpectedFigures[entry.label] = entry.computed;
      brokerReportedFigures[entry.label] = entry.broker;
    }
  }

  const reconciliationMismatches = [
    ...figureMismatches(aisExpectedFigures, aisReportedFiguresPresent, "AIS/Form 26AS"),
    ...(brokerCheck
      ? figureMismatches(brokerExpectedFigures, brokerReportedFigures, `Broker's own "${brokerCheck.columnName}" column`, 1)
      : []),
    ...tdsMismatches(tdsRows)
  ];

  const openIssueCount = gaps.length + riskTriggers.length + reconciliationMismatches.length;

  // The AIS/TDS/broker variance summary the dashboard gauge shows: how many
  // figures were actually compared, how many mismatched, and the total gap.
  // "from what you've entered vs AIS figures" - manual entry only, no sync.
  const varianceCheckCount =
    Object.keys(aisExpectedFigures).length +
    tdsRows.length +
    (brokerCheck ? brokerCheck.perClass.filter((entry) => entry.computed !== 0 || entry.broker !== 0).length : 0);
  const varianceTotalAbs = reconciliationMismatches.reduce((sum, mismatch) => sum + Math.abs(mismatch.difference), 0);

  // Old vs new regime, computed the same way the Results panel does - only
  // when there's a salary to compare and it fits the profile (not an HUF).
  const regimeComparable = supplementalFigures.salaryIncome > 0 && !flags.huf;
  // Loan-interest deductions (capped per rules/loan-treatment.json) add to the
  // old-regime side of the comparison, the same way the Results panel does it.
  const loanDeductionsTotal = computeLoanDeductions(supplementalFigures, ruleCatalog.loanTreatment).total;
  const regimeInputs = {
    salaryIncome: supplementalFigures.salaryIncome,
    dividends: supplementalFigures.dividends,
    interestOtherIncome: supplementalFigures.interestOtherIncome,
    eligibleInterestDeduction: supplementalFigures.eligibleInterestDeduction,
    debtMfShortTermDeemedGain: rulesSummary.debtMfShortTermDeemedGain,
    intradayGain: rulesSummary.intradayGain,
    oldRegimeDeductions: supplementalFigures.oldRegimeDeductions + loanDeductionsTotal,
    seniorCitizen: flags.seniorCitizen
  };
  const regimeResult = regimeComparable ? compareRegimes(regimeInputs, ruleCatalog.regimeChoice) : null;
  const regimeBreakEven = regimeComparable ? computeRegimeBreakEven(regimeInputs, ruleCatalog.regimeChoice) : null;

  // Deduction ceilings come from rules/deduction-limits.json, never hardcoded
  // here (CLAUDE.md). The 80D limit steps up when a senior citizen is covered.
  const deductionLimits = ruleCatalog.deductionLimits.values;

  // Insurance-payout (10(10D)) premium-cap check and foreign LRS-TCS check,
  // both computed off the same figures the dashboard owns, with every rupee
  // limit read from the rule JSON (rules/insurance.json, rules/foreign-investments.json).
  const insurancePayoutCheck = computeInsurancePayoutCheck(supplementalFigures, ruleCatalog.insurance);
  const foreignRemittanceTcs = computeForeignRemittanceTcs(supplementalFigures, ruleCatalog.foreignInvestments);
  const foreignScheduleFa = ruleCatalog.foreignInvestments.values.schedule_fa_disclosure;

  // Everything the dashboard's "this year at a glance" shows, computed
  // deterministically from the same figures the results view uses. The
  // dashboard only displays it - no separate calculation lives there.
  const thisYear: ThisYearSnapshot = {
    hasStartedFiling: documents.length > 0 || orientation.residency !== null,
    financialYear: ruleCatalog.itrFormSelection.financial_year,
    assessmentYear: `AY ${ruleCatalog.itrFormSelection.assessment_year}`,
    itrForm: itrForm.form,
    itrDueDate: itrForm.dueDate,
    regimeNote: ruleCatalog.regimeChoice.values.new_regime_default
      ? "New regime by default"
      : "Old regime by default",
    capitalGains: {
      stcg: rulesSummary.stcg,
      ltcg: rulesSummary.ltcg,
      debtMf: rulesSummary.debtMfShortTermDeemedGain,
      intraday: rulesSummary.intradayGain,
      ltcgExemptionLimit: ruleCatalog.capitalGainsEquity.values.listed_equity.ltcg_exemption_inr
    },
    estimatedCapitalGainsTax: rulesSummary.estimatedStcgTax + rulesSummary.estimatedLtcgTax,
    regime: {
      comparable: regimeComparable,
      newRegimeTax: regimeResult?.newRegimeTax ?? 0,
      oldRegimeTax: regimeResult?.oldRegimeTax ?? 0,
      cheaper: regimeResult?.cheaperRegime ?? "equal",
      saving: regimeResult?.difference ?? 0,
      breakEvenDeductions: regimeBreakEven?.breakEvenDeductions ?? 0,
      actualDeductions: regimeBreakEven?.actualDeductions ?? 0,
      newAlwaysWins: regimeBreakEven?.newAlwaysWins ?? false
    },
    deductions: [
      {
        key: "deduction80C",
        section: "80C",
        label: "Section 80C investments",
        used: supplementalFigures.deduction80C,
        limit: deductionLimits.section_80c.limit_inr
      },
      {
        key: "deduction80D",
        section: "80D",
        label: "Section 80D health cover",
        used: supplementalFigures.deduction80D,
        limit: flags.seniorCitizen
          ? deductionLimits.section_80d.self_family_senior_citizen_inr
          : deductionLimits.section_80d.self_family_below_60_inr
      },
      {
        key: "deductionNps80ccd1b",
        section: "80CCD(1B)",
        label: "NPS extra deduction",
        used: supplementalFigures.deductionNps80ccd1b,
        limit: deductionLimits.section_80ccd_1b_nps.limit_inr
      }
    ],
    insurance: {
      ...insurancePayoutCheck,
      applies: flags.hasInsurancePayout,
      sourceRefs: ruleCatalog.insurance.source_refs
    },
    foreignInvestments: {
      ...foreignRemittanceTcs,
      applies: flags.hasForeignAssets,
      scheduleFaMinValueInr: foreignScheduleFa.minimum_value_threshold_inr,
      requiresItrForms: foreignScheduleFa.requires_itr_form,
      blackMoneyPenaltyInr: ruleCatalog.foreignInvestments.values.black_money_act_penalties.non_disclosure_penalty_inr,
      sourceRefs: ruleCatalog.foreignInvestments.source_refs
    },
    variance: {
      checkCount: varianceCheckCount,
      mismatchCount: reconciliationMismatches.length,
      totalAbsVariance: varianceTotalAbs
    }
  };

  // A single pre-export confidence check: the same signals shown throughout
  // the flow (checklist, risk triggers, reconciliation, scope caveats),
  // regrouped by how urgently each one matters before you export.
  const confidenceReport = buildConfidenceReport({
    checklistGaps: gaps,
    riskTriggers,
    mismatches: reconciliationMismatches,
    scopeCaveats
  });

  // Sample mode fills orientation/documents with demo data and pauses
  // autosaving. Leaving it for a real path must clear that demo data too,
  // or the first autosave after the switch writes sample transactions over
  // the user's real saved filing.
  function clearSampleData() {
    if (!sampleMode) {
      return;
    }
    setSampleMode(false);
    setOrientation(BLANK_ORIENTATION);
    setDocuments([]);
    setSupplementalFigures(BLANK_SUPPLEMENTAL_FIGURES);
    setPrefilledFigureKeys([]);
    setNetGainMissingDetail(false);
    setAcknowledgedTriggerIds([]);
    setAisFigures(BLANK_AIS_REPORTED_FIGURES);
    setTdsRows([]);
  }

  function startOrientation() {
    clearSampleData();
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
    clearSampleData();
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
    // A real document added while viewing sample data starts a real filing:
    // drop the demo transactions instead of mixing them into real numbers.
    if (sampleMode) {
      clearSampleData();
      setDocuments([{ fileName, rowCount: newTransactions.length, transactions: newTransactions }]);
    } else {
      setDocuments((prev) => [...prev, { fileName, rowCount: newTransactions.length, transactions: newTransactions }]);
    }
    if (folderHandle) {
      saveDocumentCopyToFolder(folderHandle, fileName, transactionsCsv(newTransactions)).catch(() => {
        setExportMessage(`Could not save a copy of ${fileName} to your chosen folder. It's still added to your filing.`);
      });
    }
  }

  // A raw upload that isn't a capital-gains statement (bank interest,
  // dividends, MF holdings). Kept with no transactions so it never affects the
  // tax numbers, but its rows ride along as a reference sheet in the workbook.
  function commitReferenceDocument(fileName: string, rawSheet: RawSheet) {
    const entry: DocumentEntry = { fileName, rowCount: rawSheet.records.length, transactions: [], rawSheet };
    if (sampleMode) {
      clearSampleData();
      setDocuments([entry]);
    } else {
      setDocuments((prev) => [...prev, entry]);
    }
  }

  function removeDocument(index: number) {
    setDocuments((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  // A pasted summary statement (PMS annual report, AIS) with no per-transaction
  // rows but real annual totals: route each recognised figure to its existing
  // "A few more numbers" home and remember which ones we touched, so the results
  // screen can flag them for a check. TDS lands in advanceTaxPaid ("TDS +
  // instalments already paid"), the leanest existing field for it - no new
  // schema. netRealisedGainNoDetail is never routed into a figure; it only sets
  // the missing-detail flag. Merge rule: fill a field only when it's still 0, so
  // a number the user already typed is never clobbered or doubled.
  function applySummaryFigures(figures: ExtractionSummaryFigures, netGainOnly: boolean) {
    const { next, applied } = applySummaryFiguresToSupplemental(supplementalFigures, figures);
    if (applied.length > 0) {
      setSupplementalFigures(next);
      setPrefilledFigureKeys((prev) => Array.from(new Set([...prev, ...applied])));
    }
    if (netGainOnly) {
      setNetGainMissingDetail(true);
    }
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
    setPastFilings(session.pastFilings ?? []);
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

  // "Start over" always confirms before wiping a saved filing, since it's
  // destructive and localStorage is the only copy unless a folder backup exists.
  function startFresh() {
    setShowConfirmClear(true);
  }

  function clearAllProgress() {
    clearSession();
    setOrientation(BLANK_ORIENTATION);
    setDocuments([]);
    setSupplementalFigures(BLANK_SUPPLEMENTAL_FIGURES);
    setPrefilledFigureKeys([]);
    setNetGainMissingDetail(false);
    setAcknowledgedTriggerIds([]);
    setAisFigures(BLANK_AIS_REPORTED_FIGURES);
    setTdsRows([]);
    setPastFilings([]);
    setSampleMode(false);
    setShowDashboard(false);
    setFurthestStepIndex(0);
    setShowConfirmClear(false);
    setHasSavedSession(false);
    setStep("welcome");
  }

  // From the dashboard's "this year" panel back into the linear flow: resume
  // the furthest step already reached, or start orientation if nothing has
  // been started yet. goToStep handles hydration + closing the dashboard.
  function goToFilingFromDashboard() {
    if (furthestStepIndex <= 0) {
      setShowDashboard(false);
      startOrientation();
      return;
    }
    goToStep(STEP_ORDER[furthestStepIndex]);
  }

  function addPastFiling(fields: PastFilingFields, source: FilingSource) {
    setPastFilings((prev) => [...prev, { ...fields, id: newFilingId(), source }]);
  }

  function removePastFiling(id: string) {
    setPastFilings((prev) => prev.filter((filing) => filing.id !== id));
  }

  // The dashboard's deduction-progress widget writes each figure straight back
  // to the shared session state (it owns this planning input the same way it
  // owns past-filing entry), so it persists and stays a single source of truth.
  function changeDeduction(key: "deduction80C" | "deduction80D" | "deductionNps80ccd1b", value: number) {
    setSupplementalFigures((prev) => ({ ...prev, [key]: value }));
  }

  // Same single-source-of-truth path as changeDeduction, for the insurance
  // premium-cap and foreign LRS-TCS planning figures the dashboard now owns.
  function changeFigure(key: "insuranceAnnualPremium" | "foreignRemittanceLrs", value: number) {
    setSupplementalFigures((prev) => ({ ...prev, [key]: value }));
  }

  /** Only ever jumps to a step the user has already reached - never a way to skip ahead. */
  function goToStep(target: AppStep) {
    if (STEP_ORDER.indexOf(target) > furthestStepIndex) {
      return;
    }
    // Navigating into the linear flow always leaves the standalone dashboard.
    setShowDashboard(false);
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

  // Recovery path: point at a previously-used folder and restore the filing
  // from its backup, even after browser storage was wiped. Picking the folder
  // is the permission grant the browser requires; there's no silent auto-load.
  async function restoreFromFolder() {
    const handle = await chooseLocalFolder();
    if (!handle) {
      return;
    }
    setFolderHandle(handle);
    const session = parseSession(await readTextFromFolder(handle, SESSION_BACKUP_FILENAME));
    if (!session) {
      setExportMessage(`No saved filing found in "${handle.name}". New documents will be saved there from now on.`);
      return;
    }
    hydrateSession(session);
    setFurthestStepIndex(session.furthestStepIndex ?? STEP_ORDER.indexOf(session.step));
    setStep(session.step);
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
    const cgRule = ruleCatalog.capitalGainsEquity;
    await deliverExport(
      await buildFullWorkbookExport({
        documents: documents.map(({ fileName, transactions: docTxns, rawSheet }) => ({
          name: fileName,
          transactions: docTxns,
          rawSheet
        })),
        caSummaryRows: rows,
        rateInputs: rateInputsFromRule(cgRule),
        financialYear: `FY${cgRule.financial_year}`,
        assessmentYear: `AY${cgRule.assessment_year}`
      })
    );
  }

  return (
    <div className="app-frame">
      <SideNav
        current={step}
        furthestIndex={furthestStepIndex}
        onNavigate={goToStep}
        onShowDashboard={() => setShowDashboard(true)}
        dashboardActive={showDashboard}
        onShowHelp={() => setShowHelp(true)}
        onShowCapabilities={() => setShowCapabilities(true)}
        onShowTour={() => setShowTour(true)}
        onShowLegal={() => goToStep("welcome")}
      />
      <main className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="brand-mark-button"
          onClick={() => {
            setShowDashboard(false);
            setStep("welcome");
          }}
          aria-label="Back to home"
        >
          <img
            src={`${import.meta.env?.BASE_URL ?? "/"}unravel-tax-logo.png`}
            alt="Unravel Tax"
            className="brand-mark"
          />
        </button>
        {!showDashboard && step === "welcome" ? <CountdownBanner variant="header" /> : null}
        <HelpPanel open={showHelp} onOpenChange={setShowHelp} />
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

      {showDashboard ? (
        <div className="stage-single">
          <Dashboard
            thisYear={thisYear}
            pastFilings={pastFilings}
            onAddPastFiling={addPastFiling}
            onRemovePastFiling={removePastFiling}
            onGoToFiling={goToFilingFromDashboard}
            onChangeDeduction={changeDeduction}
            onChangeFigure={changeFigure}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced((value) => !value)}
          />
        </div>
      ) : null}

      {!showDashboard && step === "welcome" ? (
        <div className="stage-single">
          <WelcomeScreen
            onStart={startOrientation}
            onStartComputationFirst={startComputationFirst}
            onResume={resumeSession}
            onStartOver={startFresh}
            hasSavedSession={hasSavedSession}
            onShowCapabilities={() => setShowCapabilities(true)}
            onShowTour={() => setShowTour(true)}
            localFolderSupported={isLocalFolderSupported()}
            onRestoreFromFolder={restoreFromFolder}
          />
        </div>
      ) : null}

      {!showDashboard && step === "orientation" ? (
        <div className="stage-single">
          <OrientationForm
            answers={orientation}
            onChange={setOrientation}
            onComplete={() => setStep("documents")}
          />
        </div>
      ) : null}

      {!showDashboard &&
      (step === "documents" || step === "results") &&
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

      {!showDashboard && (step === "documents" || step === "results") ? (
        <div
          className="stage-with-sidebar"
          style={{ "--panel-width": `${panelWidth}px` } as CSSProperties}
        >
          <ChecklistPanel
            checklistItems={checklistItems}
            riskTriggers={riskTriggers}
            profileScopeCaveats={scopeCaveats}
          />

          <div
            className="stage-resizer"
            role="separator"
            aria-orientation="vertical"
            onPointerDown={startPanelResize}
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

            {step === "documents" ? (
              <UploadStep
                documents={displayDocuments}
                onCommit={commitDocument}
                onCommitReference={commitReferenceDocument}
                onApplySummaryFigures={applySummaryFigures}
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
                prefilledFigureKeys={prefilledFigureKeys}
                netGainMissingDetail={netGainMissingDetail}
                debtMfShortTermDeemedGain={calculationSummary.debtMfShortTermDeemedGain}
                intradayGain={calculationSummary.intradayGain}
                seniorCitizen={flags.seniorCitizen}
                nri={flags.nri}
                huf={flags.huf}
                singleParent={flags.singleParent}
                hasLoans={flags.hasLoans}
                regimeChoiceRule={ruleCatalog.regimeChoice}
                loanTreatmentRule={ruleCatalog.loanTreatment}
                advanceTaxRule={ruleCatalog.advanceTax}
                aisFigures={aisFigures}
                onChangeAisFigures={setAisFigures}
                tdsRows={tdsRows}
                onChangeTdsRows={setTdsRows}
                brokerCheck={brokerCheck}
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
        <button
          type="button"
          className="footer-disclaimer-toggle"
          aria-expanded={!footerCollapsed}
          aria-controls="footer-disclaimer-body"
          onClick={() => setFooterCollapsed((value) => !value)}
        >
          Disclaimer
          <svg className="checklist-toggle-icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d={footerCollapsed ? "M4 6l4 4 4-4" : "M4 10l4-4 4 4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div
          id="footer-disclaimer-body"
          className={footerCollapsed ? "footer-collapsible is-collapsed" : "footer-collapsible"}
        >
          <div className="footer-inner">
            <div className="footer-meta">
              <p className="footer-scope-note">{SCOPE_AND_DISCLAIMER_NOTE}</p>
              <p className="footer-privacy">Runs locally in your browser; nothing is uploaded.</p>
            </div>
            <nav className="footer-links" aria-label="Project and legal links">
              <div className="footer-disclaimer-link">
                <button type="button" className="footer-link" onClick={() => goToStep("welcome")}>
                  Full disclaimer, AI use &amp; privacy
                </button>
                <span className="footer-disclaimer-hint">Please read before you blindly rely on this tool</span>
              </div>
              <a className="footer-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                Source on GitHub
              </a>
              <a className="footer-link" href={REPORT_ISSUE_URL} target="_blank" rel="noopener noreferrer">
                Report an issue
              </a>
            </nav>
          </div>
          <p className="footer-baseline">Free and open source, MIT licensed.</p>
        </div>
      </footer>
      </main>
    </div>
  );
}

export default App;
