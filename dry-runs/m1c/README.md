# M1C Manual Flow Dry Run

Status: passed on 2026-07-02.

## Flow Exercised

1. README start path points to `prompts/00-master-guide.md`.
2. The master guide routes document extraction to `prompts/01-extract-statement.md`.
3. A non-CSV fixture was used: `fixtures/sample-broker-statement.html`.
4. The transaction table was selected from the HTML fixture, ignoring the disclaimer,
   charges summary, and portfolio summary tables.
5. Extracted rows matched the template's `Raw Data - Sample Broker` rows.
6. The template formulas produced the two intended outputs.

## Outputs

- Full workbook: `dry-runs/m1c/UnravelTax-M1C-Full-Workbook.xlsx`
- CA summary: `dry-runs/m1c/UnravelTax-M1C-CA-Summary.csv`

## Evidence

- Non-CSV transaction rows extracted: 5
- Required workbook sheets verified by `scripts/verify-template.mjs`: 22
- CA Summary rows exported: 11

## Friction Points

- The Google Sheets hosted copy link is not published yet. The M1 workflow
  currently uses the Excel workbook directly or manual upload to Google Sheets.
- The AI extraction step cannot be executed inside this repo, so this dry run
  simulates the confirmed extraction output from the HTML fixture with a local
  parser and verifies that the rows match the template paste target.

## Blockers Fixed

- None. The flow is ready for the next slice: notebook skeleton.
