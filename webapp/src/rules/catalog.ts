import capitalGainsEquity from "./data/capital-gains-equity.json";
import itrFormSelection from "./data/itr-form-selection.json";
import type { CapitalGainsEquityRule, ItrFormSelectionRule, RuleDocument } from "./types";

export const ruleCatalog = {
  capitalGainsEquity: capitalGainsEquity as CapitalGainsEquityRule,
  itrFormSelection: itrFormSelection as ItrFormSelectionRule
};

export function ruleVerificationSummary(rules: RuleDocument[]) {
  return {
    total: rules.length,
    pendingCurrentSource: rules.filter((rule) => rule.verification.status === "pending_current_source").length,
    financialYears: Array.from(new Set(rules.map((rule) => rule.financial_year))).sort(),
    assessmentYears: Array.from(new Set(rules.map((rule) => rule.assessment_year))).sort()
  };
}
