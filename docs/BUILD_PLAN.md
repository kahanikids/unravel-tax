# Unravel Tax — Build Plan for Claude Code

This is an execution-ready plan. Hand this file to Claude Code in an empty repo and it has enough to scaffold, build, and validate against, phase by phase. It is written journey-first on purpose: the user experience was mapped before any technical decision was finalized, and every technical choice below traces back to a specific point in that journey. If a future change conflicts with the journey, the journey wins — don't let implementation convenience quietly reshape the product.

## 0. One-line brief

A free, non-technical-friendly system that turns a pile of Indian tax documents — in whatever format they arrive in — into two clean output files: one to hand a CA, one to keep. A spreadsheet-shaped calculation engine does the arithmetic; a general-purpose AI chat (used at zero cost) does the guiding and the one job a browser genuinely can't do alone (reading a messy PDF). The system stays lightweight everywhere it can, and is explicit about the one place it can't (Section 3).

## 1. User journey — read this before touching Section 6 onward

### 1.1 Who's arriving

Someone who handles tax filing for themselves and often their family, dreads it every year, has a drawer (or inbox) full of PDFs they haven't opened, and is anxious about getting something wrong — not about the math being hard, but about not knowing what they don't know. They may never have used an AI chat tool, or only used the free version once or twice. They are not going to install anything, read documentation, or troubleshoot an error message.

### 1.2 The eight stages

**Stage 1 — First contact.** They land on the project's front door (a README, eventually a one-page site). At this moment they are deciding whether this is worth their time in the next ten seconds. There must be exactly one obvious next action — not three, not "choose your adventure." Anything that looks like a decision here loses the user.

**Stage 2 — Orientation.** The tool needs to know their situation: resident or NRI, part of a joint family (HUF), 60 or older, sole parent handling this, any job changes, HRA, EPF withdrawals. The failure mode to avoid is presenting this as a form full of tax jargon ("Select applicable ITR schedule"). It has to read like a short conversation in plain language, one or two questions at a time, and the tool — not the user — translates the answers into what actually matters technically (which template tabs, which rules apply, which ITR form). The user should never be asked to self-classify using terms they don't know.

**Stage 3 — The ask.** Based on Stage 2, the tool hands back a short, personal document checklist — not the generic universal list. Ordered by how easy each item usually is to get (salary/pension slip first, broker statements last, since those often need a portal login). This is where people historically stall for weeks; the checklist has to feel finishable, not exhaustive. This checklist isn't a one-time handout — it's the reference the reconciliation engine (Section 4) checks against for the rest of the journey.

**Stage 4 — The handoff loop.** For each document, in whatever format it arrives (PDF, Excel, HTML, CSV, plain text — see Section 3): submit it once, get it turned into clean data, confirm it looks right, done. This is the highest drop-off-risk step in the whole journey — it's the first "technical" thing they do. It must be a single repeatable motion done identically every time, regardless of source format, with unambiguous instructions and a confirm-before-commit check (Section 1.4) — never "figure out where this goes" or "hope the extraction was right."

**Stage 5 — The reveal.** Numbers are now computed. A wall of figures and coloured cells is not a result, it's raw material. The tool must translate it back into plain language before the user is left alone with it — and it must lead with what's urgent (any risk trigger, any checklist gap) before it leads with totals. Consequences before data, always. This is where the reconciliation engine (Section 4) does its most visible work.

**Stage 6 — The decision.** Self-file, or hand to a CA? The tool should recommend, not poll. If the profile includes NRI, HUF, business/speculative income, or any risk trigger fired, the tool says plainly "get a CA to review this before filing" — it doesn't present it as an open question the user has to weigh with information they don't have.

**Stage 7 — The handover.** Two files come out, and their purposes must be unmistakable from the filename alone: one for the CA, one to keep. No settings to configure, no format to choose. Both are available from either the simple or the advanced view (Section 5) — the view the user is looking at doesn't gate what they can export.

**Stage 8 — The close.** Filing is done. The tool should say, explicitly, what happens next — that losses carry forward and need this same file next year, that the exported workbook is the thing to keep, not the chat history. This sets up next year's Stage 1 to start faster.

### 1.3 What the journey rules out

