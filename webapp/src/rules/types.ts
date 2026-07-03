export type RuleVerification = {
  status: string;
  last_verified: string | null;
  note: string;
};

export type RuleDocument<TValues = Record<string, unknown>> = {
  topic: string;
  applies_to: string[];
  effective_date: string;
  financial_year: string;
  assessment_year: string;
  verification: RuleVerification;
  source_refs: string[];
  values: TValues;
};

export type CapitalGainsEquityValues = {
  listed_equity: {
    ltcg_rate: number;
    stcg_rate: number;
    ltcg_exemption_inr: number;
    long_term_holding_period_days_gt: number;
    indexation_allowed: boolean;
    surcharge_cap_rate: number;
    section_87a_rebate_allowed: boolean;
  };
  transaction_costs: {
    stt_deductible_for_capital_gains: boolean;
    stt_deductible_for_speculative_business_income: boolean;
    non_stt_charges_deductible: boolean;
    broker_values_may_already_net_charges: string;
  };
  losses: {
    stcl_offsets: string[];
    ltcl_offsets: string[];
    carry_forward_assessment_years: number;
    late_return_preserves_carry_forward: boolean;
  };
};

export type ItrFormSelectionValues = {
  forms: Record<string, { form: string; due_date: string }>;
  never_itr_1_if: string[];
  business_income_triggers_itr_3: boolean;
};

export type RiskTriggerDefinition = {
  trigger: string;
  consequence: string;
};

export type FilingMistakesValues = {
  risk_triggers: RiskTriggerDefinition[];
  late_fee_234f: {
    income_lte_500000_inr: number;
    otherwise_max: number;
  };
};

export type TaxSlab = {
  up_to_inr: number | null;
  rate: number;
};

export type RegimeRebate87a = {
  taxable_income_at_or_below_inr: number;
  max_rebate_inr: number;
};

export type RegimeChoiceValues = {
  new_regime_default: boolean;
  cess_rate: number;
  new_regime: {
    standard_deduction_inr: number;
    slabs: TaxSlab[];
    rebate_87a: RegimeRebate87a;
  };
  old_regime: {
    standard_deduction_inr: number;
    slabs_below_60: TaxSlab[];
    slabs_60_to_80: TaxSlab[];
    slabs_above_80: TaxSlab[];
    rebate_87a: RegimeRebate87a;
  };
  comparison_scope_caveat: string;
};

export type NriNreNroValues = {
  nre: { holds: string; interest_taxable_in_india: boolean; exemption_section: string; withholding: boolean };
  nro: { holds: string; interest_taxable_in_india: boolean; withholding: boolean; withholding_section: string };
  common_error: string;
};

export type HufBasicsValues = {
  separate_tax_entity: boolean;
  requires_separate_pan: boolean;
  no_87a_rebate: boolean;
  no_standard_deduction: boolean;
  cannot_have_salary_income: boolean;
  same_slab_rates_as_individual: boolean;
  itr_without_business: string;
  itr_with_business: string;
};

export type SingleParentClubbingValues = {
  section: string;
  exemption_section: string;
  per_child_exemption_inr: number;
  max_children_for_exemption: number;
  reported_in_schedule: string;
};

export type AdvanceTaxValues = {
  advance_tax_required_above_inr: number;
  assessment_year_start_date: string;
  section_234b: {
    minimum_paid_fraction_to_avoid_interest: number;
    interest_rate_per_month: number;
    part_month_counts_as_full_month: boolean;
  };
  senior_citizen_exempt_without_business_income: boolean;
  section_234c_status: string;
  section_234c_reason: string;
};

export type CapitalGainsEquityRule = RuleDocument<CapitalGainsEquityValues>;
export type ItrFormSelectionRule = RuleDocument<ItrFormSelectionValues>;
export type FilingMistakesRule = RuleDocument<FilingMistakesValues>;
export type RegimeChoiceRule = RuleDocument<RegimeChoiceValues>;
export type NriNreNroRule = RuleDocument<NriNreNroValues>;
export type HufBasicsRule = RuleDocument<HufBasicsValues>;
export type SingleParentClubbingRule = RuleDocument<SingleParentClubbingValues>;
export type AdvanceTaxRule = RuleDocument<AdvanceTaxValues>;
