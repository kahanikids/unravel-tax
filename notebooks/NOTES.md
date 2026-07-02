# Notebooks

Skeleton created: `build-workbook.ipynb`.

This is Milestone 2 (BUILD_PLAN.md Section 12): a Colab-ready notebook
porting the classification/gain-calculation/export logic to plain Python
functions, plus CSV/Excel/HTML parsing (the three lightweight formats),
tested against everything in `../fixtures/`.

Current status:

- M2A is complete: the notebook has setup, fixture selection, calculation,
  export, and readiness-check cells.
- `scripts/validate-notebook-skeleton.py` executes every code cell without
  manual edits.
- The current calculation/export cells are explicit placeholders that copy
  Milestone 1 dry-run outputs. M2B replaces the calculation placeholder with
  real ingestion and calculations; M2C replaces the export placeholder with
  notebook-generated outputs.

Generated notebook outputs go to `notebooks/output/`, which is ignored by
Git.