Explicitly, because agentic build tools tend to add these back in the name of flexibility:
- No landing-page choice between "spreadsheet mode," "Colab mode," "web app mode" shown to a first-time user. One default path. Alternatives exist for people who ask for them, not as an upfront fork.
- No "which tabs do you want to keep" question. The tool decides from the Stage 2 answers and hands over exactly what's needed.
- No file-format picker on export. Both fixed outputs are always generated; the user picks which one to send where, not how it's built.
- No account, login, or saved-preferences system — see Section 9 (Non-goals).
- No requirement to pick a source-file format before uploading. The tool detects it (Section 3) — the user's job is to hand over the document, not to classify it first.

### 1.4 Where disclaimers, instructions, and popups belong

Every stage gets exactly the amount of interruption it needs — not zero, not maximum. The two moments that should hard-block progress with a popup are marked; everything else is inline copy the user can read or skim past.

| Stage | What appears | Type |
|---|---|---|
| 1. First contact | "This organizes your numbers — it doesn't replace a CA." Shown once, dismissible, remembered afterward. | Banner, not a popup — don't block the first action with a legal wall. |
| 2. Orientation | One line under the first question: answers only shape what's asked next, nothing is submitted anywhere. | Inline. |
| 3. The ask | Each checklist item states plainly why it's needed and what happens if it's skipped. | Inline, part of the checklist itself. |
| 4. Handoff loop | Before submitting a document: one line on what formats are accepted. After extraction, before the data is used anywhere: "here's what we read from this — confirm or fix it." | **Popup, blocking.** A bad extraction propagates into every downstream number, so this is the one step that should stop the user until they've looked. |
| 5. The reveal | Any newly-fired routine risk trigger: inline flag in the "things to check" panel. Anything that would change which ITR form applies, or that materially changes the recommendation in Stage 6: a popup. | Inline for routine flags; **popup for form-changing or recommendation-changing triggers only.** |
| 6. The decision | The CA-or-self-file recommendation, stated plainly with one line of reasoning. | Inline — it's information, not a blocker. |
| 7. The handover | If the checklist still has open items when export is requested: "N things are still missing — export anyway, or go back?" | **Popup, but not a hard block** — the user can proceed knowingly; this is a confirm, not a wall. |
| 8. The close | A short reminder of what to keep and what changes next year. | Inline. |

## 2. Design principles (derived from Section 1, not invented separately)

1. **Single entry point.** One README, one first action, always.
2. **Infer, don't interrogate.** Every question is plain language; the mapping to tax categories/forms/tabs happens in code or in the guided chat, never exposed to the user as a choice.
3. **Progressive disclosure.** Show only what's relevant to the profile just established. A resident with no business income never sees an NRI tab exist.
4. **Recommend, don't poll.** Anywhere the tool has enough information to give a verdict (which tab, which form, CA-or-self-file), it gives the verdict. Open questions are reserved for things only the user can know.
5. **Consequences before data.** Risk and checklist-gap information is surfaced before raw totals, every time results are shown.
6. **Normalize once, at the edge.** Every source format gets converted into one common shape immediately on ingestion (Section 3) — nothing downstream (reconciliation, calculation, reporting) ever needs to know or care what format a number originally came from.
7. **Simple by default, advanced on request.** The default view is plain numbers and plain language; full detail is one deliberate action away, never the starting point (Section 5).
8. **The export file is the system of record.** No backend, no account, no server-side storage of financial data — the two exported files are what persists, by design (Section 9).
9. **The calculation engine is deterministic and inspectable.** All classification, gain, and tax-estimate logic lives in formulas or plain functions — never computed by an LLM mid-conversation. An LLM's job is document extraction and plain-language explanation, not arithmetic that has to be right every time.

## 3. Format ingestion — lightweight by default, one real exception

This section answers directly: most of this can stay lightweight, entirely client-side, no server, no AI step. One format genuinely can't, and it's worth being precise about why, because the reason isn't "it needs more infrastructure" — it's that the underlying problem (reconstructing a table from a PDF) doesn't have a reliable non-AI answer.

Every format funnels into one internal shape before anything downstream ever sees it — a plain list of rows with named columns. Nothing past this point knows or cares what format a number originally came from.

