# Unravel Tax

![Unravel Tax logo](assets/unravel-tax-logo-generated.png)

Untangle your tax documents, one step at a time.

Turn PDFs, Excel files, CSVs, saved webpages, and whatever else you have
into two clean files: one to send your CA, one to keep. Free. No signup.
No installs.

## Start here

There's no hosted link yet, so the webapp has to be run locally — this is
the highest-priority gap before this tool is usable by a first-time,
non-technical user (see Status below).

1. Get the code (`git clone` this repo, or download it as a zip and unzip
   it) and open a terminal in the `webapp/` folder.
2. Run `npm install`, then `npm run dev`.
3. Open the local address it prints (usually `http://127.0.0.1:5173`) in
   your browser. Everything runs in your browser from there — no account,
   nothing uploaded anywhere.

Prefer not to touch a terminal at all? Use the manual path instead:
[open the guided chat prompt](prompts/00-master-guide.md) — copy the whole
file into ChatGPT or another AI chat and follow along, pairing it with the
[template workbook](templates/master-template.gsheet-link.md) (a Google
Sheets copy link isn't published yet — for now, open the `.xlsx` in
`templates/excel-export/` directly).

That's it. Everything else on this page is background, come back to it
if you want to understand how it works.

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

The webapp asks about each of these profiles and hands back a checklist
and rule citations that account for them, but as of now it only
*calculates* the resident/senior-citizen path (equity capital gains,
debt/specified mutual funds, dividends, interest). The NRI, HUF, and
single-parent-specific numbers — NRE/NRO separation, TDS-withheld-vs-owed
reconciliation, HUF partition/clubbing amounts, minor's-income clubbing
amounts — aren't wired into the calculation engine yet (see `SYSTEM_SPEC.md`
Section 14, which phases this deliberately). If one of those profiles
applies to you, the webapp says so plainly and points you to a CA for that
part. See `rules/` for the profile-specific detail in the meantime.

## Contributing

See `CONTRIBUTING.md`. Rule updates after each Union Budget or
mid-year Finance Act amendment are the highest-value contribution —
tax rates and thresholds change more often than the code does.

## Status

All four `WORKING_PLAN.md` milestone slices are built and validated
(`npm run validate:*` in `webapp/`), but "built" means the code exists and
passes its checks, not "ready for a first-time non-technical user" — that's
still the gap:

- **No hosted link.** Running it today means cloning the repo and using a
  terminal — not yet the "no installs" experience the project is meant to
  be. Getting this hosted somewhere free (GitHub Pages or equivalent) is
  the top priority.
- **Resident + senior-citizen calculations are real.** Equity capital
  gains, Section 50AA debt/specified mutual funds, dividends, and interest
  are computed from `rules/*.json`, not guessed.
- **NRI/HUF/single-parent orientation and checklists work, their numbers
  don't yet.** The webapp is upfront about this in the "Things to check"
  panel rather than implying full support (see the section above).
- **Session caching and local-folder saving are in place.** Your
  in-progress answers/documents are cached in this browser so you can close
  the tab and resume, and in Chromium browsers you can save submitted
  documents and the exported workbook straight to a folder on your
  computer instead of your Downloads folder. Neither leaves your browser.

See `BUILD_PLAN.md` Section 12 for the milestone sequence and
`WORKING_PLAN.md` for the day-to-day loop.
