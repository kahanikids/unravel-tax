# Roadmap

Public list of what is planned but not yet shipped. For what works today,
see the webapp "Tools Features" panel or `CAPABILITIES` in
`webapp/src/lib/copy.ts`.

Items are ordered roughly by user impact, not commitment date.

## Planned

### Advance tax interest — Section 234C

Estimating interest for late quarterly instalments (234C) is not built yet.
The tool has a partial 234B estimator; 234C needs income dated by quarter,
which this workflow does not capture today.

### Carry forward from last year's filing

Importing a previous year's exported workbook to reuse profile answers and
carry-forward loss figures is not built yet.

### Full NRI, HUF, and single-parent calculations

These profiles get the right checklist and orientation today. Partial work
exists (NRE exempt interest, minor's-income clubbing). Still deferred:

- DTAA and repatriation treatment for NRI
- NRO TDS rate precision and refund reconciliation
- HUF partition and Section 64(2) transfer clubbing (needs asset-level inputs)
- Single-parent clubbing exceptions (minor's own skill income, Section 80U)

The webapp states these gaps plainly in "Things to check" and points complex
cases to a CA.

## How to help

- **Rule corrections** after a Budget: highest priority — see
  [CONTRIBUTING.md](CONTRIBUTING.md)
- **Code for a roadmap item:** open an issue first so scope matches what
  maintainers expect