| Format | Stays lightweight (client-side, no AI)? | Why |
|---|---|---|
| CSV | Yes | A solved problem — any small, well-maintained parsing library handles it fully in-browser. |
| Excel (.xlsx) | Yes | A browser-side spreadsheet-reading library reads it fully client-side, no server round-trip. |
| HTML | Yes, mostly | Every browser can parse HTML natively — no library needed at all to walk its tables. The real work is picking the *right* table when a source file bundles several (broker reports commonly mix summary blocks, disclaimers, and the actual transaction table in one file) — a light heuristic (largest table, or one matching expected column headers) handles this; it's not a heavy problem, just one that needs a specific, testable rule rather than assuming the first table is the right one. |
| Plain text, already structured (tab/comma-separated) | Yes | Parses the same way CSV does. |
| Plain text, free-form (a pasted email, an unformatted statement) | No | No lightweight answer exists for genuinely unstructured text — this is a job for the AI step, same as PDF below. |
| PDF | **No — this is the real exception.** | Extracting raw text from a PDF client-side is lightweight (a standard library does it in a few lines). Extracting a *clean table of transactions* is not — PDFs preserve visual position, not table structure, and every broker's layout differs. Bespoke per-broker PDF table parsers are a maintenance trap: brittle, and there are dozens of brokers. This is the one format that should route through the AI extraction step already in the plan, rather than a hand-built parser. |

Practically: CSV, Excel, HTML, and structured text are parsed directly in the browser, instantly, with no AI involvement at all. PDF and free-form text go through the same "hand it to the chat, get a clean table back" step from Section 7 — and once that clean table comes back, it re-enters the exact same lightweight pipeline as everything else, because a clean table is just structured text. The AI dependency is isolated to the one place it's actually earning its keep, not spread across the whole ingestion layer.

This is also why Stage 4's confirm-before-commit popup (Section 1.4) matters most for PDF and free-form text specifically — those are the two paths where something can plausibly have been misread, and the user should see that before it's used anywhere.

## 4. Reconciliation & proactive checklist engine

A lightweight, client-side state tracker, not a service — no backend, no database, matching the constraints in Section 9.

Every item on the Stage 3 checklist has a status (needed / uploaded / completed / confirmed), held in the same browser-local state as everything else. On every dashboard view — not only when the user asks — the engine:

1. **Diffs current state against the full checklist** and surfaces anything still missing, ranked by how much it would likely change the numbers (a missing dividend statement ranks above a missing minor administrative detail).
2. **Cross-checks figures that should agree** wherever more than one source touches the same number (for example, TDS shown on a submitted certificate versus a reconciliation total elsewhere) and flags a mismatch rather than silently trusting whichever value was entered last.
3. **Feeds directly into the "things to check" panel** — the same panel that replaces a chart on the dashboard (see the earlier mockup) — so this is never a separate screen the user has to remember to visit. It's the first thing they see, every time.

This is the mechanism that makes the tool proactive rather than passive: the user should never have to ask "what do I still need to give you." The dashboard already knows, and says so.

## 5. View modes — simple by default, advanced on request

Two views over the same underlying state, not two separate tools, and not a crippled-trial-vs-full-version split.

**Simple (default)** — the CA Summary shape: category totals, plain language, the "things to check" panel, export buttons. What every first-time user sees, always.

**Advanced (opt-in, one explicit toggle)** — the Detailed Summary shape: full working, formula-level detail, rule citations, every raw row. Reached by one deliberate action ("Show full detail"), never the default, never required to reach export.

Both views read from identical underlying data, and both can export either output file at any time. The split governs how much is shown, not what's possible — advanced mode doesn't unlock export, and simple mode isn't missing anything the export needs.

## 6. Repo scaffold

