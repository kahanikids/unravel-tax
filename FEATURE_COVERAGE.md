# Feature coverage

This is the practical status of the shipped tool. It separates what is built
from what is partial or still pending, so users and contributors do not have to
infer scope from the roadmap or implementation notes.

## Built

- Browser-only webapp with no account, backend, analytics, or server storage.
- Local resume using browser storage, plus optional Chromium local-folder save
  and restore for session backups, submitted document copies, and exports.
- Plain-language orientation for resident, NRI, HUF, senior citizen,
  single-parent, loans, insurance payout, and foreign-asset situations.
- Personalized document checklist with source guidance for common documents.
- CSV, Excel, saved-webpage HTML, TSV, and structured-text ingestion in the
  browser.
- PDF raw-text extraction in the browser, followed by guided AI extraction for
  table reconstruction when needed.
- Standard JSON paste contract for AI extraction, including transaction rows,
  annual figures, document notes, and net-gain-without-detail warnings.
- Editable extraction review before rows are committed.
- Fuzzy header matching, manual column mapping, row-level parse warnings, and
  broker-reported gain variance checks when the uploaded statement has a gain
  or taxable column.
- Deterministic capital-gains classification for listed equity, intraday, and
  debt or specified mutual fund rows using `rules/*.json`.
- CA Summary CSV, CA Summary XLSX, and full workbook XLSX exports, all
  generated in the browser.
- Reference-only workbook sheets for uploads that are not parsed into
  capital-gains transactions, such as bank interest, dividend, or holdings
  statements.
- ITR form recommendation for the profile and detected document data, including
  NRI, HUF, clubbing, foreign-asset, income-cap, and speculative or intraday
  routing where the app has the needed inputs.
- CA-vs-self-file recommendation from profile flags, risk triggers, and
  business or speculative income.
- Risk triggers for multiple employers, HRA without landlord PAN, early EPF
  withdrawal, foreign assets, insurance-payout premium caps, business-income
  form changes, and late filing based on the chosen form due date.
- AIS/Form 26AS/Form 16 reconciliation for manually entered dividends,
  interest, and TDS per source.
- Final "Before you export" confidence check that groups missing documents,
  mismatches, form-changing triggers, routine flags, and profile caveats.
- Old-vs-new regime comparison for slab-taxed income, with break-even
  deductions, loan-interest deductions, and let-out house-property
  income/loss (per regime) folded into the right sides.
- Section 234B and Section 234C advance-tax interest estimates. 234C works
  instalment by instalment from what was paid in each window, applies the
  12%/36% safe harbours and the Rs 10,000 floor, and always shows the
  caveat that mid-year gains/dividends make the true figure lower.
- Let-out house-property computation (rent, municipal taxes, 30% standard
  deduction, uncapped interest), with the Rs 2 lakh loss set-off cap on the
  old-regime side, no set-off on the new-regime side, carry-forward noted,
  and its own CA Summary row.
- Home-loan principal counted inside the shared Section 80C ceiling,
  capped together with the dashboard's 80C investments figure.
- LRS TCS estimate using the remittance purpose's rate branch: 20%
  investment/gift/other, 2% education/medical, nil when education-loan
  funded.
- Minor's-income clubbing with the Section 10(32) per-child exemption and a
  field for income Section 64(1A) never clubs (the minor's own work/skill
  or an 80U disability), excluded before the exemption.
- Year-over-year dashboard with current-year widgets, past-filing history,
  ITR JSON import, ITR-V PDF text read, manual past-year entry, trends, and
  simple charts.
- Deduction planning widgets for 80C, 80D, and 80CCD(1B).
- Insurance payout premium-cap reminder for Section 10(10D).
- Foreign asset Schedule FA reminder and LRS TCS estimate.
- Dismissible first-visit disclaimer, full legal/privacy/AI disclosure, help
  panel, tool tour, sample-data mode, error boundary, issue/report links, and
  project-source links.
