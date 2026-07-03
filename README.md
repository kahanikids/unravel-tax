# Unravel Tax

![Unravel Tax logo](webapp/public/unravel-tax-logo.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/Contributions-welcome-1c9a5b.svg)](CONTRIBUTING.md)

**Turn a pile of tax documents into a filing you understand.** Unravel Tax
turns PDFs, Excel files, CSVs, and saved webpages into two clean files: one to
send your CA, one to keep. Open source, no signup — everything runs in your
browser; nothing you enter leaves your device.

**Not tax advice. Not affiliated with the Income Tax Department, CBDT, or
Ministry of Finance.** Built for FY 2025-26 (AY 2026-27). See
[DISCLAIMER.md](DISCLAIMER.md).

**[Open the webapp](https://kahanikids.github.io/unravel-tax/)** ·
[Report an issue](https://github.com/kahanikids/unravel-tax/issues/new/choose) ·
[Fix a rule](CONTRIBUTING.md) ·
[Disclaimer](DISCLAIMER.md)

---

## Start here

**[Open the webapp](https://kahanikids.github.io/unravel-tax/)** — no install,
no signup. Everything happens in your browser.

**Manual path (no browser app):** copy
[prompts/00-master-guide.md](prompts/00-master-guide.md) into an AI chat and
use the [template workbook](templates/master-template.gsheet-link.md) (for now,
open `templates/excel-export/UnravelTax-Template.xlsx` directly).

**Run locally:** clone this repo, then `cd webapp`, `npm install`, `npm run dev`.

That's the whole journey. The sections below are background.

---

## How it works

- **Infer, don't interrogate.** Plain-language questions once; the tool works
  out which checklist and forms apply.
- **Spreadsheet engine, chat guide.** Arithmetic is deterministic. AI only reads
  messy documents and explains results — never does the maths.
- **Consequences before numbers.** Missing items and risk flags come before totals.
- **Simple by default.** Full detail is one click away, never the starting view.
- **Your file is the record.** No account, no server. Export the workbook and keep it.

More detail: [BUILD_PLAN.md](BUILD_PLAN.md) (maintainers).

---

## Profiles (NRI, HUF, senior citizens, single parents)

The webapp orients each profile and builds the right checklist. NRE exempt
interest and minor's-income clubbing are partially calculated; full NRI/HUF
paths remain deferred. The app says so in "Things to check". See
[ROADMAP.md](ROADMAP.md) and `rules/` for profile-specific rules.

---

## Contributing

Rule updates after each Union Budget are the highest-value contribution.
See [CONTRIBUTING.md](CONTRIBUTING.md) and [ROADMAP.md](ROADMAP.md).

Questions that are not bugs: enable **GitHub Discussions** on the repo (Q&A)
and ask there — noted in CONTRIBUTING for maintainers setting up the repo.

---

## Maintainer

Independent open source project. The hosted demo on GitHub Pages
([kahanikids.github.io/unravel-tax](https://kahanikids.github.io/unravel-tax/))
tracks `main`. Maintained part-time; rule corrections are prioritised over
new features.

---

## Status

Milestones 1–4 are built and covered by `npm run validate:all` in `webapp/`.
"Built" means the code passes checks, not that every profile is fully
calculated yet. Highlights:

- Hosted free on GitHub Pages; redeploys on push to `main` when `webapp/` changes
- Resident + senior-citizen calculations from `rules/*.json`
- Partial NRI/single-parent numbers; HUF regime comparison explicitly skipped
- Fuzzy header matching, PDF text extraction path, session cache, local-folder save (Chromium)

Day-to-day build loop: [WORKING_PLAN.md](WORKING_PLAN.md).

---

## Other docs

| Doc | For |
|-----|-----|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to submit rule fixes and code |
| [CHANGELOG.md](CHANGELOG.md) | Dated rule and project changes |
| [DISCLAIMER.md](DISCLAIMER.md) | Legal scope and non-affiliation |
| [SECURITY.md](SECURITY.md) | Reporting vulnerabilities |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community standards |
| [ROADMAP.md](ROADMAP.md) | Planned features |
| [BUILD_PLAN.md](BUILD_PLAN.md) | Full product and architecture spec (maintainers) |

## License

MIT. See [LICENSE](LICENSE). Fork and adapt freely; keep the copyright notice.
Not tax or legal advice — see [DISCLAIMER.md](DISCLAIMER.md).