```
unravel-tax/
  README.md                       <- Stage 1 of the journey lives here, see Section 10
  CLAUDE.md                       <- project instructions for Claude Code, see Section 11
  LICENSE                         <- MIT or Apache-2.0
  CONTRIBUTING.md                 <- how to submit a rule update after a Budget
  CHANGELOG.md                    <- dated log of rule changes

  templates/
    master-template.gsheet-link.md
    excel-export/
      UnravelTax-Template.xlsx

  prompts/
    00-master-guide.md            <- single entry-point conversation, see Section 7
    01-extract-statement.md       <- covers PDF and free-form text specifically, see Section 3
    02-explain-my-results.md

  rules/
    capital-gains-equity.md / .json
    capital-gains-mutual-funds.md / .json
    dividends.md / .json
    regime-choice.md / .json
    itr-form-selection.md / .json
    filing-mistakes-and-penalties.md / .json
    nri-residential-status.md / .json
    nri-nre-nro.md / .json
    nri-tds-and-refunds.md / .json
    nri-dtaa.md / .json
    nri-repatriation.md / .json
    huf-basics.md / .json
    huf-clubbing.md / .json
    senior-citizen-basics.md / .json
    senior-citizen-advance-tax-and-regime.md / .json
    single-parent-clubbing.md / .json
    single-parent-alimony.md / .json

  notebooks/
    build-workbook.ipynb          <- Colab-ready, see Milestone 2

  webapp/                         <- shipped primary static app, see Section 13
    src/
      ingest/                     <- format router + per-format parsers, see Section 3
      rules/
      lib/                        <- classification, gain-calc, reconciliation, tax-estimate — pure functions, unit-testable
      components/
    package.json

  fixtures/
    sample-broker-statement.csv
    sample-broker-statement.html  <- includes 2-3 noise tables alongside the real one, mirrors real-world broker reports
    sample-broker-statement.xlsx
    sample-pdf-extracted-text.txt <- what a PDF text-extraction step typically returns, for testing the AI-assisted path
```

## 7. The single entry-point conversation

Stage 1's "no menu" rule means the Prompt Pack should not hand the user three files to choose between up front. One guided conversation the user starts once, that internally walks through orientation, tells them what to do at each following stage, and only hands them the extraction behaviour at the moment they actually have a document ready — in whatever format it's in.

`prompts/00-master-guide.md` (system behaviour for the whole session):

```
You are guiding a non-technical person in India through gathering and
organizing their income tax filing data. You are not a CA and must say so
plainly if asked for final tax advice — recommend professional review
before filing, especially for NRI, HUF, business income, or any flagged
risk trigger.

Never present the user with an unexplained choice between technical
options. Your job is to figure out what they need and tell them, not to
ask them to pick.

Step 1 — Orientation. Ask, one or two at a time, in plain language, never
using tax jargon as the question itself:
- Are you living in India right now, or outside India, for this financial
  year?
- Is any of this income or investment held through a family (HUF) rather
  than just you personally?
- Are you 60 or older?
- Are you the only parent/guardian handling this, for yourself and any
  children?
- What kinds of income do you have: a job or pension, bank interest,
  shares or mutual funds you sold this year, dividends, rent, anything
  else?
- Did you change jobs this year, or have income from more than one
  employer?
- Do you pay rent and claim it against your salary (HRA)? If so, is it
  over roughly 8,300/month (₹1 lakh/year)?
- Did you take money out of your provident fund this year?

Do not ask all of these at once. Have a short back-and-forth.

Step 2 — Tell them what they need, don't ask them to choose. Based on
their answers:
- Tell them which sections of the template spreadsheet apply to them —
  don't list all options, just state what's relevant, briefly explaining
  why in one sentence per item.
- Give them a document checklist, personal to their answers, ordered
  easiest-to-hardest to obtain, each item stating why it's needed.
- State plainly any risk triggers from rules/filing-mistakes-and-penalties.md
  that apply based on what they've told you.
Do not calculate anything yet.

Step 3 — When they say they have a document ready, accept it in whatever
format they have (PDF, Excel, CSV, a webpage saved as HTML, or pasted
text) and switch to the extraction behaviour in
prompts/01-extract-statement.md for that one document. Always show them
what was read back and ask them to confirm it before moving on — never
assume an extraction was correct.

Step 4 — When they say all their documents are in, switch to
prompts/02-explain-my-results.md, leading with anything still missing
from the checklist before any numbers.

Throughout: give a direct recommendation at Step 4 on self-filing vs
getting a CA, based on their profile and any risk triggers — do not leave
this as an open question for them to weigh.
```

`prompts/01-extract-statement.md`:

