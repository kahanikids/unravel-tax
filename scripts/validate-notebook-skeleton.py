from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK = REPO_ROOT / "notebooks" / "build-workbook.ipynb"
MANIFEST = REPO_ROOT / "notebooks" / "output" / "m2a-notebook-skeleton-manifest.json"


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
    if manifest.get("milestone") != "M2A skeleton":
        raise AssertionError(f"Unexpected manifest milestone: {manifest.get('milestone')}")
    if len(manifest.get("outputs", [])) != 2:
        raise AssertionError("Notebook manifest should list the two placeholder outputs.")

    print("Notebook skeleton validation passed.")


if __name__ == "__main__":
    main()
