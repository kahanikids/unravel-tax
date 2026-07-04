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
  deductions and loan-interest deductions folded into the old-regime side.
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
- Advance-tax support estimates only Section 234B from total tax liability,
  tax already paid, and an as-of date. Section 234C quarterly instalment
  interest is not calculated.
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
  minor-income clubbing after the Section 10(32) per-child exemption. It does
  not check exceptions for the minor's own skill/manual work or Section 80U,
  and it does not place values into Schedule SPI.
- Loan deductions cover common old-regime interest lines: self-occupied home
  loan interest, 80EEA, 80E, and 80EEB. Let-out property treatment, 80C home
  loan principal, and business-use vehicle interest are not modelled.
- Insurance payout support checks annual premium against major 10(10D) caps,
  but does not compute taxable payout amounts because it does not hold issue
  dates, policy type history, sum-assured ratios, or premium-by-policy detail.
- Foreign-asset support is a disclosure reminder and LRS TCS estimate. It does
  not build Schedule FA, compute foreign dividends/interest/gains, or prepare
  Form 67 foreign-tax-credit inputs.
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

- Section 234C quarterly advance-tax interest.
- Import a previous Unravel Tax full workbook to reuse profile answers and
  carry-forward loss figures.
- Full NRI calculation path: NRE/NRO separation throughout, NRO TDS-rate
  precision, DTAA relief applied to calculations, refund reconciliation, and
  repatriation tracking.
- Full HUF calculation path: coparceners/members, Section 64(2) transfer
  clubbing, and partition tracking.
- Full single-parent path: clubbing exceptions and Schedule SPI placement.
- Schedule FA and foreign income computation for resident foreign assets.
- Full insurance payout tax computation from policy-level premium and issue
  data.
- Let-out house-property loan treatment, home-loan principal, and broader loan
  edge cases.
- Native PDF table extraction reliable enough to avoid the external AI
  copy-paste step.
- Published Google Sheets master template.
