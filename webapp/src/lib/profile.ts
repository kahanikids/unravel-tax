import type { OrientationAnswers, ProfileFlags } from "../state/types";
import type { ChecklistItem } from "./reconciliation";
import type { ItrFormSelectionRule, SingleParentClubbingRule } from "../rules";

export function deriveProfileFlags(answers: OrientationAnswers): ProfileFlags {
  const hraAboveThreshold = Boolean(answers.hraClaimed && answers.hraAboveThreshold);
  return {
    nri: answers.residency === "nri",
    huf: Boolean(answers.huf),
    seniorCitizen: Boolean(answers.seniorCitizen),
    singleParent: Boolean(answers.singleParent),
    hasCapitalGains: answers.incomeSources.includes("capital_gains"),
    hasDividends: answers.incomeSources.includes("dividends"),
    hasBankInterest: answers.incomeSources.includes("bank_interest"),
    hasRent: answers.incomeSources.includes("rent"),
    multipleEmployers: Boolean(answers.multipleEmployers),
    hraRisk: hraAboveThreshold && answers.hasLandlordPan === false,
    epfRisk: Boolean(answers.epfWithdrawal && answers.epfBeforeFiveYears)
  };
}

/**
 * Builds a personal document checklist from the orientation profile,
 * ordered easiest-to-hardest to obtain (BUILD_PLAN.md Stage 3). Items with
 * needed=false are shown for transparency but never count as an open gap -
 * see lib/reconciliation.ts#isRequired.
 */
export function buildChecklist(flags: ProfileFlags, capitalGainsDocumentLoaded: boolean): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const add = (document: string, whyNeeded: string, status: string, needed: string | boolean = "Yes") => {
    items.push({ document, needed, status, whyNeeded });
  };

  add("PAN and Aadhaar", "Needed to file your return and link it to your accounts.", "Needed");
  add(
    "Form 16 (if salaried) or pension/income summary",
    "Shows your salary or pension income and the TDS already deducted from it.",
    "Needed"
  );

  if (flags.multipleEmployers) {
    add(
      "Form 16 from each employer",
      "More than one employer this year means TDS from each needs reconciling, or an under-withholding shortfall can surface as a surprise.",
      "Needed"
    );
  }

  if (flags.hasBankInterest) {
    add(
      "Bank interest certificates (savings, FDs, RDs)",
      "Interest income and any 80TTA/80TTB deduction depend on this.",
      "Needed"
    );
  }

  add(
    "Form 26AS / Annual Information Statement (AIS)",
    "Shows the TDS and transactions the tax department already has on record. This is the main way mismatches get caught.",
    "Needed"
  );

  if (flags.hasDividends) {
    add(
      "Dividend statement",
      "Dividends are reported quarter-wise, not as one annual figure, because it affects advance-tax interest.",
      "Needed"
    );
  }

  if (flags.hasCapitalGains) {
    add(
      "Broker/AMC capital gains statement",
      "Needed to classify and calculate your capital gains. Upload it in the next step.",
      capitalGainsDocumentLoaded ? "Loaded" : "Needed"
    );
  }

  if (flags.hraRisk) {
    add(
      "Landlord's PAN",
      "Rent above roughly ₹1 lakh/year claimed against salary needs the landlord's PAN, or the claim can be rejected on a documentation technicality.",
      "Needed"
    );
  }

  if (flags.nri) {
    add(
      "Tax Residency Certificate (TRC) and Form 10F",
      "Needed to claim double-taxation relief under the exemption method.",
      "Needed"
    );
    add(
      "NRE and NRO account statements, separately",
      "These two account types are taxed completely differently. Don't combine them.",
      "Needed"
    );
  }

  if (flags.huf) {
    add(
      "HUF PAN and list of coparceners/members",
      "The HUF is a separate taxable entity from you personally, with its own PAN.",
      "Needed"
    );
  }

  if (flags.seniorCitizen) {
    add(
      "Proof of date of birth",
      "Confirms the senior-citizen exemption threshold and 80TTB eligibility.",
      "Needed"
    );
  }

  if (flags.singleParent) {
    add(
      "Details of investments or accounts in a minor's name",
      "Income from these gets clubbed with your own return under Section 64(1A).",
      "Needed"
    );
  }

  add(
    "80C / 80D proofs, if you're claiming deductions",
    "Investment and insurance premium proofs for any deductions you plan to claim.",
    "Optional",
    false
  );
  add(
    "Last year's ITR-V and bank details for refund",
    "Useful for continuity and for tracking any carry-forward losses.",
    "Optional",
    false
  );

  return items;
}

export type ProfileScopeCaveat = {
  id: string;
  label: string;
  note: string;
};

