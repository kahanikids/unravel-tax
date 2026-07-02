# Project instructions

This repo builds a free, non-technical-friendly tool that helps someone
organize Indian income tax filing data — from whatever document formats
they have — and produce two output files: a concise summary for a CA,
and a full detailed workbook to keep.

Full context lives in `BUILD_PLAN.md` (journey, design principles, repo
scaffold, milestones) and `SYSTEM_SPEC.md` (problem statement, workbook
data model, rules library, drafted from a real filing session). Read
both before making any structural decision — this file is the
condensed, always-apply subset of that context.

## Non-negotiable constraints
- No backend, no database, no accounts. Static/client-side only. If a
  task seems to need a server, stop and flag it rather than adding one.
- All tax calculation logic must be deterministic (spreadsheet formulas
  or plain functions), never delegated to an LLM at runtime.
- Format parsing follows Section 3 of BUILD_PLAN.md exactly: CSV, Excel,
  HTML, and structured text are parsed directly, client-side, no AI
  involved. Only PDF and free-form text route through the AI extraction
  prompt. Do not build a bespoke PDF table parser — that's a deliberate
  decision, not a gap to fill in later.
- Every format, once ingested, normalizes into one common row-shape
  before touching any downstream logic. Don't let format-specific
  handling leak past the ingestion layer.
- Tax rates/thresholds/rules live in rules/*.json, versioned by financial
  year, paired with rules/*.md for humans. Application code reads the
  JSON; never hardcode a rate in application logic.
- Every user-facing flow must have exactly one obvious next action at
  each step. Before adding any choice/setting/option the user sees,
  check Sections 1 and 2 of BUILD_PLAN.md — if it's not resolvable by
  inference from what's already known, it shouldn't be a user-facing
  choice.
- The reconciliation engine (Section 4) runs on every dashboard view, not
  only on request. Don't make checklist-gap detection something the user
  has to trigger.
- Default every results view to simple mode (Section 5). Advanced detail
  is always one explicit toggle away, never the landing state.
- Never use real personal or financial data in code, tests, docs, or
  commit messages. Use fixtures/ for synthetic test data only.

## Style
- Plain language over tax jargon in anything user-facing.
- Every rules/ file should read like it's explaining the rule to someone
  who's never heard of it, not summarizing for someone who already knows
  the Income Tax Act.

## Priorities (in order)
1. Correctness of the calculation logic (test against fixtures/ before
   anything else).
2. The guided flow actually being guiding — re-read Section 1 of
   BUILD_PLAN.md before building any user-facing step.
3. Everything else.

## Build order
Milestones are sequential and each is a checkpoint against the user
journey, not just a feature list (BUILD_PLAN.md Section 12). Do not
start Milestone 4 (the web app) before Milestones 1–3 are done and
validated:
1. Template workbook + guided chat prompt pack (manual loop, all profiles)
2. Colab notebook (zero-install alternative, lightweight formats only)
3. Reconciliation engine + rules-as-data (rules/*.json)
4. Web app (webapp/ — do not scaffold early, see BUILD_PLAN.md Section 13)

## When rules change (after a Budget or Finance Act amendment)
Update the relevant rules/*.json and rules/*.md together, bump the
"Last verified" date in the .md, add a CHANGELOG.md entry, and check
whether any hardcoded due dates or rates elsewhere in the repo need the
same update (search for the old value across the repo, don't assume it's
only in one place).
