/**
 * Single source for copy that appears in more than one place, so wording
 * stays in sync instead of drifting across components. Disclaimer copy comes
 * in three lengths, shortest to longest: SCOPE_AND_DISCLAIMER_NOTE is the one
 * short year-scope-plus-CA line in the footer on every screen; DISCLAIMER_FULL
 * is the "?" help panel's mid-length version; LEGAL_SECTIONS (below) is the
 * full, structured legal text shown in the welcome screen's collapsible
 * disclaimer. Each is a deliberate step up in detail, not a duplicate - so the
 * footer line stays crisp and defers non-affiliation, "as is", privacy, and
 * the rest to the linked full disclaimer rather than repeating them.
 */

export const SCOPE_AND_DISCLAIMER_NOTE =
  "For FY 2025-26 (AY 2026-27) filings. Not tax advice, and not a substitute for a CA.";

/** Stage-1 welcome banner (BUILD_PLAN.md §1.4): dismissible, remembered in localStorage. */
export const WELCOME_DISCLAIMER_BANNER = "This organizes your numbers. It does not replace a CA.";

export const FOOTER_NOTE =
  "Open source, so fixes and suggestions are always welcome. It can get things wrong, so check the numbers before you file and let your CA take it from there. Nothing is stored anywhere; it all runs locally, in your browser.";

/** First-time extraction method picker (UploadStep). Keep these short: they render in compact cards. */
export type ExtractionMethodOption = {
  id: "frontier" | "browser" | "openrouter";
  label: string;
  takes: string;
  gives: string;
  accuracy: string;
  time: string;
  effort: string;
  data: string;
};

export const EXTRACTION_METHOD_OPTIONS: ExtractionMethodOption[] = [
  {
    id: "frontier",
    label: "Frontier AI",
    takes: "ChatGPT, Claude, Gemini + copy-paste",
    gives: "Best shot for messy reports",
    accuracy: "Highest",
    time: "A few minutes",
    effort: "Manual",
    data: "Leaves your browser"
  },
  {
    id: "browser",
    label: "Open-Source Llama 3.2 3B",
    takes: "WebGPU + 2 GB download + smaller context window",
    gives: "Private first try. If it misses info, use Frontier AI.",
    accuracy: "Meta IFEval 77.4",
    time: "2-10 min first run",
    effort: "One click",
    data: "Stays with you"
  },
  {
    id: "openrouter",
    label: "OpenRouter Nemotron",
    takes: "OpenRouter key + network",
    gives: "Automatic extraction with Nemotron",
    accuracy: "Testing now",
    time: "30 sec-2 min",
    effort: "One click",
    data: "Sent to OpenRouter"
  }
];

export const REPORT_ISSUE_URL = "https://github.com/kahanikids/unravel-tax/issues/new/choose";

export const REPO_URL = "https://github.com/kahanikids/unravel-tax";

/**
 * Consolidated legal/disclaimer content shown in the collapsible section at the
 * bottom of the welcome screen. Structured (heading + plain-language
 * paragraphs) so it renders once and stays the single source of truth, rather
 * than being duplicated as long prose in the footer. Substance is written to
 * be legally clear; framing is kept plain so a non-technical filer can follow
 * it. Accuracy of the AI and Privacy sections matters most - both describe
 * what the code actually does (client-side parsing for structured files, optional
 * in-browser Llama extraction or a copy-paste prompt for PDFs/free text,
 * deterministic tax maths, nothing sent to any server by the app).
 */
export type LegalSection = { heading: string; paragraphs: string[] };

export const LEGAL_INTRO: { label: string; text: string }[] = [
  {
    label: "What this tool is",
    text: "A friendly helper that gathers and organizes your own tax numbers, on your own device, into files that you and your CA can use."
  },
  {
    label: "What this is not",
    text: "It isn't tax advice, and it isn't a replacement for a CA. Please review the numbers yourself, or have your CA review the final numbers, so they tally with your original documents."
  }
];

