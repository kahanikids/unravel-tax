# Contributing

Thank you for helping improve Unravel Tax. The highest-value contribution
is a **rules update after a Union Budget or mid-year Finance Act amendment** —
tax rates and thresholds change more often than the code does, and a stale
rate is the single most damaging kind of bug here.

This project is maintained part-time. **Rule corrections are prioritised**
over new features. We aim to acknowledge issues within about a week.

## How to report problems

Use the [issue templates](https://github.com/kahanikids/unravel-tax/issues/new/choose):

- **Rule correction** — wrong rate, threshold, or due date after a Budget
- **Bug report** — calculation, ingest, or export behaviour
- **UX or copy** — confusing screen or wording

For security issues, see [SECURITY.md](SECURITY.md) — do not post exploits publicly.

For general questions (not bugs), use the closest issue template for now.
GitHub Discussions can be enabled later if question volume grows.

Read [DISCLAIMER.md](DISCLAIMER.md) before relying on any output for filing.

## Updating a rule after a Budget or Finance Act change

1. Update the relevant `rules/*.json` file (machine-readable) and its paired
   `rules/*.md` file (human-readable) together — never one without the other.
2. Run `cd webapp && npm run sync-rules` to copy JSON into
   `webapp/src/rules/data/`.
3. Bump the **Last verified:** line at the top of the `.md` file.
4. Add a dated entry to [CHANGELOG.md](CHANGELOG.md) describing what changed and why.
5. Search the repo for the old value (rate, threshold, due date) before
   assuming you've caught every place it appears.
6. If the change affects ITR form selection or a due date, check
   `rules/itr-form-selection.md` specifically.

## Adding a new profile-specific rule

Follow the tone in existing `rules/` files: explain the rule to someone who's
never heard of it, not to someone who already knows the Income Tax Act. Cite a
source. State which financial year or assessment year it applies from.

## Code contributions (webapp/, notebooks/, scripts/)

### Local setup

```bash
cd webapp
npm install
npm run validate:all
```

`validate:all` runs rule-sync check plus ingest, calculations, reconciliation,
guided UI, and export validators.

Run `npm run test:coverage` to run that same validator suite under Vitest and
print a code coverage report for `src/`. Use `npm run test` for a quicker run
without coverage instrumentation.

When you edit `rules/*.json`, always run `npm run sync-rules` before committing.

Root rule pairs (markdown + JSON structure) are also checked by:

```bash
python scripts/validate-rule-pairs.py
```

### Pull requests

- Keep PRs small and focused.
- Match existing naming and plain-language copy conventions.
- Use the [pull request template](.github/pull_request_template.md).
- CI runs validators on changes to `rules/`, `webapp/`, `scripts/`, or `fixtures/`.

Planned work is listed in [ROADMAP.md](ROADMAP.md). Open an issue before
starting a large feature so scope matches maintainer expectations.

## Ground rules

- Never commit real personal or financial data — PAN numbers, account
  details, actual filing figures. Use `fixtures/` for synthetic test data only.
- No backend, no database, no accounts — hard constraint. See `CLAUDE.md` and
  `docs/BUILD_PLAN.md` Section 9.
- Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
