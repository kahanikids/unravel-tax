import type { OrientationAnswers, ProfileFlags } from "../state/types";
import type { ChecklistItem } from "./reconciliation";
import type { ItrFormSelectionRule, NriDtaaRule, SingleParentClubbingRule } from "../rules";
import { ruleCatalog } from "../rules";

export function deriveProfileFlags(answers: OrientationAnswers): ProfileFlags {
  const hraAboveThreshold = Boolean(answers.hraClaimed && answers.hraAboveThreshold);
  return {
    nri: answers.residency === "nri",
    nriCountry: answers.residency === "nri" ? answers.nriCountry : null,
    huf: Boolean(answers.huf),
    seniorCitizen: Boolean(answers.seniorCitizen),
    singleParent: Boolean(answers.singleParent),
    hasCapitalGains: answers.incomeSources.includes("capital_gains"),
    hasDividends: answers.incomeSources.includes("dividends"),
    hasBankInterest: answers.incomeSources.includes("bank_interest"),
    hasRent: answers.incomeSources.includes("rent"),
    multipleEmployers: Boolean(answers.multipleEmployers),
    hraRisk: hraAboveThreshold && answers.hasLandlordPan === false,
    epfRisk: Boolean(answers.epfWithdrawal && answers.epfBeforeFiveYears),
    hasLoans: Boolean(answers.loansRepaid),
    hasInsurancePayout: Boolean(answers.insurancePayout),
    // Only a resident (ROR) has a Schedule FA obligation; an NRI/RNOR is out of scope.
    hasForeignAssets: answers.residency !== "nri" && Boolean(answers.foreignAssets)
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
    const trcWhy =
      flags.hasCapitalGains && flags.nriCountry
        ? nriTrcWhy(flags, ruleCatalog.nriDtaa)
        : "Needed to claim double-taxation relief under the treaty between India and your country of residence.";
    add("Tax Residency Certificate (TRC) and Form 10F", trcWhy, "Needed");
    add(
      "NRE and NRO account statements, separately",
      "These two account types are taxed completely differently. Don't combine them.",
      "Needed"
    );
    if (flags.hasRent) {
      add(
        "Rental income details and tenant TDS certificate (Form 16A)",
        "Rent from Indian property is taxable here. Tenants often deduct TDS at 30% — you'll reconcile that in your return.",
        "Needed"
      );
    }
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

  if (flags.hasLoans) {
    add(
      "Loan interest certificate(s)",
      "Your lender's yearly interest certificate (home, education, or electric-vehicle loan). It shows the interest paid, which is what you can deduct, mostly under the old regime.",
      "Needed"
    );
  }

  if (flags.hasInsurancePayout) {
    add(
      "Life-insurance payout statement and premium history",
      "A maturity payout is usually tax-free, but not if the policy's premium crossed ₹2.5 lakh (ULIP) or ₹5 lakh (traditional) a year. The premium history decides whether it's taxable.",
      "Needed"
    );
  }

  if (flags.hasForeignAssets) {
    add(
      "Foreign asset and account statements (calendar year Jan–Dec)",
      "Every foreign holding — shares, RSUs, ESPP, bank/brokerage accounts — must go in Schedule FA for the calendar year, with no minimum value. Missing one risks a ₹10 lakh Black Money Act penalty.",
      "Needed"
    );
    add(
      "Foreign tax paid proof (for Form 67 / foreign tax credit)",
      "If tax was withheld abroad on foreign dividends or gains, you claim credit under the DTAA by filing Form 67 before your return.",
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

function nriTrcWhy(flags: ProfileFlags, rule: NriDtaaRule): string {
  if (!flags.nriCountry || flags.nriCountry === "Other") {
    return "Mandatory for any DTAA claim. India has treaties with 90+ countries — your CA needs the TRC from whichever country you are a tax resident of.";
  }
  const entry = rule.values.mutual_fund_capital_gains.countries[flags.nriCountry];
  if (flags.hasCapitalGains && entry?.treatment === "country_of_residence_only") {
    return `AMCs often deduct TDS on MF redemptions anyway. With a TRC and Form 10F you claim exemption under the India–${flags.nriCountry} DTAA (Article ${entry.dtaa_article}) and recover that TDS when you file.`;
  }
  return `Needed to claim treaty relief under the India–${flags.nriCountry} DTAA — lower rates on NRO interest, dividends, or foreign tax credit on gains taxed in India.`;
}

function mfDtaaCaveat(flags: ProfileFlags, rule: NriDtaaRule): ProfileScopeCaveat | null {
  if (!flags.nri || !flags.hasCapitalGains) {
    return null;
  }
  if (!flags.nriCountry) {
    return {
      id: "nri_mf_dtaa_unknown_country",
      label: "MF capital gains — DTAA depends on where you live",
      note:
        "A 2025 ITAT ruling held that mutual fund units are not company shares, so gains may be exempt in India if your country's DTAA has a residual clause (Singapore, UAE, etc.). Tell us your country of residence in About You so we can flag the right treaty. The tax figures below still use Indian domestic rates until a CA applies the exemption."
    };
  }
  if (flags.nriCountry === "Other") {
    return {
      id: "nri_mf_dtaa_other_country",
      label: "MF capital gains — check your specific DTAA",
      note:
        "India has DTAAs with 90+ countries and article numbers differ. Mutual fund units may fall under a residual clause (exempt in India) or be taxed here. This tool cannot look up an unlisted country — bring your TRC and treaty text to a CA. Figures below use Indian domestic rates."
    };
  }
  const entry =
    rule.values.mutual_fund_capital_gains.countries[flags.nriCountry] ??
    null;
  if (!entry) {
    return null;
  }
  if (entry.treatment === "country_of_residence_only") {
    return {
      id: "nri_mf_dtaa_exempt",
      label: `MF gains may be exempt in India (${flags.nriCountry} DTAA)`,
      note: `${entry.note} This tool still shows Indian domestic tax on capital gains above — it does not apply the DTAA exemption to those numbers. You must file ITR-2, disclose the gains, and claim relief under Section 90 with your TRC and Form 10F. Direct equity shares are treated differently from MF units.`
    };
  }
  return {
    id: "nri_mf_dtaa_taxable_india",
    label: `MF gains taxable in India (${flags.nriCountry} DTAA)`,
    note: `${entry.note} TDS is often deducted at source on redemptions — reconcile against your return. Figures below use Indian rates.`
  };
}

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
  const mfCaveat = mfDtaaCaveat(flags, ruleCatalog.nriDtaa);
  if (mfCaveat) {
    caveats.push(mfCaveat);
  }

  if (flags.nri) {
    caveats.push({
      id: "nri_scope",
      label: "Most NRI-specific numbers aren't calculated here yet",
      note:
        "NRE interest can be entered as its own exempt line under \"A few more numbers\" on the Current Filing page, so it's kept out of your taxable total. This tool still doesn't apply DTAA relief to NRO TDS amounts or track repatriation limits. TDS withheld can be checked against AIS/26AS in the reconciliation panel above. Bring your NRO TDS certificates and DTAA paperwork to a CA."
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
      label: "Minor's-income clubbing: check the exceptions yourself",
      note:
        "Enter the minor's income and child count under \"A few more numbers\" on the Current Filing page and this tool computes the clubbed amount after the Section 10(32) per-child exemption. Income the law never clubs - the minor's own manual work, their own skill or talent, or a Section 80U disability - has its own field there and is left out of the clubbed figure, but this tool can't verify the exception genuinely applies, and it doesn't place the figure in Schedule SPI itself. Keep the evidence and confirm with a CA."
    });
  }

  if (flags.hasInsurancePayout) {
    caveats.push({
      id: "insurance_payout_scope",
      label: "Whether your insurance payout is taxable isn't computed here",
      note:
        "A life-insurance maturity is tax-free under Section 10(10D) unless the premium crossed ₹2.5 lakh a year (ULIP issued on/after 1-Feb-2021) or ₹5 lakh a year (traditional policy issued on/after 1-Apr-2023), or exceeded 10% of the sum assured. Whether yours breaches those depends on your policy's issue date and premium history, which this tool doesn't hold, so it isn't added to the figures below. If it does breach, a ULIP gain is taxed as capital gains and a traditional payout as income from other sources — check the exact figure with a CA. Death benefits stay fully exempt."
    });
  }

  if (flags.hasForeignAssets) {
    caveats.push({
      id: "foreign_assets_scope",
      label: "Foreign assets: disclosure and foreign income aren't computed here",
      note:
        "As a resident you must report every foreign asset in Schedule FA for the calendar year (Jan–Dec), with no minimum value — this needs ITR-2/ITR-3, never ITR-1. Foreign dividends and interest are taxable at slab rate, gains on foreign shares are unlisted-share gains (long-term after 24 months at 12.5%), and foreign tax paid is credited via Form 67. This tool doesn't build the Schedule FA table or those figures. Non-disclosure risks a ₹10 lakh Black Money Act penalty, so take your foreign statements to a CA."
    });
  }

  return caveats;
}

/**
 * Section 64(1A)/10(32): a minor child's income is clubbed into the higher-
 * earning parent's return, minus an exemption of up to per_child_exemption_inr
 * per child (capped at max_children_for_exemption children), or the actual
 * clubbed income if that's less. Income Section 64(1A) never clubs - the
 * minor's own manual work, own skill/talent, or an 80U disability (see
 * rule.values.excluded_from_clubbing) - is left out first, before the
 * exemption. See rules/single-parent-clubbing.md.
 */
export function clubbedMinorIncome(
  minorIncomeToClub: number,
  numberOfMinors: number,
  rule: SingleParentClubbingRule,
  exemptFromClubbing = 0
): number {
  const clubbable = Math.max(0, minorIncomeToClub - Math.max(0, exemptFromClubbing));
  const eligibleChildren = Math.min(Math.max(0, numberOfMinors), rule.values.max_children_for_exemption);
  const exemption = eligibleChildren * rule.values.per_child_exemption_inr;
  return Math.max(0, clubbable - exemption);
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
        : flags.hasCapitalGains || flags.singleParent || flags.hasForeignAssets
          ? "resident_capital_gains_or_clubbing"
          : aboveItr1IncomeCap
            ? "resident_above_itr1_limit"
            : "resident_simple";

  const entry = itrFormRule.values.forms[key] ?? itrFormRule.values.forms.resident_capital_gains_or_clubbing;
  return { form: entry.form, dueDate: entry.due_date, key };
}
