# Master template (Google Sheets)

Status: Excel template created; Google Sheets copy link not published yet.

The current template workbook is:
`templates/excel-export/UnravelTax-Template.xlsx`.

For now, open the `.xlsx` directly in Excel or upload it to Google Sheets
manually. Once a hosted Google Sheets master copy exists, put that link
here with copy-instructions ("File > Make a copy").

## What it needs to contain (BUILD_PLAN.md Section 14 / SYSTEM_SPEC.md
Section 6 — workbook data model)

Tabs common to every profile: `Profile`, one Raw Data + Working tab pair
per income source, `Dividends`, `Interest & Other Income`, `Transaction
Charges`, `Carry Forward Losses`, `CA Summary`, `Detailed Summary`, `ITR
Form Guide`.

Profile-specific tabs get added per Section 6.2 of SYSTEM_SPEC.md (NRI,
HUF, Senior Citizen, Single Parent/Guardian each add their own).

The template mirrors the pattern already built and validated in a real
filing session (see SYSTEM_SPEC.md's version note) — that original workbook
lives outside this repo and is a reference to generalize the structure
from, never a source to copy real data from. Don't add a path to it here;
it identifies a real person's financial data and shouldn't be discoverable
from a public repo.
