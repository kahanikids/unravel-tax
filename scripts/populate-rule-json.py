from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / "rules"


BASE_METADATA = {
    "financial_year": "2025-26",
    "assessment_year": "2026-27",
    "verification": {
        "status": "pending_current_source",
        "last_verified": None,
        "note": "Structured from BUILD_PLAN.md and SYSTEM_SPEC.md draft content. Verify against current official sources before using as filing advice.",
    },
}


def rule(topic: str, applies_to: list[str], effective_date: str | None, source_refs: list[str], values: dict) -> dict:
    return {
        "topic": topic,
        "applies_to": applies_to,
        "effective_date": effective_date,
        **BASE_METADATA,
        "source_refs": source_refs,
        "values": values,
    }


RULES = {
    "capital-gains-equity": rule(
        "capital-gains-equity",
        ["resident", "nri", "huf", "senior-citizen", "single-parent"],
        "2024-07-23",
        ["BUILD_PLAN.md Sections 15.1, 15.2, 15.4", "SYSTEM_SPEC.md Section 8"],
        {
            "listed_equity": {
                "ltcg_rate": 0.125,
                "stcg_rate": 0.20,
                "ltcg_exemption_inr": 125000,
                "long_term_holding_period_days_gt": 365,
                "indexation_allowed": False,
                "surcharge_cap_rate": 0.15,
                "section_87a_rebate_allowed": False,
            },
            "transaction_costs": {
                "stt_deductible_for_capital_gains": False,
                "stt_deductible_for_speculative_business_income": True,
                "non_stt_charges_deductible": True,
                "broker_values_may_already_net_charges": "check_contract_notes",
            },
            "losses": {
                "stcl_offsets": ["short_term_capital_gains", "long_term_capital_gains"],
                "ltcl_offsets": ["long_term_capital_gains"],
                "carry_forward_assessment_years": 8,
                "late_return_preserves_carry_forward": False,
            },
        },
    ),
    "capital-gains-mutual-funds": rule(
        "capital-gains-mutual-funds",
        ["resident", "nri", "huf", "senior-citizen", "single-parent"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Section 8", "BUILD_PLAN.md Section 15.1"],
        {
            "equity_oriented_funds": {
                "use_listed_equity_rates": True,
                "ltcg_rate": 0.125,
                "stcg_rate": 0.20,
                "ltcg_exemption_inr": 125000,
            },
            "specified_funds_section_50aa": {
                "classification": "short_term_deemed",
                "tax_rate": "slab",
                "indexation_allowed": False,
                "needs_fund_type_check": True,
            },
        },
    ),
    "dividends": rule(
        "dividends",
        ["resident", "nri", "huf", "senior-citizen", "single-parent"],
        "2025-04-01",
        ["BUILD_PLAN.md Section 15.3", "SYSTEM_SPEC.md Section 8"],
        {
            "taxable": True,
            "tax_rate": "slab",
            "reporting": "quarter_wise_schedule_os",
            "tds_threshold_per_company_inr": 10000,
            "advance_tax_timing_relevant": True,
        },
    ),
    "regime-choice": rule(
        "regime-choice",
        ["resident", "senior-citizen", "business-income"],
        "2025-04-01",
        ["BUILD_PLAN.md Sections 15.5, 15.6", "SYSTEM_SPEC.md Section 10"],
        {
            "new_regime_default": True,
            "business_income_switching": {
                "can_switch_freely_each_year": False,
                "restricted_switching_applies": True,
                "trigger_income_types": ["business", "professional", "speculative_intraday"],
            },
            "non_business_income_switching": {
                "can_choose_yearly": True,
            },
            "special_rate_income_rebate_caution": True,
        },
    ),
    "itr-form-selection": rule(
        "itr-form-selection",
        ["resident", "nri", "huf", "business-income", "clubbing"],
        "2026-04-01",
        ["BUILD_PLAN.md Section 15.6", "SYSTEM_SPEC.md Section 10"],
        {
            "forms": {
                "resident_simple": {"form": "ITR-1", "due_date": "2026-07-31"},
                "resident_capital_gains_or_clubbing": {"form": "ITR-2", "due_date": "2026-07-31"},
                "business_or_speculative_non_audit": {"form": "ITR-3", "due_date": "2026-08-31"},
                "business_or_speculative_audit": {"form": "ITR-3", "due_date": "2026-10-31"},
                "nri_no_business": {"form": "ITR-2", "due_date": "2026-07-31"},
                "nri_with_business": {"form": "ITR-3", "due_date": "2026-08-31"},
                "huf_no_business": {"form": "ITR-2", "due_date": "2026-07-31"},
                "huf_with_business": {"form": "ITR-3", "due_date": "2026-08-31"},
            },
            "never_itr_1_if": ["nri", "huf", "stcg", "capital_gains_beyond_itr_1_limit", "clubbing_schedule_spi"],
            "business_income_triggers_itr_3": True,
        },
    ),
    "filing-mistakes-and-penalties": rule(
        "filing-mistakes-and-penalties",
        ["all-profiles"],
        "2026-04-01",
        ["BUILD_PLAN.md Section 15.5", "SYSTEM_SPEC.md Section 12"],
        {
            "risk_triggers": [
                {"trigger": "wrong_itr_form", "consequence": "defective_return"},
                {"trigger": "ais_26as_tds_mismatch", "consequence": "automated_mismatch_notice"},
                {"trigger": "multiple_employers_unreconciled_tds", "consequence": "unexpected_shortfall"},
                {"trigger": "hra_over_threshold_without_landlord_pan", "consequence": "claim_rejection_risk"},
                {"trigger": "tax_after_tds_above_advance_tax_threshold", "consequence": "234b_234c_interest"},
                {"trigger": "epf_withdrawal_before_minimum_service", "consequence": "tds_and_taxable_income_risk"},
                {"trigger": "deductions_without_proof", "consequence": "scrutiny_risk"},
                {"trigger": "late_filing", "consequence": "234f_fee_and_loss_carry_forward_forfeiture"},
                {"trigger": "underreporting", "consequence": "penalty_50_percent_tax_on_underreported_amount"},
                {"trigger": "misreporting", "consequence": "penalty_200_percent_tax_on_misreported_amount"},
            ],
            "late_fee_234f": {"income_lte_500000_inr": 1000, "otherwise_max": 5000},
        },
    ),
    "new-act-2025-transition": rule(
        "new-act-2025-transition",
        ["all-profiles"],
        "2026-04-01",
        ["SYSTEM_SPEC.md Sections 1, 8, 9.5", "00 Project Overview.md"],
        {
            "fy_2025_26_still_old_act_1961": True,
            "new_income_tax_act_applies_from_fy_2026_27": True,
            "transition_caution": "form_names_and_income_year_rules_may_be_on_different_clocks",
            "nro_repatriation_forms": {"old": ["15CA", "15CB"], "new": ["145", "146"]},
        },
    ),
    "nri-residential-status": rule(
        "nri-residential-status",
        ["nri"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 6.2, 8, 9"],
        {
            "requires_days_in_india_count": True,
            "statuses": ["resident", "nri", "rnor"],
            "feeds_tabs": ["DTAA & Residency", "ITR Form Guide"],
            "nri_cannot_use_itr_1_or_itr_4": True,
        },
    ),
    "nri-nre-nro": rule(
        "nri-nre-nro",
        ["nri"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 9.1, 6.2"],
        {
            "nre": {"holds": "foreign_sourced_money", "interest_taxable_in_india": False, "withholding": False},
            "nro": {"holds": "india_sourced_income", "interest_taxable_in_india": True, "withholding": True},
            "common_error": "treating_nro_interest_as_exempt",
        },
    ),
    "nri-tds-and-refunds": rule(
        "nri-tds-and-refunds",
        ["nri"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 9.2, 9.3"],
        {
            "capital_gains_tds_at_source": True,
            "resident_capital_gains_tds_at_source": False,
            "stt_paid_equity_ltcg_tds_rate": 0.125,
            "stt_paid_equity_stcg_tds_rate": 0.20,
            "form_13_lower_or_nil_deduction_certificate": True,
            "requires_tds_reconciliation": True,
        },
    ),
    "nri-dtaa": rule(
        "nri-dtaa",
        ["nri"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Section 9.4"],
        {
            "exemption_method_documents": ["tax_residency_certificate", "form_10f"],
            "foreign_tax_credit_document": "form_67",
            "forms_not_interchangeable": True,
            "requires_country_of_tax_residence": True,
        },
    ),
    "nri-repatriation": rule(
        "nri-repatriation",
        ["nri"],
        "2026-04-01",
        ["SYSTEM_SPEC.md Sections 9.5, 8"],
        {
            "nro_annual_limit_usd": 1000000,
            "nre_repatriation_cap": None,
            "nro_threshold_requiring_ca_certificate_inr": 500000,
            "old_forms": ["15CA", "15CB"],
            "new_forms": ["145", "146"],
            "separate_from_itr": True,
        },
    ),
    "huf-basics": rule(
        "huf-basics",
        ["huf"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 6.2, 8", "BUILD_PLAN.md Section 15.6"],
        {
            "separate_tax_entity": True,
            "requires_separate_pan": True,
            "no_itr_1_or_itr_4": True,
            "no_87a_rebate": True,
            "itr_without_business": "ITR-2",
            "itr_with_business": "ITR-3",
        },
    ),
    "huf-clubbing": rule(
        "huf-clubbing",
        ["huf"],
        "2025-04-01",
        ["BUILD_PLAN.md Section 15.8", "SYSTEM_SPEC.md Sections 6.2, 11"],
        {
            "section": "64(2)",
            "trigger": "member_transfers_asset_to_huf_without_adequate_consideration",
            "income_taxed_in": "transferor_member_return",
            "not_taxed_in": "huf_return",
            "requires_transfer_log": True,
        },
    ),
    "senior-citizen-basics": rule(
        "senior-citizen-basics",
        ["senior-citizen"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 6.2, 8", "BUILD_PLAN.md Section 14"],
        {
            "senior_age_years_gte": 60,
            "super_senior_age_years_gte": 80,
            "interest_deduction": {"section": "80TTB", "limit_inr": 50000, "old_regime_only": True},
            "not_80tta_once_senior": True,
            "needs_dob_proof": True,
        },
    ),
    "senior-citizen-advance-tax-and-regime": rule(
        "senior-citizen-advance-tax-and-regime",
        ["senior-citizen", "business-income"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 6.2, 8", "00 Project Overview.md"],
        {
            "senior_advance_tax_exemption_requires_no_business_income": True,
            "business_or_speculative_income_disqualifies_simple_exemption": True,
            "speculative_intraday_counts_as_business_income": True,
            "business_income_restricts_regime_switching": True,
        },
    ),
    "single-parent-clubbing": rule(
        "single-parent-clubbing",
        ["single-parent", "guardian"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 6.2, 8, 11"],
        {
            "section": "64(1A)",
            "minor_child_income_clubbed": True,
            "reported_in_schedule": "SPI",
            "custodial_parent_relevance": True,
            "per_child_exemption_inr": 1500,
        },
    ),
    "single-parent-alimony": rule(
        "single-parent-alimony",
        ["single-parent", "guardian"],
        "2025-04-01",
        ["SYSTEM_SPEC.md Sections 6.2, 8"],
        {
            "periodic_maintenance": {"tax_treatment": "review_as_income"},
            "lump_sum_settlement": {"tax_treatment": "generally_capital_receipt_review_facts"},
            "requires_periodic_vs_lump_sum_flag": True,
            "needs_documentation": True,
        },
    ),
}


def main() -> None:
    for topic, payload in sorted(RULES.items()):
        path = RULES_DIR / f"{topic}.json"
        if not path.exists():
            raise FileNotFoundError(path)
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Wrote {path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
