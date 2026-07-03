/**
 * Single source for copy that appears in more than one place, so wording
 * stays in sync instead of drifting across components. Three disclaimer
 * variants on purpose, shortest to longest: DISCLAIMER_SHORT is the fixed
 * banner text BUILD_PLAN.md Section 1.4 specifies for Stage 1; FOOTER_NOTE
 * is what sits at the bottom of every screen; DISCLAIMER_FULL is the "?"
 * help panel's fuller version. None of these replace the others.
 */

export const DISCLAIMER_SHORT = "This organizes your numbers - it doesn't replace a CA.";

export const FOOTER_NOTE =
  "Open source, so fixes and suggestions are always welcome. It can get things wrong - check the numbers before you file, and let your CA take it from there. Nothing is stored anywhere; it all runs locally, in your browser.";

export const DISCLAIMER_FULL =
  "This is an open source project - if something looks wrong or could be better, that feedback is welcome. The numbers come from documented tax rules, but mistakes happen, so always check the final numbers before you file. This tool organizes your data; it doesn't submit or complete your return, and it's not a substitute for a Chartered Accountant (CA) - send the results to yours for a final check. Nothing you enter is stored or sent anywhere: everything runs locally, in your browser.";

export const WHO_ITS_FOR_TAGLINE = "This is for you if:";

export const WHO_ITS_FOR: string[] = [
  "Tax season fills you with quiet dread",
  "You want to see your numbers before they land in your CA's inbox",
  "You're the nitpicky type who double-checks a total just because",
  "You actually keep last year's Form 16 somewhere findable"
];

export const WHO_ITS_FOR_EXCLUDES =
  "Not built for business or professional income that needs full bookkeeping - that's a different job for a different tool.";

export type HowToStep = { title: string; detail: string };

export const HOW_IT_WORKS: HowToStep[] = [
  { title: "About you", detail: "A few quick questions, plain language, no tax jargon." },
  { title: "Your checklist", detail: "Exactly what documents to gather, and why each one's needed." },
  { title: "Add documents", detail: "Add them one at a time; confirm what we read before it's used." },
  { title: "Your results", detail: "What you owe, what's missing, and whether to self-file or get a CA." }
];
