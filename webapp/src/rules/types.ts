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
    health_education_cess_rate: number;
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
  itr1_conditions: {
    resident_only: boolean;
    total_income_max_inr: number;
    agricultural_income_max_inr: number;
    house_properties_max: number;
    ltcg_112a_allowed_max_inr: number;
    ltcg_112a_requires_no_carry_forward_loss: boolean;
    allows: string[];
  };
  itr1_disqualifiers: string[];
  never_itr_1_if: string[];
  business_income_triggers_itr_3: boolean;
  speculative_intraday_is_business_income?: boolean;
  presumptive_scheme_uses_itr_4?: boolean;
  non_individual_huf_entities_out_of_scope?: string[];
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
    marginal_relief: {
      applies_above_taxable_income_inr: number;
      tax_capped_at_income_above_threshold: boolean;
    };
  };
  old_regime: {
    standard_deduction_inr: number;
    slabs_below_60: TaxSlab[];
    slabs_60_to_80: TaxSlab[];
    slabs_above_80: TaxSlab[];
    rebate_87a: RegimeRebate87a;
  };
  deductions_by_regime?: {
    old_regime_allows: string;
    old_regime_home_loan_interest_24b_inr: number;
    new_regime_allows_only: string;
    section_80ccd_2_note: string;
    cross_reference: string;
  };
  comparison_scope_caveat: string;
  break_even?: {
    method: string;
    note: string;
  };
};

export type NriNreNroValues = {
  nre: { holds: string; interest_taxable_in_india: boolean; exemption_section: string; withholding: boolean };
  nro: { holds: string; interest_taxable_in_india: boolean; withholding: boolean; withholding_section: string };
  common_error: string;
};

/** Domestic (no-treaty) Section 195/115A TDS defaults - see rules/nri-tds-and-refunds.json. */
export type NriTdsAndRefundsValues = {
  capital_gains_tds_at_source: boolean;
  resident_capital_gains_tds_at_source: boolean;
  stt_paid_equity_ltcg_tds_rate: number;
  stt_paid_equity_stcg_tds_rate: number;
  nro_interest_tds_rate: number;
  nro_dividend_tds_rate: number;
  nro_dividend_tds_section: string;
  nro_interest_tds_section: string;
  form_13_lower_or_nil_deduction_certificate: boolean;
  requires_tds_reconciliation: boolean;
};

export type NriDtaaMfTreatment =
  | "country_of_residence_only"
  | "taxable_in_india"
  | "taxable_in_india_with_credit";

export type NriDtaaCountryEntry = {
  treatment: NriDtaaMfTreatment;
  dtaa_article: string;
  note: string;
};

/** Treaty withholding-rate caps for one country's NRO interest/dividends - null means this tool has no corroborated figure, so the domestic default applies. */
export type NriDtaaWithholdingEntry = {
  interest_rate: number | null;
  dividend_rate: number | null;
  dtaa_articles: string;
};

export type NriDtaaValues = {
  exemption_method_documents: string[];
  foreign_tax_credit_document: string;
  forms_not_interchangeable: boolean;
  requires_country_of_tax_residence: boolean;
  mutual_fund_units_not_shares: boolean;
  itat_mf_ruling: { case: string; date: string; holding: string };
  mutual_fund_capital_gains: {
    default_treatment: string;
    countries: Record<string, NriDtaaCountryEntry>;
  };
  nro_withholding_rates: {
    default_note: string;
    countries: Record<string, NriDtaaWithholdingEntry>;
  };
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
  /** Income kinds Section 64(1A) never clubs: the minor's own manual work, own skill/talent, or an 80U disability. */
  excluded_from_clubbing: string[];
};

export type AdvanceTaxInstalmentRule = {
  due_date: string;
  /** Fraction of assessed tax (liability minus TDS) due cumulatively by this date, e.g. 0.15. */
  cumulative_fraction_due: number;
  /** How many months of 1%/month interest a shortfall in this instalment is charged. */
  months_charged: number;
  /** Paying at least this cumulative fraction clears the instalment even below the due fraction (null = no safe harbour). */
  safe_harbor_cumulative_fraction: number | null;
};

export type AdvanceTaxValues = {
  advance_tax_required_above_inr: number;
  /** Start of the financial year the instalment due dates fall in (e.g. "2025-04-01") - the lower bound of the first 234C window. */
  financial_year_start_date: string;
  assessment_year_start_date: string;
  section_234b: {
    minimum_paid_fraction_to_avoid_interest: number;
    interest_rate_per_month: number;
    part_month_counts_as_full_month: boolean;
  };
  senior_citizen_exempt_without_business_income: boolean;
  section_234c: {
    interest_rate_per_month: number;
    no_interest_if_net_liability_below_inr: number;
    instalments: AdvanceTaxInstalmentRule[];
    /** Shown with every 234C estimate: later-arriving gains/dividends make the true figure lower. */
    later_income_caveat: string;
  };
};

