# Contributing

The highest-value contribution to this project is a rules update after
a Union Budget or a mid-year Finance Act amendment — tax rates and
thresholds change more often than the code does, and a stale rate is
the single most damaging kind of bug here.

## Updating a rule after a Budget or Finance Act change

1. Update the relevant `rules/*.json` file (machine-readable, what the
   app/templates actually read) and its paired `rules/*.md` file
   (human-readable explanation) together — never one without the other.
2. Bump the "Last verified: [date] against [source]" line at the top of
   the `.md` file.
3. Add a dated entry to `CHANGELOG.md` describing what changed and why.
4. Search the repo for the old value (rate, threshold, due date) before
   assuming you've caught every place it appears — hardcoded due dates
   or rates sometimes leak into copy, prompts, or fixtures.
5. If the change affects which ITR form applies to any profile, or a due
   date, check `rules/itr-form-selection-*.md` specifically — form
   selection logic is a common place for a change to have a
   second-order effect.

## Adding a new profile-specific rule

Follow the tone already used in the existing `rules/` files: explain the
rule to someone who's never heard of it, not to someone who already
knows the Income Tax Act. Cite a source. State which financial year or
assessment year it applies from.

## Code contributions (webapp/, notebooks/)

Not started yet — see `BUILD_PLAN.md` Section 12 for the milestone
order. Please don't start on `webapp/` ahead of Milestones 1–3; the
spreadsheet + prompt pack path needs to work standalone first, both
because it ships value immediately and because it's the reference
implementation later work gets checked against.

## Ground rules

- Never commit real personal or financial data — PAN numbers, account
  details, actual filing figures. Use `fixtures/` for synthetic test
  data only.
- No backend, no database, no accounts — this is a hard constraint, not
  a preference. See `CLAUDE.md` and `BUILD_PLAN.md` Section 9.