export const LEGAL_SECTIONS: LegalSection[] = [
  {
    heading: "Disclaimer / No professional advice",
    paragraphs: [
      "This tool is built for Indian income tax filings for the financial year 2025-26 (assessment year 2026-27) only. Rates, thresholds, and due dates for other years are not covered.",
      "It is an independent, open-source project. It is not a government service and is not affiliated with, endorsed by, or connected to the Income Tax Department, the Central Board of Direct Taxes (CBDT), or the Ministry of Finance.",
      "It organizes and calculates from the information you provide. It does not give tax, legal, financial, or accounting advice, and it is not a substitute for a Chartered Accountant (CA) or other qualified professional. Whether a particular treatment applies to your situation is a judgement only a professional can make for you.",
      'Everything here is provided "as is", without warranties of any kind, express or implied, including accuracy, completeness, or fitness for a particular purpose. To the fullest extent permitted by law, the authors and contributors accept no liability for any loss, penalty, interest, or damage arising from using, or being unable to use, this tool. You are responsible for checking every figure and confirming it on incometax.gov.in before you file.'
    ]
  },
  {
    heading: "Not a government service",
    paragraphs: [
      "This tool does not connect to, submit to, or file anything with the Income Tax Department. It never logs into the e-filing portal on your behalf. Filing your return, and confirming your figures against your official AIS, Form 26AS, and the portal, remains something you do yourself or through your CA."
    ]
  },
  {
    heading: "AI / LLM tools used, and for what",
    paragraphs: [
      "Tax calculations are always deterministic: they run from versioned rule files and plain formulas in your browser, and are never done by an AI or language model.",
      "LLM Options are used for one narrow job only: reading data out of documents that are not already structured. CSV, Excel, and saved-webpage (HTML) statements are parsed directly in your browser without needing LLM extraction. PDFs and free-form / unstructured text need that extraction step because reports are not standardised enough for reliable native parsing.",
      "On supported browsers (WebGPU), you can run that extraction here with Llama 3.2 3B entirely on your device. The model weights download once, and nothing is sent to any server. Alternatively, you can use OpenRouter with your own API key to run Nemotron 3 Nano 30B A3B; document text is sent from your browser directly to OpenRouter. If neither suits you, the app still offers a copy-paste prompt you can run in whichever AI chat you choose (ChatGPT, Claude, Gemini, and so on).",
      "Because the AI only ever reads and transcribes numbers into a table you then review and edit, it never decides your tax. You confirm every extracted row before it is used."
    ]
  },
  {
    heading: "Privacy",
    paragraphs: [
      'Everything runs locally in your browser. There is no account, no sign-up, no server, and no analytics or tracking. Nothing you enter is uploaded to or stored by us, because there is no "us" server to store it on.',
      "Your in-progress filing is saved only in this browser's local storage as a convenience so you can resume later, and, on supported browsers, optionally to a folder you choose on your own computer for backup. Both stay on your device and you can clear them at any time.",
      "In-browser extraction keeps your document text on your machine. If you use OpenRouter, your document text and API key stay in this browser. The key is saved in local storage on your device only, but the text is sent from your browser directly to OpenRouter under their privacy policy. If you use the copy-paste fallback instead, pasting document contents into a third-party AI chat means that text is handled by that provider under their own privacy policy and terms, not ours. If a document is sensitive, review that provider's policy first, or use a structured format (CSV/Excel) that is parsed entirely in your browser instead."
    ]
  },
  {
    heading: "Data accuracy / your responsibility",
    paragraphs: [
      "The numbers come from documented tax rules, but software and source documents can both contain mistakes. Treat every output as a draft to be checked, not a final figure.",
      "You are responsible for the accuracy of what you enter and of what you ultimately file. Always reconcile against your AIS, Form 26AS, and Form 16, and have your CA review the results before you submit anything."
    ]
  },
  {
    heading: "Terms of use",
    paragraphs: [
      "You may use this tool freely, at your own risk. It is provided without any guarantee of correctness or availability, and the authors and contributors are not liable for how you use it or for the outcome of your filing.",
      "By using it you accept that it is a self-help organizing aid, that you remain responsible for verifying your numbers, and that final responsibility for your tax return rests with you and your professional adviser."
    ]
  },
  {
    heading: "Jurisdiction",
    paragraphs: [
      "Scope is Indian personal income tax only. It is not built for business or professional income that needs full bookkeeping, and it does not cover taxes of any other country."
    ]
  },
  {
    heading: "Open source, license & contributions",
    paragraphs: [
      "This is an open-source project. The source code is public, so you (or anyone) can inspect exactly how a number is calculated and how your data is handled. Fixes, corrections, and suggestions are welcome.",
      "The code is released under the license included in the project repository; your use of it is subject to that license."
    ]
  },
  {
    heading: "Contact / reporting issues",
    paragraphs: [
      "If a number looks wrong, a rule is out of date, or something could be clearer, please report it on the project's GitHub so it can be fixed for everyone."
    ]
  }
];