export type DeductionLimitsValues = {
  regime_applicability: string;
  section_80c: { limit_inr: number; covers: string };
  section_80d: { self_family_below_60_inr: number; self_family_senior_citizen_inr: number; covers: string };
  section_80ccd_1b_nps: { limit_inr: number; covers: string };
};

export type LoanTreatmentValues = {
  regime_applicability: string;
  home_loan: {
    self_occupied_interest_24b: {
      limit_inr: number;
      regime: string;
      reduced_limit_if_construction_over_5_years_inr: number;
      conditions: string;
    };
    let_out_interest_24b: {
      limit_inr: number | null;
      regime: string;
      /** Section 24(a): flat standard deduction on the net annual value (rent minus municipal taxes). */
      net_annual_value_standard_deduction_rate: number;
      house_property_loss_setoff_cap_against_other_heads_inr: number;
      old_regime_loss_carry_forward_years: number;
      new_regime_no_setoff_against_other_heads: boolean;
      new_regime_no_carry_forward: boolean;
      note: string;
    };
    principal_repayment_80c: {
      within_section_80c_limit: boolean;
      regime: string;
      cross_reference: string;
      note: string;
    };
    additional_interest_80ee: { limit_inr: number; regime: string; note: string };
    additional_interest_80eea: {
      limit_inr: number;
      regime: string;
      first_time_buyer_only: boolean;
      cannot_combine_with_80ee: boolean;
      note: string;
    };
    self_occupied_homes_allowed: number;
    self_occupied_homes_note: string;
  };
  education_loan_80e: {
    limit_inr: number | null;
    interest_only: boolean;
    max_claim_years: number;
    eligible_borrowers: string;
    individuals_only: boolean;
    regime: string;
    note: string;
  };
  electric_vehicle_loan_80eeb: {
    limit_inr: number;
    regime: string;
    individuals_only: boolean;
    note: string;
  };
  personal_and_other_loans: { interest_generally_deductible: boolean; exceptions: string };
  loans_and_clubbing: { note: string; cross_reference: string };
  new_act_2025_renumbering: Record<string, string>;
};

/**
 * Only the fields the webapp actually reads are typed here; the JSON carries
 * more (sum-assured ratio rule, renumbering, notes) that stays untyped on the
 * generic index. Rupee caps for premiums live in deduction-limits.json and are
 * cross-referenced, not duplicated - see rules/insurance.md.
 */
export type InsuranceValues = {
  payouts_section_10_10d: {
    death_benefit_always_exempt: boolean;
    death_benefit_exception: string;
    ulip: {
      issued_on_or_after: string;
      aggregate_annual_premium_exemption_cap_inr: number;
      taxed_as_if_breached: string;
    };
    traditional_non_ulip: {
      issued_on_or_after: string;
      aggregate_annual_premium_exemption_cap_inr: number;
      taxed_as_if_breached: string;
      taxable_amount_basis: string;
    };
    sum_assured_ratio_rule: {
      issued_on_or_after_2012_04_01_premium_max_pct_of_sum_assured: number;
      issued_2003_04_01_to_2012_03_31_premium_max_pct_of_sum_assured: number;
      note: string;
    };
    tds_section_194da: {
      rate: number;
      applies_when_income_portion_at_least_inr: number;
    };
  };
};

/** Only the fields the webapp reads - see rules/foreign-investments.md for the rest. */
export type ForeignInvestmentsValues = {
  schedule_fa_disclosure: {
    minimum_value_threshold_inr: number;
    requires_itr_form: string[];
    cannot_use_forms: string[];
  };
  tcs_on_lrs_remittances: {
    section: string;
    threshold_inr: number;
    rate_investment_gift_other: number;
    /** Remittances for education or medical treatment above the threshold. */
    rate_education_medical: number;
    /** Remittances funded by a Section 80E education loan collect no TCS at all. */
    education_loan_funded: string;
  };
  black_money_act_penalties: {
    non_disclosure_penalty_inr: number;
    non_disclosure_penalty_section: string;
  };
};

export type CapitalGainsEquityRule = RuleDocument<CapitalGainsEquityValues>;
export type DeductionLimitsRule = RuleDocument<DeductionLimitsValues>;
export type InsuranceRule = RuleDocument<InsuranceValues>;
export type ForeignInvestmentsRule = RuleDocument<ForeignInvestmentsValues>;
export type LoanTreatmentRule = RuleDocument<LoanTreatmentValues>;
export type ItrFormSelectionRule = RuleDocument<ItrFormSelectionValues>;
export type FilingMistakesRule = RuleDocument<FilingMistakesValues>;
export type RegimeChoiceRule = RuleDocument<RegimeChoiceValues>;
export type NriNreNroRule = RuleDocument<NriNreNroValues>;
export type NriTdsAndRefundsRule = RuleDocument<NriTdsAndRefundsValues>;
export type NriDtaaRule = RuleDocument<NriDtaaValues>;
export type HufBasicsRule = RuleDocument<HufBasicsValues>;
export type SingleParentClubbingRule = RuleDocument<SingleParentClubbingValues>;
export type AdvanceTaxRule = RuleDocument<AdvanceTaxValues>;
