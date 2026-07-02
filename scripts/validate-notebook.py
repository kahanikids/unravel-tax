from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = REPO_ROOT / "notebooks" / "build-workbook.ipynb"
MANIFEST = REPO_ROOT / "notebooks" / "output" / "m2b-ingestion-calculations-manifest.json"


def main() -> None:
    notebook = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
    namespace = {"__name__": "__notebook_validation__"}

    for index, cell in enumerate(notebook["cells"], start=1):
        if cell.get("cell_type") != "code":
            continue
        source = "".join(cell.get("source", []))
        print(f"Running code cell {index}")
        exec(compile(source, f"{NOTEBOOK.name}:cell-{index}", "exec"), namespace)

    if not MANIFEST.exists():
        raise AssertionError(f"Notebook did not write manifest: {MANIFEST}")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("milestone") != "M2B ingestion and calculations":
        raise AssertionError(f"Unexpected manifest milestone: {manifest.get('milestone')}")
    if len(manifest.get("outputs", [])) != 2:
        raise AssertionError("Notebook manifest should list the two placeholder outputs.")
    summary = manifest.get("selected_summary", {})
    expected = {
        "rows": 5,
        "intraday_gain": 800.0,
        "stcg": -500.0,
        "ltcg": 5500.0,
    }
    for key, value in expected.items():
        if summary.get(key) != value:
            raise AssertionError(f"Unexpected {key}: {summary.get(key)}")
    reference = manifest.get("reference_m1_summary", {})
    for key in ("intraday_gain", "stcg", "ltcg"):
        if reference.get(key) != summary.get(key):
            raise AssertionError(f"{key} does not match Milestone 1 reference: {reference.get(key)} vs {summary.get(key)}")
    if manifest.get("pdf_extracted_text_route") != "guided_prompt":
        raise AssertionError("PDF/free-form fixture should route to the guided prompt.")

    print("Notebook ingestion/calculation validation passed.")


if __name__ == "__main__":
    main()
