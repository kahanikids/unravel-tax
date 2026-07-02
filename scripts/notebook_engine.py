from __future__ import annotations

import csv
import html.parser
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable

from openpyxl import load_workbook


EXPECTED_COLUMNS = [
    "Scrip Name",
    "Purchase Date",
    "Sell Date",
    "Units",
    "Buy Value",
    "Sell Value",
    "Buy Price",
    "Sell Price",
]


@dataclass(frozen=True)
class Transaction:
    scrip_name: str
    purchase_date: datetime
    sell_date: datetime
    units: float
    buy_value: float
    sell_value: float
    buy_price: float
    sell_price: float
    hold_period_days: int
    tax_class: str
    gain_loss: float

    def comparable(self) -> tuple:
        return (
            self.scrip_name,
            self.purchase_date.strftime("%d-%b-%Y"),
            self.sell_date.strftime("%d-%b-%Y"),
            self.units,
            self.buy_value,
            self.sell_value,
            self.buy_price,
            self.sell_price,
            self.hold_period_days,
            self.tax_class,
            self.gain_loss,
        )


@dataclass
class TableCollector(html.parser.HTMLParser):
    tables: list[list[list[str]]] = field(default_factory=list)
    _current_table: list[list[str]] | None = None
    _current_row: list[str] | None = None
    _current_cell: list[str] | None = None
    _in_cell: bool = False

    def __post_init__(self) -> None:
        super().__init__()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "table":
            self._current_table = []
        elif tag == "tr" and self._current_table is not None:
            self._current_row = []
        elif tag in {"td", "th"} and self._current_row is not None:
            self._current_cell = []
            self._in_cell = True

    def handle_data(self, data: str) -> None:
        if self._in_cell and self._current_cell is not None:
            self._current_cell.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self._current_cell is not None and self._current_row is not None:
            value = re.sub(r"\s+", " ", "".join(self._current_cell)).strip()
            self._current_row.append(value)
            self._current_cell = None
            self._in_cell = False
        elif tag == "tr" and self._current_row is not None and self._current_table is not None:
            if self._current_row:
                self._current_table.append(self._current_row)
            self._current_row = None
        elif tag == "table" and self._current_table is not None:
            self.tables.append(self._current_table)
            self._current_table = None


def parse_date(value: str | datetime) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.strptime(str(value), "%d-%b-%Y")


def parse_number(value: str | int | float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(",", "").strip()
    return float(cleaned)


def normalize_rows(rows: Iterable[dict[str, object]]) -> list[Transaction]:
    transactions = []
    for row in rows:
        purchase_date = parse_date(row["Purchase Date"])
        sell_date = parse_date(row["Sell Date"])
        hold_period_days = (sell_date - purchase_date).days
        if hold_period_days == 0:
            tax_class = "Intraday"
        elif hold_period_days > 365:
            tax_class = "LT"
        else:
            tax_class = "ST"
        buy_value = parse_number(row["Buy Value"])
        sell_value = parse_number(row["Sell Value"])
        transactions.append(
            Transaction(
                scrip_name=str(row["Scrip Name"]).strip(),
                purchase_date=purchase_date,
                sell_date=sell_date,
                units=parse_number(row["Units"]),
                buy_value=buy_value,
                sell_value=sell_value,
                buy_price=parse_number(row["Buy Price"]),
                sell_price=parse_number(row["Sell Price"]),
                hold_period_days=hold_period_days,
                tax_class=tax_class,
                gain_loss=sell_value - buy_value,
            )
        )
    return transactions


def parse_csv_fixture(path: Path) -> list[Transaction]:
    with path.open(newline="", encoding="utf-8") as handle:
        return normalize_rows(csv.DictReader(handle))


def parse_structured_text_fixture(path: Path) -> list[Transaction]:
    with path.open(newline="", encoding="utf-8") as handle:
        return normalize_rows(csv.DictReader(handle, delimiter="\t"))


def parse_excel_fixture(path: Path) -> list[Transaction]:
    workbook = load_workbook(path, data_only=True, read_only=True)
    sheet = workbook.active
    rows = list(sheet.iter_rows(values_only=True))
    headers = [str(value).strip() for value in rows[0]]
    if headers != EXPECTED_COLUMNS:
        raise ValueError(f"Unexpected Excel headers: {headers}")
    records = [dict(zip(headers, row)) for row in rows[1:] if any(value is not None for value in row)]
    return normalize_rows(records)


def parse_html_fixture(path: Path) -> list[Transaction]:
    parser = TableCollector()
    parser.feed(path.read_text(encoding="utf-8"))
    for table in parser.tables:
        if table and table[0] == EXPECTED_COLUMNS:
            records = [dict(zip(EXPECTED_COLUMNS, row)) for row in table[1:]]
            return normalize_rows(records)
    raise ValueError("Could not find transaction table in HTML fixture.")


def route_pdf_or_freeform(path: Path) -> dict[str, str]:
    return {
        "path": str(path),
        "route": "guided_prompt",
        "prompt": "prompts/01-extract-statement.md",
        "reason": "PDF/free-form text table reconstruction stays in the AI-assisted prompt path.",
    }


def load_transactions(kind: str, path: Path) -> list[Transaction] | dict[str, str]:
    if kind == "csv":
        return parse_csv_fixture(path)
    if kind == "excel":
        return parse_excel_fixture(path)
    if kind == "html":
        return parse_html_fixture(path)
    if kind == "structured_text":
        return parse_structured_text_fixture(path)
    if kind == "pdf_extracted_text":
        return route_pdf_or_freeform(path)
    raise ValueError(f"Unsupported fixture kind: {kind}")


def summarize_transactions(transactions: list[Transaction]) -> dict[str, float | int]:
    return {
        "rows": len(transactions),
        "intraday_gain": sum(row.gain_loss for row in transactions if row.tax_class == "Intraday"),
        "stcg": sum(row.gain_loss for row in transactions if row.tax_class == "ST"),
        "ltcg": sum(row.gain_loss for row in transactions if row.tax_class == "LT"),
    }


def validate_fixture_parity(fixture_options: dict[str, Path]) -> dict[str, object]:
    parsed = {
        kind: load_transactions(kind, path)
        for kind, path in fixture_options.items()
        if kind != "pdf_extracted_text"
    }
    baseline = parsed["csv"]
    assert isinstance(baseline, list)
    baseline_rows = [row.comparable() for row in baseline]
    for kind, rows in parsed.items():
        assert isinstance(rows, list)
        if [row.comparable() for row in rows] != baseline_rows:
            raise AssertionError(f"{kind} fixture does not match CSV baseline.")
    pdf_route = load_transactions("pdf_extracted_text", fixture_options["pdf_extracted_text"])
    assert isinstance(pdf_route, dict)
    return {
        "parsed_fixture_kinds": sorted(parsed),
        "pdf_extracted_text_route": pdf_route["route"],
        "summary": summarize_transactions(baseline),
    }
