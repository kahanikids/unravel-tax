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

Built today: 234C quarter precision for listed-equity capital gains, which
have exact transaction dates and a flat, slab-independent tax rate. Each
instalment's required cumulative tax now separates the equity capital-gains
share (dated precisely) from ordinary income (still spread by instalment
fraction).

Still pending: the same precision for dividends, intraday gains, and debt
mutual fund gains, which are taxed at slab rates and would need full income
context this tool doesn't have to date precisely. The estimate for those
stays a whole-year ceiling (the tool says so with every figure).

### Profile-specific calculations

Built today: orientation, checklist, ITR routing, CA recommendation, and scope
caveats for NRI, HUF, senior-citizen, and single-parent profiles. NRE exempt
interest is calculated, and minor-income clubbing is calculated including the
Section 64(1A) exclusions (minor's own work/skill, 80U disability).

Built today: NRI dividend tax at the flat Section 115A/DTAA rate (whichever
is lower), and NRO interest/dividend TDS reconciliation against the
treaty withholding rate for 16 countries.

Still pending:

- NRO interest taxed precisely at slab rate (currently ordinary slab
  treatment plus TDS reconciliation, without the same flat-rate precision
  dividends now have)
- NRI repatriation tracking
- HUF coparcener/member data model
- HUF Section 64(2) transfer clubbing
- HUF partition tracking
- Schedule SPI placement

The HUF items and NRI repatriation tracking have design proposals in
[docs/DESIGN-remaining-gaps.md](docs/DESIGN-remaining-gaps.md) awaiting
sign-off before implementation.

### Prior-year carry-forward

Built today: dashboard history can import some ITR JSON and ITR-V PDF fields,
or accept manual past-year entries. A previous Unravel Tax full workbook can
also be imported from the welcome screen to prefill profile answers and
carry-forward loss figures for the current-year filing.

### PDF extraction

Built today: browser-side PDF text extraction plus guided AI JSON extraction.

Still pending: native PDF table extraction reliable enough to avoid the
external AI chat copy-paste step.

### Advanced disclosure and planning widgets

Built today: disclosure reminders and lightweight estimates for insurance
payout premium caps, foreign assets, and LRS TCS with the purpose's rate
branch (investment/gift, education/medical, education-loan funded).

Built today: policy-level taxable insurance payout computation, including
the sum-assured-ratio test and the aggregate-annual-premium cap pooled
across all policies of the same type.

Still pending:

- Combining ULIP long-term capital gains with other equity long-term gains
  under one exemption threshold, rather than treating them separately
- Schedule FA builder and foreign income computation
- Form 67 foreign-tax-credit inputs

Schedule FA has a design proposal in
[docs/DESIGN-remaining-gaps.md](docs/DESIGN-remaining-gaps.md) awaiting
sign-off before implementation.

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
