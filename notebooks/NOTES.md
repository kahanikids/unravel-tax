# Notebooks

Skeleton created: `build-workbook.ipynb`.

This is Milestone 2 (BUILD_PLAN.md Section 12): a Colab-ready notebook
porting the classification/gain-calculation/export logic to plain Python
functions, plus CSV/Excel/HTML parsing (the three lightweight formats),
tested against everything in `../fixtures/`.

Current status:

- M2A is complete: the notebook has setup, fixture selection, calculation,
  export, and readiness-check cells.
- M2B is complete: CSV, Excel, HTML, and structured text fixtures parse
  into one normalized transaction shape with deterministic hold-period,
  tax-class, and gain/loss calculations.
- M2C is complete: the notebook generates its own CA Summary CSV and full
  workbook outputs from parsed transactions, then validates CA Summary
  totals against the Milestone 1 reference.
- PDF/free-form extracted text is deliberately routed back to
  `prompts/01-extract-statement.md`, not parsed in the notebook.
- `scripts/validate-notebook.py` executes every code cell without manual
  edits, checks fixture parity, verifies generated outputs exist, and
  compares CA Summary totals to the Milestone 1 reference.

Generated notebook outputs go to `notebooks/output/`, which is ignored by
Git.
