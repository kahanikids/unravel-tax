# Security Policy

## Supported versions

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

The hosted demo at [kahanikids.github.io/unravel-tax](https://kahanikids.github.io/unravel-tax/)
tracks the `main` branch.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities through one of these channels:

1. **Preferred:** [GitHub Security Advisories](https://github.com/kahanikids/unravel-tax/security/advisories/new)
   (private report to maintainers)
2. **Alternative:** Open a GitHub issue and ask maintainers to move the
   conversation private before sharing details

We aim to acknowledge reports within a week. Fixes depend on severity and
maintainer availability (this is a part-time open source project).

## Scope

In scope:

- Client-side issues in the webapp (for example XSS via ingested file content
  or exported workbook generation)
- Dependency vulnerabilities with a plausible exploit path in this app
- Data-handling claims: the app is designed to run locally with no backend;
  reports that contradict that design are in scope

Out of scope:

- General tax calculation correctness (use a [rule correction issue](https://github.com/kahanikids/unravel-tax/issues/new/choose) instead)
- Issues in third-party AI chat tools used for PDF extraction (the repo only
  ships copy-paste prompts; it does not call external APIs)

## What not to include in a report

Never attach real personal or financial data: PAN numbers, account numbers,
actual filing figures, or full broker statements. Use synthetic examples or
the files in `fixtures/` instead.