```
I'm sharing one document — it could be a PDF, an Excel file, a CSV, a
saved webpage, or pasted text. Read it and output ONLY a table with these
exact columns, one row per transaction:

Scrip/Fund Name | Purchase Date | Sell Date | Units | Buy Value | Sell
Value | Buy Price | Sell Price

Rules:
- If the source has more than one table (common in saved broker
  webpages), use the one that actually contains transaction rows, not a
  summary or disclaimer table — tell me which one you used.
- If the file has subtotal or summary rows mixed in with transaction
  rows, drop the subtotal rows — I only want individual transaction
  lines.
- Use DD-MMM-YYYY date format.
- Do not classify long-term/short-term yourself, and do not calculate
  gains yourself — that logic lives elsewhere and runs the same way every
  time, which matters more than doing it here.
- If any transaction is missing a purchase date or sell date, flag it in
  a separate line after the table instead of guessing.
- Output the table in a format I can copy straight into a spreadsheet
  (tab-separated or markdown table, your choice, just tell me which).
- End with one line summarizing what you read and how confident you are,
  so I can decide whether to double-check before using this.
```

`prompts/02-explain-my-results.md`:

```
I'm going to paste my results (or a screenshot). Explain them back to me
in plain language, in this order:
1. Anything still missing from my checklist, and anything from the
   risk-trigger list that applies to me — first, before any numbers.
2. What I owe or am owed, in one sentence per income type, in plain
   language, not tax section numbers.
3. What's uncertain or needs my input.
4. Your direct recommendation: am I in self-filing territory, or should I
   get this reviewed by a CA before filing — and why, in one sentence.
Don't just repeat the numbers back to me — tell me what they mean.
```

## 8. Synthetic fixture data (for building and testing — not real data)

Claude Code should build and test the ingestion and calculation logic against small, clearly-fictional fixtures covering every format from Section 3, not against any real statement.

`fixtures/sample-broker-statement.csv` (and the equivalent content in `.xlsx` and `.html` — the `.html` version should additionally include 2-3 short noise tables, e.g. a disclaimer block and a charges summary, positioned before and after the real transaction table, to test the "pick the right table" heuristic honestly):

```
Scrip Name,Purchase Date,Sell Date,Units,Buy Value,Sell Value,Buy Price,Sell Price
Acme Industries,01-Apr-2025,15-Apr-2025,100,50000,51000,500,510
Acme Industries,10-Jan-2024,20-May-2025,50,25000,27500,500,550
Sample Metals Ltd,05-Jun-2025,05-Jun-2025,200,40000,40800,200,204
Sample Metals Ltd,12-Feb-2023,18-Jun-2025,75,30000,33000,400,440
Test Pharma Co,01-Aug-2025,30-Aug-2025,150,45000,43500,300,290
```

`fixtures/sample-pdf-extracted-text.txt` — a short, deliberately messy block of free-form text (no clean columns, line breaks in odd places) representing what a raw PDF text-extraction pass typically returns, used to test and demonstrate the AI-assisted extraction path specifically, since that path can't be tested with clean tabular fixtures.

This set gives one same-day (intraday) row, one long-term row (>365 days), several short-term rows, a loss case, multiple source formats, and one deliberately messy case — enough to validate the classification formula, the gain formula, the format router, and the "confirm before commit" flow before any real user data touches the system. Use round numbers deliberately so test assertions are easy to eyeball.

## 9. Non-goals (hard constraints, not preferences)

- No backend server, no database, ever. All computation and all format parsing is client-side (browser) or inside a template's own formulas.
- No user accounts, no login, no saved profile server-side.
- No storage of PAN, financial figures, or any personal data outside the user's own exported file and their own browser's local storage (used only as a resume-a-session and checklist-tracking convenience, never as the system of record).
- No requirement for a paid subscription to any AI tool at any point in the primary path.
- No feature that requires the user to make an unexplained technical choice (see Section 1.3), including no format picker on upload (Section 3 handles detection).

## 10. README (Stage 1) — draft

The README is the whole first-contact experience. It should not describe the project before telling the user what to click. Suggested structure:

```
# [Project name]

Turn your tax documents — PDFs, Excel files, CSVs, saved webpages,
whatever you have — into two files: one to send your CA, one to keep.
Free. No signup. No installs.

## Start here

1. [Open the template] — this is your working file, make your own copy.
2. [Open the guided chat prompt] — paste this into ChatGPT (free account
   is fine) and follow along. It will ask you a few questions, then tell
   you exactly what to do next.

That's it. Everything else on this page is background, come back to it
if you want to understand how it works.

## How it works
[Design principles from Section 2, in plain language]

## For NRIs, joint families (HUF), senior citizens, or single parents
[One paragraph per profile, what's different, linking to the relevant
rules/ files]

## Contributing
[Link to CONTRIBUTING.md — rule updates after each Budget are the
highest-value contribution]
```

