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
is lower), NRO interest/dividend TDS reconciliation against the treaty
withholding rate for 16 countries, and an NRO repatriation planning check
(USD 1 million annual cap, Rs 5 lakh CA-certificate threshold, the renamed
Form 145/146 - a banking/FEMA compliance signal, not a tax figure).

Built today: HUF Section 64(2) transfer clubbing - a member/coparcener list
for the CA's reference (feeds no calculation) and an asset-transfer list
that flags when a transfer without adequate consideration clubs that
asset's income to the transferring member's own return, not the HUF's.

Built today: the old-regime super-senior (80+) slab, selected via a
follow-up question once "60 or older?" is Yes, instead of always applying
the 60-79 band.

Still pending:

- NRO interest taxed precisely at slab rate (currently ordinary slab
  treatment plus TDS reconciliation, without the same flat-rate precision
  dividends now have)
- HUF partition tracking - proposed to stay out of scope for calculation
  entirely, since a private partial partition is tax-invisible under
  Section 171(9) and this tool can't verify an Assessing Officer's
  total-partition order
- Schedule SPI placement

See [docs/DESIGN-remaining-gaps.md](docs/DESIGN-remaining-gaps.md) for the
HUF partition reasoning and the repatriation-check build note.

### Prior-year carry-forward

Built today: dashboard history can import some ITR JSON and ITR-V PDF fields,
or accept manual past-year entries. The welcome screen stays focused on the
FY 2025-26 filing flow, with no prior-workbook import prompt.

### PDF extraction

Built today: browser-side PDF text extraction plus LLM Options for JSON extraction
(in-browser Llama, OpenRouter, or copy-paste).

Still pending: native PDF table extraction reliable enough to reduce reliance
on LLM Options for standardised reports.

### Advanced disclosure and planning widgets

Built today: disclosure reminders and lightweight estimates for insurance
payout premium caps, foreign assets, and LRS TCS with the purpose's rate
branch (investment/gift, education/medical, education-loan funded).

Built today: policy-level taxable insurance payout computation, including
the sum-assured-ratio test and the aggregate-annual-premium cap pooled
across all policies of the same type.

Built today: Schedule FA Phase 1 - a foreign bank or brokerage account
(country, institution, account number, opening date, peak/closing
balance, gross interest) produces the schedule's A1/A2 disclosure rows as
a workbook sheet, and folds the interest into slab income automatically.
Amounts are entered already converted to rupees by the user (this tool
has no live exchange-rate source).

Built today: Schedule FA Phase 2 - a foreign share or vested RSU/ESPP
holding (table A3) computes real Indian tax on a sale: unlisted-share
rates (24-month threshold, flat 12.5%, no indexation) for long-term,
folded automatically into slab income for short-term. The RSU/ESPP
vesting perquisite (Section 17(2)(vi)) folds into the salary bucket
specifically, since it's standard-deduction-eligible unlike other income.
A Section 90/91 foreign tax credit estimate is computed too - exact for
long-term gains, Rule 128's average-rate method for everything else - as
a planning estimate, not a per-country Form 67 figure.

Still pending:

- Combining ULIP long-term capital gains with other equity long-term gains
  under one exemption threshold, rather than treating them separately
- Schedule FA Phase 3 (foreign trusts and other assets)
- Precise, per-country Section 90/91 foreign tax credit computation for
  actual Form 67/Schedule FSI/TR filing

Schedule FA Phase 3 has a design proposal in
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
