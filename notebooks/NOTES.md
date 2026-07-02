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
- PDF/free-form extracted text is deliberately routed back to
  `prompts/01-extract-statement.md`, not parsed in the notebook.
- `scripts/validate-notebook.py` executes every code cell without manual
  edits and checks fixture parity.
- The current export cell is still an explicit placeholder that copies
  Milestone 1 dry-run outputs. M2C replaces it with notebook-generated
  outputs.

Generated notebook outputs go to `notebooks/output/`, which is ignored by
Git.