export const DISCLAIMER_FULL =
  "This is an open source project, not affiliated with the Income Tax Department, CBDT, or the Ministry of Finance. If something looks wrong or could be better, that feedback is welcome. The numbers come from documented tax rules, but mistakes happen, so always check the final numbers before you file and verify on incometax.gov.in. This tool organizes your data; it doesn't submit or complete your return, and it's not a substitute for a Chartered Accountant (CA), so send the results to yours for a final check. Nothing you enter is stored or sent anywhere: everything runs locally, in your browser.";

export const WHO_ITS_FOR_TAGLINE = "This is for you if:";

export const WHO_ITS_FOR: string[] = [
  "Tax season fills you with quiet dread",
  "You want to see your numbers before they land in your CA's inbox",
  "You're the nitpicky type who double-checks a total just because",
  "You actually keep last year's Form 16 somewhere findable"
];

export const WHO_ITS_FOR_EXCLUDES =
  "Intraday/speculative trading routes to ITR-3 and presumptive business income to ITR-4, but full bookkeeping, P&L, and audit schedules aren't built here. Firms, companies, trusts, and other non-individual entities (ITR-5/6/7) are out of scope.";

/**
 * Plain-language reason for each ITR form selection.values.forms key in
 * rules/itr-form-selection.json, so the results screen can say why a form
 * was picked instead of just naming it. Keys must stay in sync with that
 * rule file; selectItrForm() in lib/profile.ts is what actually chooses one.
 */
export const ITR_FORM_REASONS: Record<string, string> = {
  resident_simple:
    "Salary, interest, or dividends only, with no capital gains or business income detected, so ITR-1 (Sahaj) fits. This assumes none of the remaining ITR-1 disqualifiers this tool can't prove from your uploads apply: total income above ₹50 lakh, more than one house property, foreign income or assets not disclosed in About You, unlisted shares, being a company director, or a loss carried forward from an earlier year. If any of those apply, file ITR-2 instead.",
  resident_above_itr1_limit:
    "Your total income is above the ₹50 lakh ceiling for ITR-1 (Sahaj), so ITR-2 applies even though your income is only salary, interest, or dividends.",
  resident_capital_gains_or_clubbing:
    "Capital gains from your documents, declared non-listed-equity gains (property, crypto, unlisted/foreign shares, debt MF), or minor's-income clubbing from your profile need this form.",
  nri_no_business: "Your NRI status routes filing through this form, even without business income.",
  nri_with_business:
    "Your NRI status plus business or speculative income from your documents need this form.",
  huf_no_business: "Filing as a HUF routes through this form, even without business income.",
  huf_with_business:
    "Filing as a HUF plus business or speculative income from your documents need this form.",
  business_or_speculative_non_audit:
    "Your documents show speculative or intraday income, which counts as business income under this form.",
  presumptive_non_audit:
    "You told us your business or professional income is on the presumptive scheme (Section 44AD, 44ADA, or 44AE), total income is within ₹50 lakh, and you have no capital gains or foreign assets flagged, so ITR-4 (Sugam) fits. This tool does not compute presumptive turnover or audit thresholds, so confirm eligibility with your CA before filing.",
  huf_presumptive_non_audit:
    "Filing as a HUF with presumptive business income (Section 44AD, 44ADA, or 44AE) and total income within ₹50 lakh routes through ITR-4 (Sugam). Confirm presumptive eligibility with your CA."
};

