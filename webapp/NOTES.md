# Web app

Milestone 4 has started after Milestones 1-3 were validated. This folder
is a Vite + React + TypeScript static app scaffold.

Constraints remain unchanged: no backend, no database, no accounts, no
required API keys. All parsing, rules, calculations, reconciliation, and
exports must stay client-side.

Build order after the scaffold:

1. `src/ingest/` format router and CSV/Excel/HTML/structured-text parsers.
2. `src/rules/` rule JSON loading.
3. `src/lib/` pure classification, gain calculation, reconciliation, and
   tax estimate functions, validated against `../fixtures/`.
4. `src/components/` guided workflow, persistent "things to check" panel,
   simple view, advanced view, and exports.
