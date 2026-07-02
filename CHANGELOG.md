# Changelog

Dated log of rule changes and notable project milestones. Rule changes
should reference the `rules/` file(s) touched and the source for the
change (Budget, Finance Act, CBDT circular).

## 2026-07-02

- Completed M4C: mirrored `rules/*.json` into the webapp, added typed rule
  loading and pure rule-backed calculation helpers, validated CA Summary
  parity against the Milestone 1 reference and Milestone 2 fixture buckets
  with `npm run validate:calculations`, and surfaced the calculation ledger
  in the webapp shell.
- Completed M4B: added client-side CSV, Excel, HTML, and structured-text
  ingestion under `webapp/src/ingest/`, kept PDF/free-form text routed to
  `prompts/01-extract-statement.md`, validated fixture parity with
  `npm run validate:ingest`, and surfaced supported formats in the webapp
  shell.
- Completed M4A: scaffolded the static Vite + React + TypeScript webapp
  under `webapp/`, kept it backend-free/account-free/API-key-free, added
  a Swiss-style milestone readiness shell, and validated it with
  `npm run build`.
- Completed M3C: added pure reconciliation functions for checklist gaps,
  calculated-vs-reported figure mismatches, and TDS cross-checks, plus a
  planted fixture validator proving missing documents and mismatches are
  reported before the webapp consumes the logic.
- Completed M3B: added rule markdown/JSON pair validation covering missing
  pairs, non-empty values, verification metadata, effective dates, and source
  references, with pending current-source review reported as warnings.
- Completed M3A: populated all 18 `rules/*.json` files with structured
  values, effective dates, source references, and explicit
  `pending_current_source` verification metadata.
- Completed M2C: notebook exports now generate a CA Summary CSV and full
  workbook from parsed transactions, and validation compares CA Summary
  totals to the Milestone 1 reference.
- Completed M2B: added deterministic notebook ingestion/calculation helpers
  for CSV, Excel, HTML, and structured text fixtures, kept PDF/free-form text
  routed to the guided prompt, and validated fixture parity in the notebook.
- Completed M2A: added `notebooks/build-workbook.ipynb` with runnable
  setup, fixture selection, calculation placeholder, export placeholder,
  and readiness-check cells, plus a validator that executes every code
  cell without manual edits.
- Completed M1C: ran a repeatable manual-flow dry run using the non-CSV
  HTML fixture, produced a full workbook copy and CA Summary CSV, and
  recorded friction points in `dry-runs/m1c/README.md`.
- Completed M1B: generated `templates/excel-export/UnravelTax-Template.xlsx`
  from synthetic fixture data, with common tabs, profile-specific tabs,
  formula-backed working sheets, and repeatable build/verification scripts.
- Completed M1A: README now links to the guided master prompt and template
  status file directly, and `prompts/README.md` makes
  `00-master-guide.md` the single prompt entry point.
- Added `WORKING_PLAN.md` as the loop-by-loop plan from scaffold to
  webapp: template + prompts, notebook, rules + reconciliation, then
  webapp. Each loop ends with validation, commit, and push.
- Repo scaffold initialised from `BUILD_PLAN.md` Section 6: `CLAUDE.md`,
  `README.md`, `CONTRIBUTING.md`, this file, `prompts/`, `rules/` stubs,
  `fixtures/`. `templates/`, `notebooks/`, and `webapp/` left as empty
  placeholders per the milestone sequencing in Section 12 — content for
  those comes with Milestones 1, 2, and 4 respectively.
