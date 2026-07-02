# Web app

Milestone 4 has started after Milestones 1-3 were validated. This folder
is a Vite + React + TypeScript static app scaffold.

Constraints remain unchanged: no backend, no database, no accounts, no
required API keys. All parsing, rules, calculations, reconciliation, and
exports must stay client-side.

Build order after the scaffold:

1. `src/ingest/` format router and CSV/Excel/HTML/structured-text parsers
   - done in M4B.
2. `src/rules/` rule JSON loading - started in M4C with mirrored rule data.
3. `src/lib/` pure classification, gain calculation, reconciliation, and
   tax estimate functions, validated against `../fixtures/` - calculation
   parity done in M4C.
4. `src/components/` guided workflow, persistent "things to check" panel,
   simple view, advanced view, and exports.
