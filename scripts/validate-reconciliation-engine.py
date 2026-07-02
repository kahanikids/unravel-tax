from __future__ import annotations

import json
from pathlib import Path

from notebook_engine import SUPPLEMENTAL_INPUTS, load_transactions, summarize_transactions
from reconciliation_engine import reconciliation_report


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_PATH = REPO_ROOT / "fixtures" / "reconciliation-m3c.json"
BROKER_FIXTURE_PATH = REPO_ROOT / "fixtures" / "sample-broker-statement.csv"


def expected_figures_from_broker_fixture() -> dict[str, float]:
    transactions = load_transactions("csv", BROKER_FIXTURE_PATH)
    if not isinstance(transactions, list):
        raise AssertionError("CSV fixture should parse into transactions.")

    summary = summarize_transactions(transactions)
    return {
        "Speculative / Intraday income": float(summary["intraday_gain"]),
        "Short-Term Capital Gains": float(summary["stcg"]),
        "Long-Term Capital Gains": float(summary["ltcg"]),
        "Dividends": SUPPLEMENTAL_INPUTS["dividends"],
        "Interest & other income": SUPPLEMENTAL_INPUTS["interest_other_income"],
        "Eligible interest deduction": SUPPLEMENTAL_INPUTS["eligible_interest_deduction"],
        "Deductible transaction charges": SUPPLEMENTAL_INPUTS["deductible_transaction_charges"],
        "Carry-forward losses available": SUPPLEMENTAL_INPUTS["carry_forward_losses_available"],
    }


def main() -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    report = reconciliation_report(
        checklist_items=fixture["checklist"],
        expected_figures=expected_figures_from_broker_fixture(),
        reported_figures=fixture["reported_summary"],
        tds_rows=fixture["tds_rows"],
    )

    missing_documents = {item["document"] for item in report["missing_documents"]}
    expected_missing = set(fixture["expected_missing_documents"])
    if missing_documents != expected_missing:
        raise AssertionError(f"Missing document mismatch: {missing_documents} != {expected_missing}")

    mismatch_fields = {item["field"] for item in report["mismatches"]}
    expected_mismatches = set(fixture["expected_mismatch_fields"])
    if not expected_mismatches.issubset(mismatch_fields):
        raise AssertionError(f"Expected planted mismatches not reported: {expected_mismatches - mismatch_fields}")

    if report["ready"]:
        raise AssertionError("Incomplete and mismatched fixture should not be ready.")

    print(
        "Validated reconciliation engine: "
        f"{len(report['missing_documents'])} missing documents, "
        f"{len(report['mismatches'])} mismatches."
    )


if __name__ == "__main__":
    main()