## 11. `CLAUDE.md` — project instructions

Place this at repo root so Claude Code (or any agent working in this repo) follows it automatically.

```
# Project instructions

This repo builds a free, non-technical-friendly tool that helps someone
organize Indian income tax filing data — from whatever document formats
they have — and produce two output files: a concise summary for a CA,
and a full detailed workbook to keep.

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

## When rules change (after a Budget or Finance Act amendment)
Update the relevant rules/*.json and rules/*.md together, bump the
"Last verified" date in the .md, add a CHANGELOG.md entry, and check
whether any hardcoded due dates or rates elsewhere in the repo need the
same update (search for the old value across the repo, don't assume it's
only in one place).
```

## 12. Milestones — each one is a checkpoint against the journey, not just a feature list

> Current status: these milestones are historical checkpoints, not a current
> build queue. All four have shipped, and the hosted static webapp is now the
> primary user path. Keep this section for acceptance criteria and sequencing
> rationale, but treat the original sequencing gate as completed.

**Milestone 1 — Template + guided chat (Stages 1–7, manual loop).**
Build: the Google Sheets template (all tabs from the data model, Section 14), the Excel export equivalent, `prompts/00-master-guide.md` plus its two sub-prompts (now format-agnostic per Section 3), the full `rules/` library.
Done when: a first-time tester who has never seen the project can go from opening the README to holding a completed CA Summary export, submitting at least one document in a non-CSV format, using only the README and the guided chat, without ever being unsure what to do next. Test this literally — hand it to someone who hasn't seen the repo and watch where they hesitate.

**Milestone 2 — Colab notebook (Stage 4, zero-install alternative).**
Build: `notebooks/build-workbook.ipynb`, porting the classification/gain-calculation/export logic as plain Python functions, plus CSV/Excel/HTML parsing (the three lightweight formats), tested against all of `fixtures/`.
Done when: someone can open the notebook link, run all cells with no edits beyond pasting in their own data or uploading a file, and get the same two export files as Milestone 1 produces.

**Milestone 3 — Reconciliation engine + rules-as-data.**
Build: the checklist-diffing and cross-check logic from Section 4 as plain, unit-testable functions; `rules/*.json` versions of every rules file; a small script that validates every `.json`/`.md` pair stays in sync.
Done when: given a partially-filled checklist state and a set of ingested documents, the engine correctly reports what's missing and flags at least one deliberately-planted figure mismatch in the test fixtures.

**Milestone 4 — Web app (Stages 2–7, in-browser, simple/advanced views).**
Build: static React/TypeScript app per the stack in Section 13, the format router from Section 3 (native HTML/CSV/Excel parsing, PDF/free-text routed to the AI step), the reconciliation engine wired into the final confidence check, the simple/advanced toggle from Section 5, both export formats generated in-browser.
Done when: the same "hand it to a first-time tester" check from Milestone 1 passes using the web app instead of the chat+sheet combination; a side-by-side run of the fixture set through both the spreadsheet and the web app produces identical numbers; and a tester can find the advanced view without being told it exists, but isn't shown it by default.

Historical sequencing rule: the milestones were built in this order so the
manual loop could act as the reference implementation before the webapp. For
current work, preserve parity with the manual path where it matters, but make
user-facing product changes in `webapp/` first unless the issue specifically
targets templates, notebooks, or prompts.

## 13. Web app stack

> Current implementation: the shipped app is Vite + React + TypeScript in
> `webapp/`. It uses `papaparse` for CSV, `read-excel-file` for Excel,
> native `DOMParser` for saved webpages, `pdfjs-dist` only for raw PDF text
> extraction, `write-excel-file` for XLSX exports, and Vitest coverage around
> the validator suite. It remains static, browser-only, and account-free.