- Validation scripts for rule sync, ingest, calculations, reconciliation,
  guided UI, exports, and Vitest coverage over the validator suite.

## Partial or half-baked

- PDF support extracts text locally, but transaction-table reconstruction still
  depends on the user's external AI chat and copy-paste JSON. Scanned/image PDFs
  may fail.
- Section 234C is a whole-year ceiling estimate: dividends and capital gains
  that arrived mid-year are excluded from earlier instalments by the
  section's proviso, which needs income dated by quarter to apply, so the
  true figure can be lower than shown. The caveat is displayed with every
  estimate.
- Regime comparison covers slab-taxed income only. It excludes surcharge above
  Rs 50 lakh, the age 80+ super-senior slab, and capital gains taxed the same
  under both regimes. It is hidden for HUF.
- ITR form recommendation is conservative but cannot see every disqualifier,
  such as directorship, unlisted shares, more than one house property, foreign
  income details, or carried-forward losses unless the user enters enough
  related information.
- NRI support orients the user, builds the checklist, routes to ITR-2/ITR-3,
  flags DTAA mutual fund caveats for known countries, and keeps NRE interest as
  a separate exempt entry. It does not apply DTAA relief to the tax numbers,
  compute NRO TDS precision, track repatriation limits, or calculate refund
  claims.
- HUF support orients the user, builds the checklist, routes to ITR-2/ITR-3,
  and skips the regime comparison. It does not calculate coparcener/member
  detail, Section 64(2) transfer clubbing, or partition effects.
- Single-parent support orients the user, builds the checklist, and computes
  minor-income clubbing after the Section 64(1A) exclusions and the Section
  10(32) per-child exemption. It cannot verify an exclusion genuinely
  applies, and it does not place values into Schedule SPI.
- Loan deductions cover the old-regime interest lines (self-occupied home
  loan, 80EEA, 80E, 80EEB), the let-out house-property computation, and 80C
  home-loan principal. Business-use vehicle interest, multiple let-out
  properties, and pre-construction interest spreading are not modelled.
- Insurance payout support checks annual premium against major 10(10D) caps,
  but does not compute taxable payout amounts because it does not hold issue
  dates, policy type history, sum-assured ratios, or premium-by-policy detail.
- Foreign-asset support is a disclosure reminder and a purpose-aware LRS TCS
  estimate. It does not build Schedule FA, compute foreign
  dividends/interest/gains, or prepare Form 67 foreign-tax-credit inputs.
- Past-filing import is a dashboard history feature. It reads a handful of ITR
  JSON or ITR-V PDF fields when it can, but it does not import the previous
  Unravel Tax workbook to prefill this year's filing or carry forward losses.
- TDS auto-fill from AI-extracted annual figures is lean: it lands in the
  existing tax-paid field and still needs user review against AIS/26AS.
- Local-folder save is Chromium-only because it uses the File System Access API.
  Other browsers fall back to downloads and browser storage.
- The Google Sheets master template link is not published. The manual path uses
  the Excel workbook today.

## Pending

- Section 234C precision from income dated by quarter (the current estimate
  is a whole-year ceiling).
- Import a previous Unravel Tax full workbook to reuse profile answers and
  carry-forward loss figures.
- Full NRI calculation path: NRE/NRO separation throughout, NRO TDS-rate
  precision, DTAA relief applied to calculations, refund reconciliation, and
  repatriation tracking.
- Full HUF calculation path: coparceners/members, Section 64(2) transfer
  clubbing, and partition tracking.
- Single-parent Schedule SPI placement.
- Schedule FA and foreign income computation for resident foreign assets.
- Full insurance payout tax computation from policy-level premium and issue
  data.
- Business-use vehicle interest, multiple let-out properties, and
  pre-construction interest spreading.
- Native PDF table extraction reliable enough to avoid the external AI
  copy-paste step.
- Published Google Sheets master template.