/**
 * Honesty check: the orientation flow asks about every profile from
 * SYSTEM_SPEC.md Section 6.2, and the checklist above lists the right
 * documents for each - but the profile-specific *calculations* (NRE/NRO
 * split, TDS-withheld-vs-owed reconciliation, DTAA/repatriation, HUF
 * partition, minor's-income clubbing amounts) aren't wired into this
 * webapp yet (SYSTEM_SPEC.md Section 14 phases these after the resident +
 * senior-citizen MVP). Say so plainly rather than letting the checklist
 * imply more coverage than the numbers below actually have.
 */
export function profileScopeCaveats(flags: ProfileFlags): ProfileScopeCaveat[] {
  const caveats: ProfileScopeCaveat[] = [];

  if (flags.nri) {
    caveats.push({
      id: "nri_scope",
      label: "Most NRI-specific numbers aren't calculated here yet",
      note:
        "NRE interest can now be entered as its own exempt line under \"A few more numbers\", so it's kept out of your taxable total. This tool still doesn't apply DTAA relief to NRO TDS or track repatriation limits. TDS withheld can be checked against AIS/26AS in the reconciliation panel above. Bring your NRO TDS certificates and DTAA paperwork to a CA."
    });
  }

  if (flags.huf) {
    caveats.push({
      id: "huf_scope",
      label: "HUF-specific numbers aren't calculated here yet",
      note:
        "Coparcener details, transfers-without-consideration clubbing (Section 64(2)), and partition tracking aren't computed by this tool. The figures below only cover capital gains, dividends, and interest, which apply to an HUF the same flat way they do to an individual. The old-vs-new regime comparison tool doesn't fit an HUF's numbers at all (no salary income, no standard deduction, no Section 87A rebate), so it's hidden for this profile. A CA needs to handle the rest of the HUF-entity side."
    });
  }

  if (flags.singleParent) {
    caveats.push({
      id: "single_parent_scope",
      label: "Minor's-income clubbing is only partly calculated here",
      note:
        "Enter the minor's income and child count under \"A few more numbers\" and this tool computes the clubbed amount after the Section 10(32) per-child exemption. It doesn't check whether an exception applies (the minor's own manual work, skill/talent income, or a Section 80U disability), and it doesn't place the figure in Schedule SPI itself. Confirm those with a CA."
    });
  }

  return caveats;
}

/**
 * Section 64(1A)/10(32): a minor child's income is clubbed into the higher-
 * earning parent's return, minus an exemption of up to per_child_exemption_inr
 * per child (capped at max_children_for_exemption children), or the actual
 * clubbed income if that's less. See rules/single-parent-clubbing.md.
 */
export function clubbedMinorIncome(
  minorIncomeToClub: number,
  numberOfMinors: number,
  rule: SingleParentClubbingRule
): number {
  const eligibleChildren = Math.min(Math.max(0, numberOfMinors), rule.values.max_children_for_exemption);
  const exemption = eligibleChildren * rule.values.per_child_exemption_inr;
  return Math.max(0, minorIncomeToClub - exemption);
}

export type ItrFormChoice = {
  form: string;
  dueDate: string;
  key: string;
};

/**
 * Picks the ITR form from the profile flags, detected business/speculative
 * income, and (where known) total income. The Rs 50 lakh ITR-1 ceiling is
 * read from rules/itr-form-selection.json, never hardcoded: a resident with
 * only salary/interest/dividends but total income above that cap files ITR-2,
 * not ITR-1. Pass 0 for totalIncome when it isn't known yet - the ceiling
 * then simply never trips, which is the safe direction. Disqualifiers this
 * tool can't observe (foreign assets, unlisted shares, directorship, a second
 * house property, carried-forward losses) are surfaced as a caveat on the
 * ITR-1 recommendation rather than silently ignored - see ITR_FORM_REASONS.
 */
export function selectItrForm(
  flags: ProfileFlags,
  hasBusinessIncome: boolean,
  itrFormRule: ItrFormSelectionRule,
  totalIncome = 0
): ItrFormChoice {
  const aboveItr1IncomeCap = totalIncome > itrFormRule.values.itr1_conditions.total_income_max_inr;
  const key = hasBusinessIncome
    ? flags.nri
      ? "nri_with_business"
      : flags.huf
        ? "huf_with_business"
        : "business_or_speculative_non_audit"
    : flags.nri
      ? "nri_no_business"
      : flags.huf
        ? "huf_no_business"
        : flags.hasCapitalGains || flags.singleParent
          ? "resident_capital_gains_or_clubbing"
          : aboveItr1IncomeCap
            ? "resident_above_itr1_limit"
            : "resident_simple";

  const entry = itrFormRule.values.forms[key] ?? itrFormRule.values.forms.resident_capital_gains_or_clubbing;
  return { form: entry.form, dueDate: entry.due_date, key };
}
