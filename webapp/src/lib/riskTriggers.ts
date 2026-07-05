import type { ProfileFlags } from "../state/types";
import type { ItrFormChoice } from "./profile";

export type RiskTrigger = {
  id: string;
  label: string;
  consequence: string;
  /** form-changing/recommendation-changing triggers get a popup per BUILD_PLAN.md Section 1.4; routine ones are inline. */
  severity: "form-changing" | "routine";
};

/**
 * Active risk-trigger checks, sourced from rules/filing-mistakes-and-penalties.md
 * (BUILD_PLAN.md Section 15.5 / SYSTEM_SPEC.md Section 12). Only triggers we can
 * actually evaluate from the orientation answers, uploaded documents, and today's
 * date are computed here - AIS/26AS mismatches and unsupported-deduction checks
 * need document data this app doesn't ingest yet, so they stay as reference
 * copy rather than being falsely presented as "checked".
 */
export function evaluateRiskTriggers(
  flags: ProfileFlags,
  hasBusinessIncome: boolean,
  itrForm: ItrFormChoice,
  today: Date
): RiskTrigger[] {
  const triggers: RiskTrigger[] = [];

  if (flags.multipleEmployers) {
    triggers.push({
      id: "multiple_employers_unreconciled_tds",
      label: "More than one employer this year",
      consequence:
        "Each employer withholds TDS independently, without knowing about the other salary. An unreconciled shortfall can surface as an unexpected tax bill.",
      severity: "routine"
    });
  }

  if (flags.hraRisk) {
    triggers.push({
      id: "hra_over_threshold_without_landlord_pan",
      label: "HRA claimed above ~₹1 lakh/year without a landlord PAN",
      consequence:
        "The claim can be rejected on a documentation technicality even if it's genuine.",
      severity: "routine"
    });
  }

  if (flags.epfRisk) {
    triggers.push({
      id: "epf_withdrawal_before_minimum_service",
      label: "Provident fund withdrawn before 5 years of service",
      consequence:
        "TDS applies at withdrawal, and it counts as taxable income for the year. It's easy to mistake for a tax-free lump sum.",
      severity: "routine"
    });
  }

  if (flags.capitalGainsDisqualifiesItr1) {
    triggers.push({
      id: "capital_gains_asset_disqualifier",
      label: "Capital gains beyond listed shares/equity mutual funds",
      consequence:
        "You told us you sold property, crypto/VDA, unlisted shares, foreign shares, or debt mutual funds — ITR-1 cannot cover these. File ITR-2 (or ITR-3 if business income also applies).",
      severity: "form-changing"
    });
  }

  if (flags.nriNeedsForm13) {
    triggers.push({
      id: "nri_form_13",
      label: "Form 13 lower/nil TDS certificate may apply",
      consequence:
        "Without an approved Form 13, NRI income is often TDS'd at default rates. A CA can help apply under Section 197 or reconcile excess TDS on filing.",
      severity: "routine"
    });
  }

  if (flags.nriMissingTrc) {
    triggers.push({
      id: "nri_missing_trc",
      label: "No TRC or Form 10F yet for treaty relief",
      consequence:
        "Treaty benefits on NRO interest, dividends, or mutual fund gains usually need a Tax Residency Certificate and Form 10F. Without them, TDS at default rates may not be recoverable.",
      severity: "routine"
    });
  }

  if (flags.nriTenantMissingForm16A) {
    triggers.push({
      id: "nri_rent_missing_form_16a",
      label: "Indian rent — tenant Form 16A not confirmed",
      consequence:
        "Tenants should deduct TDS on rent paid to an NRI and issue Form 16A. Missing documentation can delay reconciling TDS on your return.",
      severity: "routine"
    });
  }

  if (flags.hasExtendedForeignAssets) {
    triggers.push({
      id: "foreign_assets_extended_schedule_fa",
      label: "Additional Schedule FA disclosures flagged",
      consequence:
        "Foreign signing authority, property, trusts, or cash-value life insurance each need separate Schedule FA tables in ITR-2/ITR-3. This tool does not yet build those rows — take records to a CA.",
      severity: "form-changing"
    });
  }

  if (flags.hasForeignAssets) {
    triggers.push({
      id: "foreign_assets_schedule_fa",
      label: "Foreign assets must be disclosed in Schedule FA",
      consequence:
        "As a resident, every foreign holding (shares, RSUs, ESPP, accounts) goes in Schedule FA of ITR-2/ITR-3 — never ITR-1 — for the calendar year, with no minimum value. Missing one carries a flat ₹10 lakh penalty under the Black Money Act.",
      severity: "form-changing"
    });
  }

  if (flags.hasInsurancePayout) {
    triggers.push({
      id: "insurance_payout_10_10d",
      label: "Life-insurance payout may not be fully tax-free",
      consequence:
        "A maturity payout loses its Section 10(10D) exemption if annual premium crossed ₹2.5 lakh (ULIP) or ₹5 lakh (traditional), or exceeded 10% of the sum assured. Then the gain is taxable. Check the premium history before treating it as exempt.",
      severity: "routine"
    });
  }

  if (hasBusinessIncome) {
    if (itrForm.form === "ITR-4") {
      triggers.push({
        id: "presumptive_income_itr_form",
        label: "Presumptive business or professional income",
        consequence: `You told us you're on the presumptive scheme (Section 44AD/44ADA/44AE), which routes to ${itrForm.form}, due ${formatDate(itrForm.dueDate)}. This tool does not compute presumptive turnover — confirm eligibility with your CA.`,
        severity: "form-changing"
      });
    } else {
      triggers.push({
        id: "business_income_itr_form",
        label: "Business or speculative/intraday income",
        consequence: `This moves your filing to ${itrForm.form}, due ${formatDate(itrForm.dueDate)}. That's a different, often later, date than the simplest forms.`,
        severity: "form-changing"
      });
    }
  }

  const dueDate = new Date(itrForm.dueDate);
  if (!Number.isNaN(dueDate.getTime()) && today.getTime() > dueDate.getTime()) {
    triggers.push({
      id: "late_filing",
      label: `Past the ${formatDate(itrForm.dueDate)} due date for ${itrForm.form}`,
      consequence:
        "A late fee applies (Section 234F), and the right to carry forward most losses is forfeited.",
      severity: "form-changing"
    });
  }

  return triggers;
}

