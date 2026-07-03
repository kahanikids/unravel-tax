import advanceTax from "./data/advance-tax.json";
import capitalGainsEquity from "./data/capital-gains-equity.json";
import capitalGainsMutualFunds from "./data/capital-gains-mutual-funds.json";
import deductionLimits from "./data/deduction-limits.json";
import dividends from "./data/dividends.json";
import filingMistakesAndPenalties from "./data/filing-mistakes-and-penalties.json";
import hufBasics from "./data/huf-basics.json";
import hufClubbing from "./data/huf-clubbing.json";
import itrFormSelection from "./data/itr-form-selection.json";
import loanTreatment from "./data/loan-treatment.json";
import newActTransition from "./data/new-act-2025-transition.json";
import nriDtaa from "./data/nri-dtaa.json";
import nriNreNro from "./data/nri-nre-nro.json";
import nriRepatriation from "./data/nri-repatriation.json";
import nriResidentialStatus from "./data/nri-residential-status.json";
import nriTdsAndRefunds from "./data/nri-tds-and-refunds.json";
import regimeChoice from "./data/regime-choice.json";
import seniorCitizenAdvanceTaxAndRegime from "./data/senior-citizen-advance-tax-and-regime.json";
import seniorCitizenBasics from "./data/senior-citizen-basics.json";
import singleParentAlimony from "./data/single-parent-alimony.json";
import singleParentClubbing from "./data/single-parent-clubbing.json";

import type {
  AdvanceTaxRule,
  CapitalGainsEquityRule,
  DeductionLimitsRule,
  FilingMistakesRule,
  HufBasicsRule,
  ItrFormSelectionRule,
  LoanTreatmentRule,
  NriNreNroRule,
  NriDtaaRule,
  RegimeChoiceRule,
  RuleDocument,
  SingleParentClubbingRule
} from "./types";

// Every rules/*.json topic, mirrored 1:1 from the top-level rules/ directory.
// capitalGainsEquity, itrFormSelection, filingMistakesAndPenalties,
// regimeChoice, nriNreNro, hufBasics, singleParentClubbing, and advanceTax
// are typed for programmatic use (calculations, ITR selection, risk
// triggers, regime comparison, NRI/HUF/single-parent partial calculations).
// The rest are typed generically (RuleDocument) - they're surfaced as
// reference/explanatory content today, not yet consumed by calculation
// logic. See CLAUDE.md: never hardcode a rate that belongs in one of these.
export const ruleCatalog = {
  advanceTax: advanceTax as AdvanceTaxRule,
  capitalGainsEquity: capitalGainsEquity as CapitalGainsEquityRule,
  capitalGainsMutualFunds: capitalGainsMutualFunds as RuleDocument,
  deductionLimits: deductionLimits as DeductionLimitsRule,
  dividends: dividends as RuleDocument,
  filingMistakesAndPenalties: filingMistakesAndPenalties as FilingMistakesRule,
  hufBasics: hufBasics as HufBasicsRule,
  hufClubbing: hufClubbing as RuleDocument,
  itrFormSelection: itrFormSelection as ItrFormSelectionRule,
  loanTreatment: loanTreatment as LoanTreatmentRule,
  newActTransition: newActTransition as RuleDocument,
  nriDtaa: nriDtaa as NriDtaaRule,
  nriNreNro: nriNreNro as NriNreNroRule,
  nriRepatriation: nriRepatriation as RuleDocument,
  nriResidentialStatus: nriResidentialStatus as RuleDocument,
  nriTdsAndRefunds: nriTdsAndRefunds as RuleDocument,
  regimeChoice: regimeChoice as RegimeChoiceRule,
  seniorCitizenAdvanceTaxAndRegime: seniorCitizenAdvanceTaxAndRegime as RuleDocument,
  seniorCitizenBasics: seniorCitizenBasics as RuleDocument,
  singleParentAlimony: singleParentAlimony as RuleDocument,
  singleParentClubbing: singleParentClubbing as SingleParentClubbingRule
};

export function ruleVerificationSummary(rules: RuleDocument[]) {
  return {
    total: rules.length,
    pendingCurrentSource: rules.filter((rule) => rule.verification.status === "pending_current_source").length,
    financialYears: Array.from(new Set(rules.map((rule) => rule.financial_year))).sort(),
    assessmentYears: Array.from(new Set(rules.map((rule) => rule.assessment_year))).sort()
  };
}
