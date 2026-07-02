# Web app

Deliberately not scaffolded yet. This is Milestone 4 (BUILD_PLAN.md
Sections 12–13) — do not start on this ahead of Milestones 1–3.

Per CLAUDE.md and BUILD_PLAN.md Section 13, when this does get built:
Vite + React + TypeScript, static/client-side only, no backend, no
database, no accounts. Stack detail and reasoning in BUILD_PLAN.md
Section 13 and SYSTEM_SPEC.md Section 15.2.

Build order once started: format router (`src/ingest/`) → rules loader
(`src/rules/`) → pure calculation functions (`src/lib/` — classification,
gain-calc, reconciliation, tax-estimate, unit-tested against
`../fixtures/`) → components. Reconciliation engine wired into a
persistent "things to check" panel, simple/advanced toggle per Section 5.
