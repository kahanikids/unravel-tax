from __future__ import annotations

import json
from json import JSONDecodeError
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / "rules"


def load_json(path: Path, failures: list[str]) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except JSONDecodeError as exc:
        failures.append(f"{path.name}: invalid JSON at line {exc.lineno}, column {exc.colno}")
        return None

    if not isinstance(payload, dict):
        failures.append(f"{path.name}: top-level JSON value must be an object")
        return None

    return payload


def markdown_last_verified(path: Path) -> str | None:
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip().lower().startswith("**last verified:**"):
            return line.strip()
    return None


def validate_json_payload(stem: str, payload: dict[str, Any], failures: list[str], pending: list[str]) -> None:
    if payload.get("topic") != stem:
        failures.append(f"{stem}.json: topic must match filename stem")

    values = payload.get("values")
    if not isinstance(values, dict) or not values:
        failures.append(f"{stem}.json: values must be a non-empty object")

    verification = payload.get("verification")
    if not isinstance(verification, dict):
        failures.append(f"{stem}.json: verification must be an object")
    elif not verification.get("status"):
        failures.append(f"{stem}.json: verification.status is required")
    elif verification.get("status") == "pending_current_source":
        pending.append(f"{stem}.json")

    if "effective_date" not in payload:
        failures.append(f"{stem}.json: effective_date is required")

    source_refs = payload.get("source_refs")
    if not isinstance(source_refs, list) or not source_refs:
        failures.append(f"{stem}.json: source_refs must be a non-empty list")


def main() -> None:
    markdown_files = {path.stem: path for path in RULES_DIR.glob("*.md") if not path.stem.startswith("CA-Review-")}
    json_files = {path.stem: path for path in RULES_DIR.glob("*.json")}

    if not markdown_files:
        raise AssertionError("No rule markdown files found.")
    if not json_files:
        raise AssertionError("No rule JSON files found.")

    failures: list[str] = []
    pending: list[str] = []
    pair_count = 0

    for stem in sorted(markdown_files.keys() | json_files.keys()):
        markdown_path = markdown_files.get(stem)
        json_path = json_files.get(stem)

        if markdown_path is None:
            failures.append(f"{stem}: missing .md rule pair")
            continue
        if json_path is None:
            failures.append(f"{stem}: missing .json rule pair")
            continue

        pair_count += 1

        last_verified = markdown_last_verified(markdown_path)
        if last_verified is None:
            failures.append(f"{stem}.md: missing **Last verified:** metadata")
        elif "pending" in last_verified.lower():
            pending.append(f"{stem}.md")

        payload = load_json(json_path, failures)
        if payload is not None:
            validate_json_payload(stem, payload, failures, pending)

    if pending:
        print(f"WARNING: {len(pending)} rule files still have pending current-source verification.")

    if failures:
        raise AssertionError("\n".join(failures))

    print(f"Validated {pair_count} rule markdown/json pairs with {len(pending)} warnings.")


if __name__ == "__main__":
    main()
