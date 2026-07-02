from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / "rules"


def main() -> None:
    json_files = sorted(RULES_DIR.glob("*.json"))
    if not json_files:
        raise AssertionError("No rule JSON files found.")

    failures = []
    for path in json_files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        values = payload.get("values")
        verification = payload.get("verification")
        if not isinstance(values, dict) or not values:
            failures.append(f"{path.name}: empty or missing values")
        if not isinstance(verification, dict) or not verification.get("status"):
            failures.append(f"{path.name}: missing verification metadata")
        if "effective_date" not in payload:
            failures.append(f"{path.name}: missing effective_date")
        if payload.get("topic") != path.stem:
            failures.append(f"{path.name}: topic does not match filename")

    if failures:
        raise AssertionError("\n".join(failures))

    print(f"Validated {len(json_files)} populated rule JSON files.")


if __name__ == "__main__":
    main()