export type HowToStep = { title: string; detail: string };

export const HOW_IT_WORKS: HowToStep[] = [
  { title: "About You", detail: "A few quick questions, plain language, no tax jargon." },
  {
    title: "Your checklist",
    detail: "Exactly what documents to gather, and why each one's needed."
  },
  {
    title: "Add Documents",
    detail: "Add them one at a time; confirm what we read before it's used."
  },
  {
    title: "Your results",
    detail: "What you owe, what's missing, and whether to self-file or get a CA."
  }
];

/**
 * "What can it do" step of the welcome tour (ToolTour): real jobs the tool
 * does for you, in plain language, not a restatement of the CAPABILITIES
 * feature list below. Keep each one grounded in something actually shipped.
 */
export const TOOL_TOUR_USE_CASES: string[] = [
  "Turns your broker, bank, and dividend statements into numbers a CA can check.",
  "Tells you exactly which documents you're still missing, and why.",
  "Flags the kind of mistakes that tend to trigger a tax notice, before you file.",
  "Hands you two files at the end: a short summary for your CA, and a full workbook to keep."
];

export type Capability = {
  label: string;
  status: "available" | "partial" | "planned";
  detail: string;
};

/**
 * Full scope list for the "What can this do?" panel: a pre-commitment
 * transparency check for a skeptical first-time user, not a feature they
 * have to act on. Keep this grounded in what's actually shipped vs. what's
 * only planned (see WORKING_PLAN.md's Current Next Slice and
 * SYSTEM_SPEC.md Section 14), the same honesty-about-scope standard as the
 * NRI/HUF scope caveats in lib/profile.ts. Update this list whenever a
 * planned item ships.
 */
