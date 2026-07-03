# Working Plan

This is the operating loop for building Unravel Tax from scaffold to
webapp. Work proceeds in strict milestone order:

1. Template + prompts
2. Notebook
3. Rules + reconciliation
4. Webapp

Do not start the webapp until Milestones 1-3 are complete and validated.

## Loop Contract

Every work loop is a clean milestone slice:

1. Start from a clean `main` branch synced with `origin/main`.
2. Pick the next incomplete slice from this file.
3. Make only the changes needed for that slice.
4. Validate the slice using the listed checks.
5. Update this file and `CHANGELOG.md` if the project state changes.
6. Commit with a short message.
7. Push to GitHub.

A loop is not done until the commit is pushed.

## Milestone 1: Template + Guided Chat

Goal: a first-time user can follow the README and guided chat, use the
template/manual workflow, and produce a CA summary plus a full workbook.

Slices:

- **M1A - README and prompt path** - done 2026-07-02
  - Replace placeholder "Start here" links with concrete local/published
    prompt/template instructions.
  - Make `prompts/00-master-guide.md` the obvious single entry point.
  - Validate by reading the flow as a new user and confirming there is
    exactly one next action at each stage.

- **M1B - Template workbook** - done 2026-07-02
  - Generalize the RKM workbook structure into a synthetic-data template.
  - Include common tabs and profile-specific tabs described in
    `SYSTEM_SPEC.md`.
  - Use formulas for derived values; no real personal data.
  - Validate by opening/rendering the workbook and checking formula cells
    for visible errors.

- **M1C - Manual flow dry run** - done 2026-07-02
  - Run the prompt + template path with the synthetic fixtures.
  - Submit at least one non-CSV fixture path.
  - Record friction points and fix only the flow blockers.
  - Validate by producing the two intended outputs: CA summary and full
    workbook.

Milestone 1 is complete when a new tester can get through the manual
flow without needing project author guidance.

## Milestone 2: Notebook

Goal: a zero-install Colab-style notebook reproduces the same outputs as
Milestone 1 for lightweight formats.

Slices:

- **M2A - Notebook skeleton** - done 2026-07-02
  - Create `notebooks/build-workbook.ipynb`.
  - Include clear cells for uploading/choosing fixture data, running
    calculations, and exporting files.
  - Validate by running all cells without manual edits.

- **M2B - Ingestion and calculations** - done 2026-07-02
  - Parse CSV, Excel, HTML, and structured text fixtures.
  - Reuse the same normalized transaction shape for every format.
  - Keep PDF/free-form reconstruction outside the notebook, routed to the
    prompt workflow.
  - Validate fixture parity against the Milestone 1 workbook.

- **M2C - Notebook exports** - done 2026-07-02
  - Generate the CA summary and full workbook outputs.
  - Validate that exported totals match the Milestone 1 reference.

Milestone 2 is complete when the notebook can run end-to-end on fixtures
and produce matching outputs.

## Milestone 3: Rules + Reconciliation

Goal: rules become machine-readable, and checklist/mismatch detection is
testable before the webapp consumes it.

Slices:

- **M3A - Rule JSON population** - done 2026-07-02
  - Populate each `rules/*.json` from its paired markdown rule file.
  - Include effective dates, verification metadata, and structured
    values needed by deterministic logic.
  - Validate every JSON file parses and has a non-empty `values` object.

- **M3B - Rule pair validation** - done 2026-07-02
  - Add a small validation script for `.json`/`.md` rule pairs.
  - Check missing pairs, empty values, and missing verification metadata.
  - Validate by running the script locally.

- **M3C - Reconciliation engine** - done 2026-07-02
  - Add pure functions for checklist diffing and basic cross-source
    mismatch detection.
  - Test against deliberately incomplete and mismatched fixture states.
  - Validate that missing documents and planted mismatches are reported.

Milestone 3 is complete when rules and reconciliation can be tested
without a UI.

## Milestone 4: Webapp

Goal: static client-side webapp that reproduces the validated manual and
notebook flows.

Slices:

- **M4A - Vite React TypeScript scaffold** - done 2026-07-02
  - Create the static app only after Milestone 3 is complete.
  - No backend, database, accounts, or required API keys.
  - Validate with a local build.

- **M4B - Client-side ingestion** - done 2026-07-02
  - Implement CSV, Excel, HTML, and structured text ingestion.
  - Route PDF/free-form text to the guided AI extraction prompt.
  - Normalize every source into one common row shape.
  - Validate with fixtures.

- **M4C - Calculation and rules wiring** - done 2026-07-02
  - Use rule JSON and pure calculation functions.
  - Avoid hardcoded rates in app logic.
  - Validate fixture parity against Milestones 1 and 2.

- **M4D - Guided UI and reconciliation panel** - done 2026-07-02
  - Build the orientation flow, checklist state, simple default view, and
    advanced view toggle.
  - Show consequences/checklist gaps before totals.
  - Validate with a first-time user dry run.

- **M4E - Exports** - done 2026-07-02
  - Generate CA summary and full workbook outputs client-side.
  - Validate both outputs against fixture expectations.

Milestone 4 is complete when the same first-time tester check passes in
the webapp and fixture totals match the reference outputs.

## Current Next Slice

All four milestones' planned slices are built and pass `npm run validate:*`,
but "complete" there means code-complete against the slice's own checklist,
not "ready for a first-time non-technical user" - see README.md's Status
section for the honest gap list. In priority order, what's actually left:

1. ~~Get the webapp hosted somewhere free~~ - done 2026-07-03. Live at
   https://kahanikids.github.io/unravel-tax/ via GitHub Pages, deployed by
   `.github/workflows/deploy-pages.yml` on every push to `main` under
   `webapp/`. README.md's "Start here" now points there first.
2. **Wire NRI/HUF/single-parent calculations**, not just their orientation
   questions and checklists (SYSTEM_SPEC.md Section 14 Phase 2/3): NRE/NRO
   separation, TDS-withheld-vs-owed reconciliation, HUF partition/clubbing
   amounts, minor's-income clubbing amounts.
3. Real first-time-user dry run against the hosted webapp (not just the
   validation scripts), the same bar Milestone 1 used.