| Layer | Choice | Reasoning |
|---|---|---|
| UI framework | Vite + React + TypeScript | Broadly known, easy for outside contributors, fully static-exportable |
| HTML table extraction | Native browser `DOMParser` | No library needed — every browser already does this |
| Spreadsheet read/write | Any actively-maintained, browser-based library that can read and write `.xlsx` client-side | Both export flavours generated entirely in-browser, no server round-trip |
| CSV | Any well-maintained CSV parsing library for the chosen framework | Solved problem, not worth custom-building |
| PDF text extraction | Any actively-maintained, browser-based PDF-to-text library | Only extracts raw text — table reconstruction deliberately routes to the AI step instead, per Section 3 |
| Rules | `rules/*.json`, read at build or runtime | Keeps annual maintenance a data edit, not a code change |
| Reconciliation state | Browser local storage only | Never the system of record — see Section 9 |
| Hosting | Static hosting (e.g. GitHub Pages or an equivalent free static host) | Zero recurring cost |
| Auth | None | Removes the largest trust/liability surface entirely |

Where the AI chat still fits even once the web app exists: PDF table reconstruction and free-form text stay routed to the chat (Section 3), even in the web-app version, unless a specific document format later proves reliable enough to parse natively. Everything else — CSV, Excel, HTML — never touches the AI step at all.

## 14. Workbook / app data model

(Same structure regardless of delivery mechanism — template, notebook, or web app all produce this.)

**Every profile:**
`Profile` (name, PAN, FY, which category flags apply — can be more than one) · one working set per income source (classification/gain-calculation/rule-flag logic) · `Dividends` (quarter-wise, not annual) · `Interest & Other Income` · `Transaction Charges` (split by deductibility rule) · `Carry Forward Losses` (register by year, type, section, original/used/balance/expiry) · `Checklist State` (Section 4 — status per document, drives the "things to check" panel) · `CA Summary` (numbers only, simple view) · `Detailed Summary` (full working, plain-language flags, advanced view) · `ITR Form Guide` (auto-suggested).

**NRI adds:** `NRE-NRO Tracker` · `TDS Reconciliation` (brokers/AMCs withhold TDS on NRI capital gains at source; residents don't have this — this reconciles what was withheld against what's actually owed) · `DTAA & Residency` (treaty country, TRC status, day-count test) · `Repatriation Log`.

**HUF adds:** `Coparceners & Members` · `Transfers Without Consideration` (assets a member puts into the HUF without adequate payment get their income clubbed back to that member, not taxed in the HUF) · `Partition Log`.

**Senior Citizen adds:** `Interest Deduction Tracker` (the enhanced deduction available once someone crosses 60, distinct from the smaller one available to everyone) · `Regime & Advance Tax Flags` (auto-flags if any business/speculative income is present, since that changes both advance-tax exemption eligibility and how freely the tax regime can be switched year to year).

