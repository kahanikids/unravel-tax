# Unravel Tax Agent Rules

These rules apply specifically to editing and maintaining the **Unravel Tax** repository. They ensure we align with core non-negotiable constraints, style requirements, validation scripts, and open CA priority items.

## Non-Negotiable Constraints
- **Client-Side Only**: Static/client-side React application with no database, backend, or account creation.
- **Deterministic Math**: Calculation logic must remain deterministic (plain functions/formulas). LLMs are restricted strictly to document text extraction, never calculation.
- **Rules-As-Data**: Tax rates, limits, and rule thresholds live in `rules/*.json`, synced to `webapp/src/rules/data/`. **Never hardcode rates or dates in application logic.**
- **No Personal Data**: Never use real personal or financial data in code, tests, docs, or commits. Use fixtures under `fixtures/` for synthetic test data.
- **Guided UX**: Every user-facing screen must suggest exactly one obvious next step.
- **Simple-By-Default**: Default all results screens to simple mode. Advanced detail should be behind a toggle.

## Commands Reference
- **Sync Rules**: `cd webapp && npm run sync-rules` (runs `scripts/sync-rules.mjs` to rebuild JSON rule files consumed by the app).
- **Run Validation Suite**: `cd webapp && npm run validate:all` (executes ingestion, calculations, reconciliation, guided-UI, and export validators).
- **Run Tests**: `cd webapp && npm run test` (runs Vitest unit tests).
- **Start Local Server**: `cd webapp && npm run dev`.

## CA Review Priorities
For subsequent work, prioritize resolving the following items from `rules/CA-Review-2026-07-06.md`:
1. **Section 80CCD(2) NPS Cap**: Match the government/private rate split under the old regime (private cap may still be 10% vs 14% under the new regime).
2. **Section 87A Rebate Caveat**: Add context to `capital-gains-equity.json` clarifying that the Finance Act 2025 closed the STCG 87A rebate eligibility window for AY 2026-27.
3. **Section 50AA Debt Allocation**: Add the >65% debt/money-market threshold check to classify specified mutual funds as deemed STCG.
4. **ITR-3 Transfer Pricing Exclusion**: Exclude taxpayers subject to Section 92E transfer pricing from the 31 August due date.
5. **Populate MD Stubs**: Fill stubs for `nri-residential-status.md` and `new-act-2025-transition.md`.