export type CaRecommendation = {
  recommendCa: boolean;
  headline: string;
  reason: string;
};

export function caOrSelfFileRecommendation(
  flags: ProfileFlags,
  triggers: RiskTrigger[],
  hasBusinessIncome: boolean,
  itrForm?: ItrFormChoice
): CaRecommendation {
  const formChangingTriggers = triggers.filter((trigger) => trigger.severity === "form-changing");
  const recommendCa =
    flags.nri ||
    flags.rnor ||
    flags.huf ||
    flags.singleParent ||
    hasBusinessIncome ||
    formChangingTriggers.length > 0;

  if (!recommendCa) {
    return {
      recommendCa: false,
      headline: "Self-filing may be reasonable here",
      reason:
        "Nothing in your profile or documents points to added complexity, but it's still worth a final sanity check on the numbers before filing."
    };
  }

  const matchedReasons: string[] = [];
  if (flags.nri) {
    matchedReasons.push("your NRI status (NRE/NRO treatment, DTAA)");
  }
  if (flags.rnor) {
    matchedReasons.push("your RNOR status (residency and disclosure rules)");
  }
  if (flags.hufFilingAsEntity) {
    matchedReasons.push("filing the HUF's return");
  } else if (flags.huf) {
    matchedReasons.push("income held through a HUF");
  }
  if (flags.singleParent) {
    matchedReasons.push("possible minor's-income clubbing");
  }
  if (hasBusinessIncome) {
    if (itrForm?.form === "ITR-4") {
      matchedReasons.push("presumptive business or professional income (Section 44AD/44ADA/44AE)");
    } else {
      matchedReasons.push("speculative/intraday income counted as business income");
    }
  }
  for (const trigger of formChangingTriggers) {
    if (
      hasBusinessIncome &&
      (trigger.id === "business_income_itr_form" || trigger.id === "presumptive_income_itr_form")
    ) {
      continue;
    }
    matchedReasons.push(trigger.label.charAt(0).toLowerCase() + trigger.label.slice(1));
  }

  return {
    recommendCa: true,
    headline: "Get a CA to review this before filing",
    reason: `Flagged because of ${matchedReasons.join("; ")}. Each of those is worth a professional's eyes before you file.`
  };
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
