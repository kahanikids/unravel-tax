from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable


COMPLETE_STATUSES = {"complete", "loaded", "sample loaded", "provided", "available", "done"}
MISSING_STATUSES = {"needed", "missing", "pending", "not started", "incomplete"}
NOT_REQUIRED_STATUSES = {"not applicable", "not needed", "n/a", "na"}
REQUIRED_VALUES = {"yes", "required", "true", "1"}


@dataclass(frozen=True)
class ChecklistGap:
    document: str
    status: str
    why_needed: str

    def as_dict(self) -> dict[str, str]:
        return {
            "document": self.document,
            "status": self.status,
            "why_needed": self.why_needed,
        }


@dataclass(frozen=True)
class FigureMismatch:
    field: str
    expected: float
    reported: float
    difference: float
    source: str

    def as_dict(self) -> dict[str, float | str]:
        return {
            "field": self.field,
            "expected": self.expected,
            "reported": self.reported,
            "difference": self.difference,
            "source": self.source,
        }


def normalize_status(value: Any) -> str:
    return str(value or "").strip().lower()


def is_required(item: dict[str, Any]) -> bool:
    if "required" in item:
        return bool(item["required"])

    needed = normalize_status(item.get("needed") or item.get("Needed?"))
    status = normalize_status(item.get("status") or item.get("Status"))
    if status in NOT_REQUIRED_STATUSES:
        return False
    return needed in REQUIRED_VALUES


def checklist_gaps(checklist_items: Iterable[dict[str, Any]]) -> list[ChecklistGap]:
    gaps: list[ChecklistGap] = []
    for item in checklist_items:
        status = normalize_status(item.get("status") or item.get("Status"))
        if not is_required(item) or status in COMPLETE_STATUSES or status in NOT_REQUIRED_STATUSES:
            continue

        document = str(item.get("document") or item.get("Document") or "").strip()
        why_needed = str(item.get("why_needed") or item.get("Why needed") or "").strip()
        gaps.append(ChecklistGap(document=document, status=status or "missing", why_needed=why_needed))
    return gaps


def to_number(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(",", "").strip()
    return float(cleaned)


def figure_mismatches(
    expected: dict[str, Any],
    reported: dict[str, Any],
    *,
    source: str,
    tolerance: float = 0.01,
) -> list[FigureMismatch]:
    mismatches: list[FigureMismatch] = []
    for field, expected_value in expected.items():
        if field not in reported:
            mismatches.append(
                FigureMismatch(
                    field=field,
                    expected=to_number(expected_value),
                    reported=0.0,
                    difference=-to_number(expected_value),
                    source=f"{source}: missing reported field",
                )
            )
            continue

        expected_number = to_number(expected_value)
        reported_number = to_number(reported[field])
        difference = reported_number - expected_number
        if abs(difference) > tolerance:
            mismatches.append(
                FigureMismatch(
                    field=field,
                    expected=expected_number,
                    reported=reported_number,
                    difference=difference,
                    source=source,
                )
            )
    return mismatches


def tds_mismatches(rows: Iterable[dict[str, Any]], *, tolerance: float = 0.01) -> list[FigureMismatch]:
    expected: dict[str, float] = {}
    reported: dict[str, float] = {}
    for row in rows:
        key = str(row.get("source") or row.get("Source") or "Unknown source").strip()
        expected[key] = to_number(row.get("tds_per_document") or row.get("TDS per Document") or 0)
        reported[key] = to_number(row.get("tds_per_ais") or row.get("TDS per AIS/26AS") or 0)
    return figure_mismatches(expected, reported, source="TDS document vs AIS/26AS", tolerance=tolerance)


def reconciliation_report(
    *,
    checklist_items: Iterable[dict[str, Any]],
    expected_figures: dict[str, Any],
    reported_figures: dict[str, Any],
    tds_rows: Iterable[dict[str, Any]] = (),
    tolerance: float = 0.01,
) -> dict[str, Any]:
    gaps = checklist_gaps(checklist_items)
    mismatches = [
        *figure_mismatches(
            expected_figures,
            reported_figures,
            source="Calculated totals vs reported CA summary",
            tolerance=tolerance,
        ),
        *tds_mismatches(tds_rows, tolerance=tolerance),
    ]
    return {
        "missing_documents": [gap.as_dict() for gap in gaps],
        "mismatches": [mismatch.as_dict() for mismatch in mismatches],
        "ready": not gaps and not mismatches,
    }
