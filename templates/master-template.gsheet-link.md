# Master template (Google Sheets)

Status: not yet created.

This file will hold the link to the master Google Sheets template plus
copy-instructions ("File > Make a copy") once Milestone 1B builds the
actual workbook.

Until then, the first working entry point is the guided prompt:
`../prompts/00-master-guide.md`.

## What it needs to contain (BUILD_PLAN.md Section 14 / SYSTEM_SPEC.md
Section 6 — workbook data model)

Tabs common to every profile: `Profile`, one Raw Data + Working tab pair
per income source, `Dividends`, `Interest & Other Income`, `Transaction
Charges`, `Carry Forward Losses`, `CA Summary`, `Detailed Summary`, `ITR
Form Guide`.

Profile-specific tabs get added per Section 6.2 of SYSTEM_SPEC.md (NRI,
HUF, Senior Citizen, Single Parent/Guardian each add their own).

The future template should mirror the pattern already built and validated for RKM in
`../../RKM/RKM - Capital Gains Workbook.xlsx` — that workbook is the
reference implementation to generalize from, not to copy real data from.
