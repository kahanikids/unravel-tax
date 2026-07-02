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

export type CapitalGainsEquityRule = RuleDocument<CapitalGainsEquityValues>;
export type ItrFormSelectionRule = RuleDocument<ItrFormSelectionValues>;
