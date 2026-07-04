# Roadmap

This file lists remaining work. For the full current-state inventory, including
what is already built and what is only partial, see
[FEATURE_COVERAGE.md](FEATURE_COVERAGE.md).

Items are ordered roughly by user impact, not commitment date.

## Partial areas to finish

### Advance tax

Built today: a partial Section 234B estimator using total tax liability, tax
already paid, and an as-of date.

Still pending: Section 234C quarterly instalment interest. That needs income
timing by quarter, which the current workflow does not capture reliably.

### Profile-specific calculations

Built today: orientation, checklist, ITR routing, CA recommendation, and scope
caveats for NRI, HUF, senior-citizen, and single-parent profiles. NRE exempt
interest and minor-income clubbing are partly calculated.

Still pending:

- NRI DTAA relief applied to tax numbers
- NRI NRO TDS-rate precision and refund reconciliation
- NRI repatriation tracking
- HUF coparcener/member data model
- HUF Section 64(2) transfer clubbing
- HUF partition tracking
- Single-parent clubbing exceptions
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
payout premium caps, foreign assets, and LRS TCS.

Still pending:

- Policy-level taxable insurance payout computation
- Schedule FA builder and foreign income computation
- Form 67 foreign-tax-credit inputs
- Education/medical LRS rate branches

### Loans and house property

Built today: old-regime interest deductions for self-occupied home loan, 80EEA,
80E, and 80EEB.

Still pending:

- Let-out house-property interest treatment
- Home-loan principal under 80C
- Business-use vehicle interest
- Broader property-income modelling

### Manual spreadsheet path

Built today: Excel template and prompt pack.

Still pending: published Google Sheets master template link.

## How to help

- **Rule corrections after a Budget:** highest priority. See
  [CONTRIBUTING.md](CONTRIBUTING.md).
- **Code for a roadmap item:** open an issue first so scope matches what
  maintainers expect.