export const CAPABILITIES: Capability[] = [
  {
    label: "Plain-language profile questions",
    status: "available",
    detail:
      "A few questions about residency, HUF, senior citizen, and single-parent status work out what applies to you, no tax category picking required."
  },
  {
    label: "Personalized document checklist",
    status: "available",
    detail:
      "Exactly what to gather for your profile, with guidance on where to get the trickier ones (broker statements, Form 26AS/AIS, and more)."
  },
  {
    label: "CSV, Excel, and saved-webpage ingestion",
    status: "available",
    detail:
      "Broker/AMC statements in these formats are read directly in your browser. Nothing is uploaded anywhere."
  },
  {
    label: "PDF extraction (in-browser, OpenRouter, or copy-paste)",
    status: "available",
    detail:
      "On WebGPU browsers, PDFs can be extracted here with an on-device Llama 3.2 3B model, or via OpenRouter's Nemotron route with your own API key. Otherwise, a copy-paste prompt for your own AI chat is available. The AI only reads documents; it never does the tax maths."
  },
  {
    label: "Capital gains, dividends, and interest calculations",
    status: "available",
    detail:
      "STCG/LTCG/intraday classification and Section 50AA debt mutual fund handling, computed from versioned rule files, not guessed."
  },
  {
    label: "Risk-trigger flags",
    status: "available",
    detail:
      "Multiple employers, HRA without a landlord PAN, early EPF withdrawal, late filing, and more, flagged with their real consequence before you see any totals."
  },
  {
    label: "ITR form and CA-vs-self-file recommendation",
    status: "available",
    detail:
      "Worked out from your profile, documents, and risk flags, including ITR-4 when presumptive taxation applies. Not left for you to guess."
  },
  {
    label: "CA Summary and full workbook exports",
    status: "available",
    detail:
      "One file to hand your CA, one detailed workbook to keep for your own FY 2025-26 records."
  },
  {
    label: "Everything stays on your device",
    status: "available",
    detail:
      "No account, no server. Your in-progress answers autosave in this browser only, and Chromium browsers can save straight to a folder you choose."
  },
  {
    label: "Free, hosted, no install",
    status: "available",
    detail:
      "Open the webapp link and start. Running it locally is still available for contributors who prefer that."
  },
  {
    label: 'Plain-language "why this number?" drilldown',
    status: "available",
    detail:
      "Every results row, plus the ITR form and CA/self-file call, has a short explanation of the rule or profile detail behind it."
  },
  {
    label: "AIS / Form 26AS / Form 16 reconciliation",
    status: "available",
    detail:
      "Type in what those documents show for dividends, interest, and TDS per source, and any mismatch against your calculated figures is flagged right away."
  },
  {
    label: "A final pre-export confidence check",
    status: "available",
    detail:
      "A single \"here's what's missing, what might change your numbers, and what's safe to ignore\" summary sits right above the export buttons."
  },
  {
    label: "Editable extraction review",
    status: "available",
    detail:
      "Fix a scrip name, date, or value right in the review table before it's added, or remove a single bad row, instead of discarding the whole document."
  },
  {
    label: "Old vs new tax regime comparison",
    status: "available",
    detail:
      "Enter your salary and old-regime deductions to see an estimate of which regime costs less, on the slab-taxed part of your income, including the 80+ super senior slab. Doesn't include surcharge yet."
  },
  {
    label: "Year-over-year tax dashboard",
    status: "available",
    detail:
      "A dashboard shows this year at a glance and can compare manually added past filings. Upload a previous year's ITR JSON or ITR-V PDF from the income-tax portal, or type the figures in, then see income growth, effective tax rate over time, and whether you've switched regimes."
  },
  {
    label: "Section 234B and 234C advance-tax interest estimator",
    status: "available",
    detail:
      "Enter total tax liability, tax already paid, and what you paid in each instalment window to estimate Section 234B interest and instalment-by-instalment Section 234C interest (with the 12%/36% safe harbours). The 234C figure is a whole-year ceiling: gains or dividends that arrived mid-year make the true figure lower, and the tool says so next to the number."
  },
  {
    label: "NRI, HUF, and single-parent coverage",
    status: "partial",
    detail:
      "These profiles get the right checklist, ITR routing, CA recommendation, and caveats. NRE exempt interest, minor-income clubbing (including income the law never clubs: the minor's own work/skill or an 80U disability), NRI dividend tax at the Section 115A/DTAA flat rate, an NRO interest/dividend TDS-vs-treaty-rate reconciliation, an NRO repatriation planning check (USD 1M cap, ₹5 lakh CA-certificate threshold, the renamed Form 145/146), and HUF Section 64(2) transfer clubbing (a member/coparcener list for the CA's reference, plus a note when a transfer without adequate consideration clubs income to the transferring member's own return) are calculated. NRO interest still uses ordinary slab rate rather than a precise treaty-capped figure, and HUF partition and Schedule SPI placement still need a CA."
  },
  {
    label: "Insurance payout and foreign-asset planning checks",
    status: "partial",
    detail:
      "The dashboard's aggregate-premium check is a quick planning signal. For a precise answer, the Results page's per-policy insurance section takes each policy's issue date, sum assured, premium history, and this year's payout, checks both the sum-assured-ratio and aggregate-premium tests, and computes the actual taxable amount - capital gains for a taxable ULIP (folded into the CA Summary), income from other sources for a taxable traditional policy (folded into the regime comparison's other income). It doesn't yet combine a taxable ULIP's gain with your other equity LTCG under the one shared annual exemption - that's flagged, not silently assumed. Foreign-asset checks (LRS TCS by remittance purpose) remain a disclosure reminder. The Schedule FA builder now covers two phases: Phase 1 produces disclosure rows for a foreign bank/brokerage account (a workbook sheet, interest folded automatically into slab income); Phase 2 computes real tax on a foreign share or vested RSU/ESPP sale (unlisted-share rates, the Section 17(2)(vi) vesting perquisite folded into salary), plus a Section 90/91 foreign tax credit estimate (Rule 128's average-rate method, a planning figure, not a Form 67 number). Foreign property, trusts, and a per-country credit breakdown aren't built."
  },
  {
    label: "Loans, home-loan principal, and a rented-out home",
    status: "available",
    detail:
      "Capped old-regime interest deductions for self-occupied home, 80EEA, 80E, and 80EEB loans; home-loan principal counted inside the shared 80C ceiling; and the full let-out house-property computation (30% standard deduction, uncapped interest, the ₹2 lakh loss set-off cap old regime, no set-off new regime), all folded into the regime comparison and the CA Summary. Business-use vehicle interest and multiple let-out properties are not modelled."
  },
  {
    label: "HUF partition tracking, Schedule FA Phase 3 (foreign trusts/property)",
    status: "planned",
    detail:
      "The remaining bigger gaps: HUF partition tracking (deliberately left uncalculated - a private partial partition is tax-invisible under Section 171(9), and this tool can't verify an Assessing Officer's total-partition order, so it's checklist-only), Schedule FA Phase 3 (foreign trusts and other assets, lower priority for this tool's audience), and a precise, per-country Section 90/91 foreign tax credit computation for actual Form 67/Schedule FSI/TR filing. Bring these to a CA for now."
  }
];

