/**
 * Single source for copy that appears in more than one place, so wording
 * stays in sync instead of drifting across components. Three disclaimer
 * variants on purpose, shortest to longest: DISCLAIMER_SHORT is the fixed
 * banner text BUILD_PLAN.md Section 1.4 specifies for Stage 1; FOOTER_NOTE
 * is what sits at the bottom of every screen; DISCLAIMER_FULL is the "?"
 * help panel's fuller version. None of these replace the others.
 */

export const DISCLAIMER_SHORT = "This organizes your numbers. It doesn't replace a CA.";

export const FOOTER_NOTE =
  "Open source, so fixes and suggestions are always welcome. It can get things wrong, so check the numbers before you file and let your CA take it from there. Nothing is stored anywhere; it all runs locally, in your browser.";

export const DISCLAIMER_FULL =
  "This is an open source project. If something looks wrong or could be better, that feedback is welcome. The numbers come from documented tax rules, but mistakes happen, so always check the final numbers before you file. This tool organizes your data; it doesn't submit or complete your return, and it's not a substitute for a Chartered Accountant (CA), so send the results to yours for a final check. Nothing you enter is stored or sent anywhere: everything runs locally, in your browser.";

export const WHO_ITS_FOR_TAGLINE = "This is for you if:";

export const WHO_ITS_FOR: string[] = [
  "Tax season fills you with quiet dread",
  "You want to see your numbers before they land in your CA's inbox",
  "You're the nitpicky type who double-checks a total just because",
  "You actually keep last year's Form 16 somewhere findable"
];

export const WHO_ITS_FOR_EXCLUDES =
  "Not built for business or professional income that needs full bookkeeping. That's a different job for a different tool.";

export type HowToStep = { title: string; detail: string };

export const HOW_IT_WORKS: HowToStep[] = [
  { title: "About you", detail: "A few quick questions, plain language, no tax jargon." },
  { title: "Your checklist", detail: "Exactly what documents to gather, and why each one's needed." },
  { title: "Add documents", detail: "Add them one at a time; confirm what we read before it's used." },
  { title: "Your results", detail: "What you owe, what's missing, and whether to self-file or get a CA." }
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
    summary: "Every broker and mutual fund registrar calls this something slightly different. Look for \"Tax P&L\" or \"Capital Gains Statement\", not your regular trade/contract note.",
    sources: [
      { name: "Zerodha", steps: "console.zerodha.com -> Reports -> Tax P&L -> pick the financial year -> download." },
      { name: "Groww", steps: "App/web -> Reports -> Tax P&L Statement -> select financial year -> download." },
      { name: "Upstox", steps: "Upstox Pro web -> Reports -> Tax P&L Report -> select financial year -> download." },
      { name: "ICICI Direct / HDFC Securities / Kotak Securities", steps: "Look under Portfolio or Reports for \"Capital Gains Statement\". Most full-service brokers name it exactly that." },
      { name: "Mutual funds (any AMC)", steps: "CAMS (camsonline.com) or KFintech (mfsonline.kfintech.com) -> Statements -> Capital Gain Statement -> enter your PAN and registered email, a link is emailed to you. This covers funds across AMCs registered with that one registrar, so you may need both CAMS and KFintech." }
    ]
  },
  "Form 26AS / Annual Information Statement (AIS)": {
    summary: "Both come from the income tax e-filing portal, not your bank or broker.",
    sources: [
      { name: "Form 26AS", steps: "incometax.gov.in -> log in -> e-File -> Income Tax Returns -> View Form 26AS -> redirects to TRACES -> select the assessment year." },
      { name: "AIS", steps: "incometax.gov.in -> log in -> Services -> Annual Information Statement (AIS) -> opens the AIS portal -> download the AIS or TIS PDF/JSON for the year." }
    ]
  },
  "Dividend statement": {
    summary: "Dividends on shares and on mutual funds come from different places.",
    sources: [
      { name: "Shares (via your demat)", steps: "Your broker's console -> Reports -> Dividend/Corporate Actions statement, or check your demat's CDSL/NSDL e-mail alerts for each payout." },
      { name: "Mutual funds", steps: "Same CAMS/KFintech statement as capital gains covers dividend/IDCW payouts. Look for a \"Dividend/IDCW Statement\" option alongside the capital gains one." }
    ]
  },
  "Bank interest certificates (savings, FDs, RDs)": {
    summary: "Every bank you hold an account with, individually. There's no single combined source.",
    sources: [
      { name: "Any bank (net banking)", steps: "Log in -> look for \"Interest Certificate\", \"TDS Certificate\", or \"Statement of Interest\" under Account Statements or Tax Center. Most banks let you generate this for a chosen financial year instantly." }
    ]
  },
  "Form 16 (if salaried) or pension/income summary": {
    summary: "This comes from your employer, not a government portal.",
    sources: [
      { name: "Salaried", steps: "Ask your employer's HR/payroll system (many companies have a self-service portal that generates it directly). It's normally issued by mid-June for the prior financial year." },
      { name: "Pensioners", steps: "Your pension-disbursing bank or authority issues an annual pension/TDS statement in a similar role. Ask their customer service if it isn't automatically emailed." }
    ]
  }
};
