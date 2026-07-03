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
        "Each employer withholds TDS independently, without knowing about the other salary - an unreconciled shortfall can surface as an unexpected tax bill.",
      severity: "routine"
    });
  }

  if (flags.hraRisk) {
    triggers.push({
      id: "hra_over_threshold_without_landlord_pan",
      label: "HRA claimed above ~₹1 lakh/year without a landlord PAN",
      consequence: "The claim can be rejected on a documentation technicality even if it's genuine.",
      severity: "routine"
    });
  }

  if (flags.epfRisk) {
    triggers.push({
      id: "epf_withdrawal_before_minimum_service",
      label: "Provident fund withdrawn before 5 years of service",
      consequence:
        "TDS applies at withdrawal, and it counts as taxable income for the year - easy to mistake for a tax-free lump sum.",
      severity: "routine"
    });
  }

  if (hasBusinessIncome) {
    triggers.push({
      id: "business_income_itr_form",
      label: "Speculative/intraday trading income in your documents",
      consequence: `This moves your filing to ${itrForm.form}, due ${formatDate(itrForm.dueDate)} - a different, often later, date than the simplest forms.`,
      severity: "form-changing"
    });
  }

  const dueDate = new Date(itrForm.dueDate);
  if (!Number.isNaN(dueDate.getTime()) && today.getTime() > dueDate.getTime()) {
    triggers.push({
      id: "late_filing",
      label: `Past the ${formatDate(itrForm.dueDate)} due date for ${itrForm.form}`,
      consequence: "A late fee applies (Section 234F), and the right to carry forward most losses is forfeited.",
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
  hasBusinessIncome: boolean
): CaRecommendation {
  const formChanging = triggers.some((trigger) => trigger.severity === "form-changing");
  const recommendCa = flags.nri || flags.huf || flags.singleParent || hasBusinessIncome || formChanging;

  return {
    recommendCa,
    headline: recommendCa ? "Get a CA to review this before filing" : "Self-filing may be reasonable here",
    reason: recommendCa
      ? "Your profile includes NRI, HUF, single-parent clubbing, business/speculative income, or a form-changing risk trigger - each of those is worth a professional's eyes before you file."
      : "Nothing in your profile or documents points to added complexity, but it's still worth a final sanity check on the numbers before filing."
  };
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
