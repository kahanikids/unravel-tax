# Roadmap

This file lists remaining work. For the full current-state inventory, including
what is already built and what is only partial, see
[FEATURE_COVERAGE.md](FEATURE_COVERAGE.md).

Items are ordered roughly by user impact, not commitment date.

## Partial areas to finish

### Advance tax

Built today: the Section 234B estimator, plus an instalment-by-instalment
Section 234C estimate from what was paid in each window (with the 12%/36%
safe harbours and the Rs 10,000 floor).

Still pending: 234C precision from income dated by quarter. The section's
proviso excludes mid-year dividends/capital gains from earlier instalments,
so the current estimate is a whole-year ceiling (the tool says so with every
figure).

### Profile-specific calculations

Built today: orientation, checklist, ITR routing, CA recommendation, and scope
caveats for NRI, HUF, senior-citizen, and single-parent profiles. NRE exempt
interest is calculated, and minor-income clubbing is calculated including the
Section 64(1A) exclusions (minor's own work/skill, 80U disability).

Still pending:

- NRI DTAA relief applied to tax numbers
- NRI NRO TDS-rate precision and refund reconciliation
- NRI repatriation tracking
- HUF coparcener/member data model
- HUF Section 64(2) transfer clubbing
- HUF partition tracking
- Schedule SPI placement

### Prior-year carry-forward

Built today: dashboard history can import some ITR JSON and ITR-V PDF fields,
or accept manual past-year entries.

Still pending: importing a previous Unravel Tax full workbook to reuse profile
answers and carry-forward loss figures in the current-year filing.

### PDF extraction

Built today: browser-side PDF text extraction plus guided AI JSON extraction.

Still pending: native PDF table extraction reliable enough to avoid the
external AI chat copy-paste step.

### Advanced disclosure and planning widgets

Built today: disclosure reminders and lightweight estimates for insurance
payout premium caps, foreign assets, and LRS TCS with the purpose's rate
branch (investment/gift, education/medical, education-loan funded).

Still pending:

- Policy-level taxable insurance payout computation
- Schedule FA builder and foreign income computation
- Form 67 foreign-tax-credit inputs

### Loans and house property

Built today: old-regime interest deductions for self-occupied home loan, 80EEA,
80E, and 80EEB; the let-out house-property computation (30% standard
deduction, uncapped interest, per-regime loss treatment, carry-forward note);
and home-loan principal inside the shared 80C ceiling.

Still pending:

- Business-use vehicle interest
- Multiple let-out properties and pre-construction interest spreading

### Manual spreadsheet path

Built today: Excel template and prompt pack.

Still pending: published Google Sheets master template link.

## How to help

- **Rule corrections after a Budget:** highest priority. See
  [CONTRIBUTING.md](CONTRIBUTING.md).
- **Code for a roadmap item:** open an issue first so scope matches what
  maintainers expect.
