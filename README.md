# Unravel Tax

![Unravel Tax logo](assets/unravel-tax-logo.svg)

Untangle your tax documents, one step at a time.

Turn PDFs, Excel files, CSVs, saved webpages, and whatever else you have
into two clean files: one to send your CA, one to keep. Free. No signup.
No installs.

## Start here

1. [Open the template] — this is your working file, make your own copy.
2. [Open the guided chat prompt] — paste this into ChatGPT (free account
   is fine) and follow along. It will ask you a few questions, then tell
   you exactly what to do next.

That's it. Everything else on this page is background, come back to it
if you want to understand how it works.

*(Links above are placeholders until Milestone 1's template and prompt
pack are published — see `BUILD_PLAN.md` Section 12.)*

## How it works

- **Infer, don't interrogate.** You answer a few plain-language questions
  once; the tool works out which sections, checklist, and forms apply —
  you never have to pick a tax category yourself.
- **The spreadsheet is the engine, the chat is the guide.** All the
  arithmetic runs in auditable formulas. The AI's job is reading messy
  documents and explaining results in plain language — never doing the
  maths.
- **Consequences before numbers.** Anything you're still missing, or any
  risk flag, comes before totals every time.
- **Simple by default, advanced on request.** You start on the plain
  version. Full working detail is one click away, never the starting
  point.
- **Nothing is stored anywhere but your own file.** No account, no
  server, no login. The exported workbook is the thing to keep.

## For NRIs, joint families (HUF), senior citizens, or single parents

Each of these profiles adds its own tabs and its own rules — NRE/NRO
tracking and TDS reconciliation for NRIs, clubbing and partition
tracking for HUF, the enhanced interest deduction and regime-switching
caveats for senior citizens, minor's-income clubbing for single
parents/guardians. See `rules/` for the profile-specific detail and
`SYSTEM_SPEC.md` Section 6 for how each profile's tabs differ.

## Contributing

See `CONTRIBUTING.md`. Rule updates after each Union Budget or
mid-year Finance Act amendment are the highest-value contribution —
tax rates and thresholds change more often than the code does.

## Status

Early scaffold stage. See `BUILD_PLAN.md` Section 12 for the milestone
sequence and what's built so far. Day-to-day work follows
`WORKING_PLAN.md`: each loop completes one milestone slice, validates it,
commits it, and pushes it to GitHub.
