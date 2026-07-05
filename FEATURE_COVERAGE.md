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
  12%/36% safe harbours and the Rs 10,000 floor. Listed-equity capital
  gains are dated from real transaction dates so their tax counts toward
  the right instalment automatically; the remaining ordinary income
  (dividends, intraday, debt-MF) is still spread evenly, with that
  narrower caveat always shown.
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
- NRI dividend tax at the actual Section 115A/DTAA flat rate (the lower of
  the 20% domestic rate and the country's treaty rate), excluded from the
  regime comparison's slab income since it isn't slab income for a
  non-resident. An NRO interest/dividend TDS-vs-treaty-rate reconciliation
  surfaces a possible recoverable refund, for the 16 countries this tool
  has treaty rates for. An NRO repatriation planning check (USD 1 million
  annual cap, Rs 5 lakh CA-certificate threshold, the renamed Form
  145/146) is a banking/FEMA compliance signal, not a tax figure.
- HUF Section 64(2) transfer clubbing: a member/coparcener list for the
  CA's reference (feeds no calculation), and an asset-transfer list that
  flags when a transfer without adequate consideration clubs that asset's
  income to the transferring member's own return instead of the HUF's.
- Old-regime super-senior (80+) slab, selected once a follow-up question
  past "60 or older?" confirms the age, instead of always using the 60-79
  band.
- Per-policy Section 10(10D) computation: sum-assured-ratio and
  aggregate-premium-cap tests per policy, the taxable amount when a policy
  loses its exemption, capital-gains tax for a taxable ULIP (its own CA
  Summary row) and slab-taxed other-sources income for a taxable
  traditional policy (folded into the regime comparison).
- Year-over-year dashboard with current-year widgets, past-filing history,
  ITR JSON import, ITR-V PDF text read, manual past-year entry, trends, and
  simple charts.
- Deduction planning widgets for 80C, 80D, and 80CCD(1B).
- Insurance payout premium-cap reminder for Section 10(10D).
- Foreign asset Schedule FA reminder and LRS TCS estimate, plus a
  two-phase Schedule FA builder: Phase 1 produces foreign bank/brokerage
  account disclosure rows as a workbook sheet; Phase 2 computes actual tax
  on foreign shares and RSU/ESPP (unlisted-share rates for a sale,
  Section 17(2)(vi) perquisite for a vesting), folds short-term
  gains/dividends/interest/perquisite into the regime comparison, and
  estimates a Section 90/91 foreign tax credit (Rule 128's average-rate
  method).
- Dismissible first-visit disclaimer, full legal/privacy/AI disclosure, help
  panel, tool tour, sample-data mode, error boundary, issue/report links, and
  project-source links.
- Validation scripts for rule sync, ingest, calculations, reconciliation,
  guided UI, exports, and Vitest coverage over the validator suite.

## Partial or half-baked

- PDF support extracts text locally, but transaction-table reconstruction still
  depends on the user's external AI chat and copy-paste JSON. Scanned/image PDFs
  may fail.
- Section 234C is precise for listed-equity capital gains (dated from real
  transaction sell dates) but still a whole-year ceiling for the rest:
  dividends, intraday income, and debt-mutual-fund gains aren't dated the
  same way, so their tax is still spread evenly, and the true figure can
  be somewhat lower than shown if a meaningful share of those arrived
  mid-year or later. The caveat is displayed with every estimate.
- Regime comparison covers slab-taxed income only. It excludes surcharge above
  Rs 50 lakh and capital gains taxed the same under both regimes. It is
  hidden for HUF.
- ITR form recommendation is conservative but cannot see every disqualifier,
  such as directorship, unlisted shares, more than one house property, foreign
  income details, or carried-forward losses unless the user enters enough
  related information.
- NRI support orients the user, builds the checklist, routes to ITR-2/ITR-3,
  flags DTAA mutual fund caveats for known countries, keeps NRE interest as a
  separate exempt entry, applies Section 115A/DTAA dividend tax, reconciles
  NRO interest/dividend TDS against the treaty rate, and runs the
  repatriation planning check above. NRO interest itself still uses
  ordinary slab tax rather than a precise treaty-capped final rate (that
  needs marginal-rate context this tool doesn't have), and refund claims
  beyond the TDS reconciliation aren't calculated.
- HUF support orients the user, builds the checklist, routes to ITR-2/ITR-3,
  skips the regime comparison, and computes the Section 64(2) clubbing note
  above. It does not calculate partition effects - see
  docs/DESIGN-remaining-gaps.md for why partition is proposed to stay
  calculation-free even in a future build.
- Single-parent support orients the user, builds the checklist, and computes
  minor-income clubbing after the Section 64(1A) exclusions and the Section
  10(32) per-child exemption. It cannot verify an exclusion genuinely
  applies, and it does not place values into Schedule SPI.
- Loan deductions cover the old-regime interest lines (self-occupied home
  loan, 80EEA, 80E, 80EEB), the let-out house-property computation, and 80C
  home-loan principal. Business-use vehicle interest, multiple let-out
  properties, and pre-construction interest spreading are not modelled.
- Insurance payout support has two tiers: a dashboard aggregate-premium
  check against the major 10(10D) caps (a quick planning signal), and a
  per-policy computation on the Results page that takes each policy's
  issue date, sum assured, premium history, and payout to compute the
  actual taxable amount. A taxable ULIP's capital-gains tax doesn't yet
  combine with other equity LTCG under the one shared annual exemption -
  each taxable ULIP uses the full exemption on its own, flagged rather
  than silently assumed.
- Foreign-asset support is a disclosure reminder, a purpose-aware LRS TCS
  estimate, and a two-phase Schedule FA builder. Phase 1: a foreign bank or
  brokerage account (country, institution, account number, opening date,
  peak/closing balance, gross interest, all entered already-converted to
  rupees) produces disclosure rows as a workbook sheet, with the interest
  folded automatically into slab income. Phase 2: a foreign share or vested
  RSU/ESPP holding computes real Indian tax on a sale - unlisted-share
  rates (24-month threshold, flat 12.5%, no indexation) for long-term,
  slab rate folded into the regime comparison for short-term - plus the
  RSU/ESPP vesting perquisite (Section 17(2)(vi), folded into the salary
  bucket) and a Section 90/91 foreign tax credit estimate (exact for
  long-term gains, Rule 128's average-rate method for everything else -
  a planning estimate, not a Form 67 number, since it doesn't itemize by
  country). It does not cover foreign property or trusts (Schedule FA
  tables B/C, Phase 3). See docs/DESIGN-remaining-gaps.md for the
  remaining phased Schedule FA design.
- Past-filing import is only a dashboard history feature that reads a handful
  of ITR JSON or ITR-V PDF fields when it can. Importing a previous Unravel
  Tax workbook from the welcome screen is intentionally not exposed now; the
  primary flow stays focused on the FY 2025-26 filing.
- TDS auto-fill from AI-extracted annual figures is lean: it lands in the
  existing tax-paid field and still needs user review against AIS/26AS.
- Local-folder save is Chromium-only because it uses the File System Access API.
  Other browsers fall back to downloads and browser storage.
- The Google Sheets master template link is not published. The manual path uses
  the Excel workbook today.

## Pending

- Section 234C precision for dividends/intraday/debt-MF income dated by
  quarter (listed-equity capital gains are already precise).
- NRI: NRO TDS-rate precision applied as a final slab-tax figure (not just
  the TDS reconciliation already built), and refund reconciliation beyond
  TDS.
- HUF: partition tracking - proposed to stay out of scope for calculation
  entirely (docs/DESIGN-remaining-gaps.md); a private partial partition is
  tax-invisible under Section 171(9) and this tool can't verify an
  Assessing Officer's total-partition order.
- Single-parent Schedule SPI placement.
- Schedule FA Phase 3 (foreign trusts and other assets) - Phases 1
  (foreign bank/brokerage accounts) and 2 (foreign shares, RSU/ESPP, with
  Schedule FSI/OS income tax and a foreign tax credit estimate) are built;
  see docs/DESIGN-remaining-gaps.md for the remaining phase.
- Precise, per-country Section 90/91 foreign tax credit computation for
  Form 67/Schedule FSI/TR filing - the average-rate estimate this tool
  computes is a planning figure, not a per-country final number.
- Combining a taxable ULIP's capital gains with other equity LTCG under the
  one shared annual exemption, instead of each source using it
  independently.
- Business-use vehicle interest, multiple let-out properties, and
  pre-construction interest spreading.
- Native PDF table extraction reliable enough to avoid the external AI
  copy-paste step.
- Published Google Sheets master template.
