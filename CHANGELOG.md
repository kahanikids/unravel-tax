# Changelog

Dated log of rule changes and notable project milestones. Rule changes
should reference the `rules/` file(s) touched and the source for the
change (Budget, Finance Act, CBDT circular).

## 2026-07-03

- **Hosted the webapp on GitHub Pages** at
  https://kahanikids.github.io/unravel-tax/ - the top-priority gap called
  out in README.md/WORKING_PLAN.md, since a first-time non-technical user
  was never going to `git clone` and run `npm install`. Added
  `.github/workflows/deploy-pages.yml` (builds and deploys on every push
  to `main` touching `webapp/`), a `GITHUB_PAGES`-gated base path in
  `vite.config.ts` (local `npm run dev`/`npm run build` are unaffected),
  and made the header logo path base-aware so it resolves under the
  `/unravel-tax/` project-site prefix. Updated README.md's "Start here"
  and Status sections to lead with the live link, local `npm run dev` is
  now the fallback for contributors, not the primary path.
- Added "Where do I get this?" guidance to checklist documents (new
  `DOCUMENT_SOURCE_GUIDE` in `src/lib/copy.ts`, rendered via a new
  `DocumentSourceHint` component on both the main checklist step and the
  persistent sidebar). Covers the broker/AMC capital gains statement,
  Form 26AS/AIS, dividend statements, bank interest certificates, and
  Form 16, since a first-time filer often doesn't know which website or
  menu to look under. Static reference copy, not a live integration.
- Copy pass across all user-visible webapp text and README.md: removed
  dashes used as sentence punctuation (" - " standing in for a comma,
  period, or parenthesis), rewriting as separate sentences or comma/colon
  joins instead. Left hyphens in actual compound words (`self-file`,
  `non-technical`, etc.) and code comments untouched. Also fixed the
  welcome screen's "Any file format" badge to "Most File Formats" (it
  overstated PDF/free-form handling, which routes through the guided
  extraction prompt rather than being parsed directly).
- Added a "?" help button in the header (`HelpPanel`, visible on every
  screen including welcome): how the guided flow works, who the tool is
  for, and a fuller plain-language disclaimer, all in one place instead of
  spread across every screen. Centralized disclaimer/how-it-works/who-it's-
  for copy in `src/lib/copy.ts` (single source, was duplicated inline
  before). Tightened wording on the welcome screen and the checklist/
  upload step ledes.
- Made the header step indicator (`ProgressSteps`) into real navigation:
  any step already reached this filing is now a clickable button, so
  users can jump back to the checklist/documents/results without
  restarting from the welcome screen. Steps not yet reached stay inert -
  never a way to skip ahead. Tracked via a new `furthestStepIndex`, saved
  in the session cache so it survives a resume.
- Fixed `OrientationForm` to resume at the first unanswered question (or
  the last one, if all are answered) when navigated back to, instead of
  always restarting at Question 1.
- Swapped the header logo to the new artwork (`webapp/public/unravel-tax-logo.png`,
  cropped from the full lockup to fit the header) and updated README's
  hero image to the same new logo.
- Added `webapp/DESIGN_NOTES.md` capturing a user-provided dashboard
  reference image and how (and how much) it informed the nav decision
  above, so the reference doesn't need to be re-shared.

## 2026-07-02 (post-M4 hardening, PM review follow-up)

- Fixed a correctness gap: debt/specified mutual funds (Section 50AA) were
  silently classified using equity STCG/LTCG rates. Added an optional
  `Instrument Type` ingest column (defaults to "equity" for backward
  compatibility) and a separate "short-term-deemed, slab rate" bucket in
  calculations, exports, and the CA Summary rows, per
  `rules/capital-gains-mutual-funds.json`.
- Added the hard-block popup BUILD_PLAN.md Section 1.4 calls for on
  form-changing/recommendation-changing risk triggers (e.g. a trade moving
  someone to ITR-3). These previously only showed inline in the sidebar.
- Added "Known limits for your profile" caveats for NRI/HUF/single-parent
  flags, so the checklist doesn't imply calculation coverage (TDS
  reconciliation, NRE/NRO split, HUF partition, minor's-income clubbing
  amounts) that isn't wired in yet - those remain Phase 2/3 per
  SYSTEM_SPEC.md Section 14.
- Added localStorage session caching (BUILD_PLAN.md Section 9: resume
  convenience only, never the system of record) - orientation answers,
  documents, supplemental figures, and acknowledged risk triggers persist
  across a closed tab, with a "Resume where you left off" welcome-screen
  action and a "Start over" control to clear it.
- Added local-folder saving via the File System Access API (Chromium
  browsers, with a download fallback everywhere else): users can pick a
  folder once and have submitted documents and generated exports (CA
  Summary CSV/XLSX, full workbook) written straight there instead of
  piling up in Downloads.
- Fixed a pre-existing bug in `validate:guided-ui`: adjacent JSX
  expressions (`Question {index + 1} of {visible.length}`) get React SSR
  hydration comment markers inserted between them, so the literal substring
  assertion never matched. Collapsed to a single template-string expression.
- Reconciled README.md/WORKING_PLAN.md's contradictory status ("early
  scaffold" vs. "all slices complete") and pointed "Start here" at real
  local-run instructions (`cd webapp && npm install && npm run dev`) since
  there's no hosted link yet - that's now called out as the top remaining
  gap in both files.
- Removed a path reference in `templates/master-template.gsheet-link.md`
  that named an external file identifying a real person's financial data,
  per this repo's own "never real personal data in docs" rule.

## 2026-07-02

- Completed M4E: added browser-side CA Summary CSV/XLSX and full workbook
  XLSX generation, surfaced fixed export actions in the webapp handover
  panel, warned when checklist/reconciliation issues remain, and validated
  generated outputs against fixture expectations with
  `npm run validate:exports`.
- Completed M4D: ported reconciliation into the webapp, added a guided
  orientation/review flow with a persistent "Things To Check" panel, kept
  simple view as the first-time default with an explicit advanced-detail
  toggle, and validated that checklist consequences render before totals
  with `npm run validate:guided-ui`.
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