export type DocumentSource = { name: string; steps: string };

export type DocumentSourceGuide = { summary: string; sources: DocumentSource[] };

/**
 * "Where do I get this?" copy, keyed by the exact `document` string used in
 * lib/profile.ts#buildChecklist. Static reference copy, not an integration -
 * covers the handful of brokers/registrars/portals a first-time filer is
 * most likely to hit. Deliberately conservative: only document types where
 * "which website, which menu" is genuinely non-obvious to a first-time
 * filer get an entry here.
 */
export const DOCUMENT_SOURCE_GUIDE: Record<string, DocumentSourceGuide> = {
  "Broker/AMC capital gains statement": {
    summary:
      'Every broker and mutual fund registrar calls this something slightly different. Look for "Tax P&L" or "Capital Gains Statement", not your regular trade/contract note.',
    sources: [
      {
        name: "Zerodha",
        steps: "console.zerodha.com -> Reports -> Tax P&L -> pick the financial year -> download."
      },
      {
        name: "Groww",
        steps: "App/web -> Reports -> Tax P&L Statement -> select financial year -> download."
      },
      {
        name: "Upstox",
        steps: "Upstox Pro web -> Reports -> Tax P&L Report -> select financial year -> download."
      },
      {
        name: "ICICI Direct / HDFC Securities / Kotak Securities",
        steps:
          'Look under Portfolio or Reports for "Capital Gains Statement". Most full-service brokers name it exactly that.'
      },
      {
        name: "Mutual funds (any AMC)",
        steps:
          "CAMS (camsonline.com) or KFintech (mfsonline.kfintech.com) -> Statements -> Capital Gain Statement -> enter your PAN and registered email, a link is emailed to you. This covers funds across AMCs registered with that one registrar, so you may need both CAMS and KFintech."
      }
    ]
  },
  "Form 26AS / Annual Information Statement (AIS)": {
    summary: "Both come from the income tax e-filing portal, not your bank or broker.",
    sources: [
      {
        name: "Form 26AS",
        steps:
          "incometax.gov.in -> log in -> e-File -> Income Tax Returns -> View Form 26AS -> redirects to TRACES -> select the assessment year."
      },
      {
        name: "AIS",
        steps:
          "incometax.gov.in -> log in -> Services -> Annual Information Statement (AIS) -> opens the AIS portal -> download the AIS or TIS PDF/JSON for the year."
      }
    ]
  },
  "Dividend statement": {
    summary: "Dividends on shares and on mutual funds come from different places.",
    sources: [
      {
        name: "Shares (via your demat)",
        steps:
          "Your broker's console -> Reports -> Dividend/Corporate Actions statement, or check your demat's CDSL/NSDL e-mail alerts for each payout."
      },
      {
        name: "Mutual funds",
        steps:
          'Same CAMS/KFintech statement as capital gains covers dividend/IDCW payouts. Look for a "Dividend/IDCW Statement" option alongside the capital gains one.'
      }
    ]
  },
  "Bank interest certificates (savings, FDs, RDs)": {
    summary:
      "Every bank you hold an account with, individually. There's no single combined source.",
    sources: [
      {
        name: "Any bank (net banking)",
        steps:
          'Log in -> look for "Interest Certificate", "TDS Certificate", or "Statement of Interest" under Account Statements or Tax Center. Most banks let you generate this for a chosen financial year instantly.'
      }
    ]
  },
  "Form 16 (if salaried) or pension/income summary": {
    summary: "This comes from your employer, not a government portal.",
    sources: [
      {
        name: "Salaried",
        steps:
          "Ask your employer's HR/payroll system (many companies have a self-service portal that generates it directly). It's normally issued by mid-June for the prior financial year."
      },
      {
        name: "Pensioners",
        steps:
          "Your pension-disbursing bank or authority issues an annual pension/TDS statement in a similar role. Ask their customer service if it isn't automatically emailed."
      }
    ]
  },
  "Tax Residency Certificate (TRC) and Form 10F": {
    summary: "These are two separate documents from two different places. You need both.",
    sources: [
      {
        name: "TRC",
        steps:
          "Get this from the tax authority of the country you live in, proving you're a tax resident there. UAE residents apply through the UAE Federal Tax Authority (tax.gov.ae); other countries have their own equivalent. It's a certificate you request, not something India issues."
      },
      {
        name: "Form 10F",
        steps:
          'File this yourself online on the Indian income tax portal: incometax.gov.in -> log in -> e-File -> Income Tax Forms -> File Income Tax Forms -> search "10F". It\'s a short online form where you enter your TRC details, and you download the filed copy afterwards.'
      }
    ]
  },
  "NRE and NRO account statements, separately": {
    summary:
      "From the bank(s) where you hold these accounts. Keep the NRE and the NRO statements as separate downloads. Don't merge them, because they're taxed differently.",
    sources: [
      {
        name: "Net banking",
        steps:
          "Log in to each bank -> Account Statements -> generate a statement for the full financial year, once for the NRE account and once for the NRO account. Download each as its own file."
      },
      {
        name: "Branch request",
        steps:
          "If you can't access net banking from abroad, email or call your branch and ask them to send the NRE and NRO statements for the year separately."
      }
    ]
  },
  "Rental income details and tenant TDS certificate (Form 16A)": {
    summary:
      "The rent figures come from your own records; the TDS certificate comes from your tenant.",
    sources: [
      {
        name: "Rental details",
        steps:
          "From your own lease/rent agreement and bank credits: total rent received for the year, plus any municipal tax you paid on the property."
      },
      {
        name: "Form 16A",
        steps:
          "Ask your tenant for it. If they deducted TDS on the rent, they're required to issue you a Form 16A (they download it from the TRACES portal). You can also cross-check the amount in your own AIS/Form 26AS on incometax.gov.in."
      }
    ]
  },
  "Loan interest certificate(s)": {
    summary: "From whoever gave you the loan: one certificate per loan, for the financial year.",
    sources: [
      {
        name: "From your lender",
        steps:
          'Most banks and housing finance companies let you download an annual "Interest Certificate" (sometimes "Provisional/Final Interest Certificate") from their net banking or app, usually under Loans, Statements, or a Tax section. Many also email it once a year.'
      },
      {
        name: "Education / EV loans",
        steps:
          "Same idea: ask the bank or lender that issued the education or electric-vehicle loan for the yearly interest certificate if it isn't already on their portal."
      }
    ]
  }
};