**Single Parent/Guardian adds:** `Minor's Income (Clubbing)` (investments in a child's name get clubbed with the custodial parent) · `Alimony/Maintenance Log` (periodic vs lump-sum, taxed differently).

## 15. Rules content to port (generic — no personal source, transcribe as-is into `rules/`)

### 15.1 Capital gains, listed equity
LTCG: 12.5% flat, no indexation, above a ₹1.25 lakh/year exemption. STCG: 20% flat. Both rates were raised (from 10%/15%) and the exemption raised (from ₹1 lakh) by the Finance Act 2024, effective 23 July 2024 — a mid-year change, not a Budget-cycle one, which is why the rules library needs an "effective date," not just a financial year tag. Surcharge on these specific gains (plus dividend income) is capped at 15% regardless of the taxpayer's total income, even where other income would attract a higher surcharge slab. Section 87A rebate cannot be applied against these specific gains from AY2026-27 onward, following the Finance Act 2025 — this reversed a favourable tribunal ruling from the prior year, a good example of why "last year's answer" can't be assumed current.

### 15.2 Transaction costs
Securities Transaction Tax (STT) is never deductible when computing capital gains — it's excluded by law, not by omission, because paying it is what qualifies the trade for the concessional capital-gains rates in the first place. It is deductible when the same trading activity is instead classified as speculative/intraday business income, since that's a business-income computation with ordinary expense rules. Non-STT transaction costs (exchange fees, stamp duty, statutory charges) are deductible in both cases. A rules-library entry should flag, generically, that broker-provided summary reports don't reliably state whether such costs are already netted into the reported buy/sell values — this needs checking against the underlying contract notes, not assumed either way.

### 15.3 Dividends
Fully taxable at the recipient's slab rate. Must be reported quarter-wise on the return, not as a single annual figure, because advance-tax interest calculations test each quarter against when the dividend was actually received. TDS threshold is ₹10,000 per company per year (raised from ₹5,000 by the Finance Act 2025).

### 15.4 Losses and carry-forward
Short-term capital losses offset both short- and long-term gains; long-term capital losses offset long-term gains only. Both carry forward 8 assessment years from the year they arose. Carry-forward is only preserved if the return is filed by the applicable due date — a late return forfeits it, regardless of whether tax was actually owed.

### 15.5 Risk triggers (surface these actively, per Section 1.4, not passively in a document)

| Trigger | Consequence |
|---|---|
| Wrong ITR form used (e.g. gains/income the simplest form doesn't support) | Return marked defective; a fixed window to refile correctly or it's treated as never filed |
| Reported income/TDS doesn't match the pre-filled annual information statement | Automated mismatch notice |
| More than one employer in the year, TDS not reconciled across both | Under-withholding surfaces as an unexpected shortfall |
| Rent claimed against salary (HRA) above the threshold without the landlord's PAN | Claim rejected on a documentation technicality even if genuine |
| Tax liability after TDS exceeds a small threshold and no advance tax was paid | Quarterly interest charges, compounding the longer it's unpaid |
| Provident fund withdrawn before completing a minimum service period | Tax deducted at source at the time of withdrawal — easy to mistake for a tax-free lump sum |
| Deductions claimed without retained proof | Flagged on automated cross-checks, sometimes years later |
| Filed after the applicable due date | A late fee plus forfeiting the right to carry forward most losses |
| Income genuinely missed (underreporting) | A meaningfully sized penalty on the tax attributable to the missed amount |
| Income deliberately misstated or documentation fabricated (misreporting) | A much larger penalty tier — a materially different consequence from an honest mistake, and should be presented as such |

### 15.6 ITR form selection

| Profile | Form logic |
|---|---|
| Resident, simple income (salary/pension, up to two properties, small capital gains under the ITR-1 threshold) | Simplest form |
| Resident, capital gains beyond that threshold, foreign assets, director in a company, unlisted shares, or any clubbing provision | Mid-tier form |
| Anyone (resident, NRI, or joint family) with business or professional income, including speculative/intraday trading | Business-income form — and note this form's due date typically differs from the simpler forms' due date, so don't hardcode a single "the deadline" assumption anywhere in the product |
| NRI, any profile | Never the simplest form, regardless of how simple the income is — always at least the mid-tier form |
| Joint family (HUF), no business income | Mid-tier form |
| Joint family (HUF), with business income | Business-income form |
| Any clubbed income present | Mid-tier or business-income form, reported in the specific schedule for income of specified persons — never the simplest form |

### 15.7 NRI-specific structural differences (not just "same rules, different numbers")

- Two account types with fundamentally different tax treatment: one holds foreign-sourced money and is exempt with no withholding; the other holds India-sourced income and is fully taxable with withholding at the bank. Conflating them is flagged as the single most common structural error to guard against.
- Capital gains have tax withheld at source by the broker/fund house at the time of sale — a mechanic residents don't experience at all, since residents self-assess. This means an NRI's workflow needs a reconciliation step (what was withheld vs what's actually owed) that a resident's workflow doesn't need.
- A lower/nil withholding certificate can be obtained in advance if the standard withholding rate will clearly overstate actual liability — worth surfacing proactively rather than leaving the user to discover it only after overpaying.
- Double-taxation relief requires different form pairings depending on the relief method chosen (exemption vs credit) — these aren't interchangeable.
- Repatriating funds abroad has its own compliance layer (limits, thresholds requiring a CA certificate) separate from the tax return itself, and the relevant form numbers changed with the new Income Tax Act — a reminder that "the form name" and "the tax-year rule" can be on different clocks during a transition period, which the product's copy should account for rather than assume they always move together.
- NRIs cannot use the simplest or presumptive-income forms at all, regardless of income simplicity.

### 15.8 HUF-specific rule not covered elsewhere
If a member transfers a personal asset into the joint family (HUF) without adequate payment in return, income from that asset is clubbed back to the transferring member's own return — it is not taxed in the HUF's hands, even though the HUF holds the asset. This is distinct from, and more stringent than, the general clubbing rule for a spouse, and is a commonly missed rule when families consolidate assets into an HUF structure.
