# Foreign investments (for Indian residents)

**Applies to:** a **Resident and Ordinarily Resident (ROR)** who holds any
asset outside India — foreign shares, US RSUs or ESPP, ETFs, a foreign
bank or brokerage account, foreign property, even a foreign life policy
with a cash value. If you are an NRI or RNOR this mostly does **not**
apply to you; see `nri-residential-status.md` for how status is decided.
**Last verified:** 2026-07-03, against the incometax.gov.in Schedule FA
guide and current FY 2025-26 sources (see `source_refs` in the JSON).

## The one thing to understand first

For a resident, the single biggest risk with a foreign investment is not
the tax on it — it's **failing to disclose it**. A missed foreign asset
can cost a flat ₹10 lakh penalty under the Black Money Act, which can
dwarf the tax on the asset itself. So disclosure comes first, tax second.

## Disclosure: Schedule FA

- **Every** foreign asset held at **any point** during the calendar year
  ending **31 December 2025** must be reported in **Schedule FA**. Holding
  it for one day counts.
- **There is no minimum value.** Even a small or dormant account must be
  reported.
- **You must use ITR-2 or ITR-3.** ITR-1 and ITR-4 do not contain
  Schedule FA, so holding a foreign asset rules them out.
- **It uses the calendar year (Jan–Dec)**, not the financial year, which
  trips people up. Convert values using the SBI TT buying rate.
- **What counts:** foreign shares, ETFs, mutual funds, RSUs, ESPP, foreign
  bank/brokerage/custodial accounts, foreign cash-value life insurance,
  foreign property, and any account where you're a beneficial owner,
  beneficiary, or have signing authority.

## Tax on the income

- **Dividends and interest** from abroad are taxable in India at your slab
  rate as income from other sources.
- **Capital gains on foreign shares** go in Schedule CG. Foreign shares
  are treated like **unlisted** Indian shares, not listed equity:
  long-term only after **24 months**, at a flat **12.5%** with no
  indexation (Budget 2024, for transfers on or after 23 July 2024);
  short-term (24 months or less) is slab rate, not a flat rate.
- **RSU / ESPP:** the FMV of the shares on the **vesting date** (converted
  to rupees at the SBI TT buying rate as on that date) is a salary
  perquisite under Section 17(2)(vi), taxed at slab rate in the vesting
  year. That same FMV becomes your **cost basis** for a later sale, and
  the holding period for that sale starts from the **vesting date**, not
  the grant date. An ESPP discount is taxed the same way at purchase.
- **Foreign tax credit.** If tax was withheld abroad, you can credit it
  against your Indian tax on the same income under Section 90/91 (Rule
  128), by filing **Form 67** (before you file the return) along with
  Schedule FSI and Schedule TR. The credit is capped at whichever is
  **lower** — the foreign tax actually paid, or the Indian tax the same
  income would attract — computed separately per country and income
  source, then added together. Miss Form 67 and the credit can be denied.

## TCS when you send money abroad (LRS)

When you remit money overseas under the Liberalised Remittance Scheme
(e.g. to buy foreign shares), the bank collects TCS:

- From **1 April 2025** the threshold rose from ₹7 lakh to **₹10 lakh** per
  financial year, combined across all your LRS remittances.
- **20%** on investment, gift, and most other remittances above ₹10 lakh.
- **5%** on education (not loan-funded) and medical remittances above
  ₹10 lakh (Budget 2025, effective 1-Apr-2025 — a lower 2% rate has been
  proposed in Budget 2026 but only applies from 1-Apr-2026, i.e. next
  filing year, not this one); **nil** where the remittance is funded by
  an education loan.
- TCS is **not a cost** — it's a prepaid tax credit that shows in your
  Form 26AS / AIS and is refunded or set off when you file your return.

## Penalties for getting disclosure wrong

- **₹10 lakh flat penalty per year** (Section 43, Black Money Act) for not
  disclosing, or inaccurately disclosing, a foreign asset in Schedule FA.
- **Carve-out from 1 October 2024:** this flat penalty does not apply if
  your aggregate undisclosed **movable** foreign assets (excluding
  property) are ₹20 lakh or less. The penalty is waived — **the duty to
  disclose is not.** You still file Schedule FA.
- In serious cases, undisclosed foreign income/assets can be taxed at 30%
  with a penalty of up to three times the tax, plus prosecution.

## What this tool does with all this

When you say you hold foreign assets, this tool adds foreign-asset and
Form 26AS/AIS items to your document checklist, forces the ITR form to
**ITR-2/ITR-3** (never ITR-1), raises a form-changing risk flag about
Schedule FA and the ₹10 lakh Black Money penalty, and tips the "get a CA
to review" recommendation on, since foreign holdings, DTAA, and Form 67
are exactly where a professional earns their fee.

**Phase 1 of the Schedule FA builder is live**: a foreign bank or
brokerage account (tables A1/A2 combined) gets its own entry — country,
institution, account number, opening date, peak balance during the
calendar year, closing balance on 31 December, and gross interest — all
entered by you in rupees, since this tool has no live exchange-rate
source and doesn't attempt the SBI TT-rate conversion itself. This
interest is now folded automatically into your slab income (see below),
not just disclosed.

**Phase 2 is also live**: foreign shares and vested RSU/ESPP (table A3)
get their own entry — entity, acquisition/vesting date, cost basis,
closing value, and (once sold) sale proceeds and foreign tax paid. This
computes actual Indian tax: a long-term sale's flat 12.5% capital-gains
tax shows as its own CA Summary row; a short-term sale, plus the RSU/ESPP
perquisite value, fold automatically into the regime comparison's slab
income (the perquisite into the salary bucket specifically, since it's
eligible for the standard deduction unlike other income).

**A Section 90/91 foreign tax credit estimate is computed too**: exact
for long-term foreign-share gains (a known flat rate), and using Rule
128's average-rate method (this filing's own average tax rate applied to
the doubly-taxed income) for everything else — dividends, interest,
short-term gains, and the RSU/ESPP perquisite. This is a **planning
estimate**, not a Form 67 number: real filing computes credit separately
per country, which this tool doesn't itemize, so a CA should verify the
exact figure before you file Form 67 with Schedule FSI/TR.

**Foreign property, foreign trusts, and Phase 3 more broadly remain out
of scope** — see `docs/DESIGN-remaining-gaps.md` for the phased plan and
why Phase 3 is lower priority for this tool's audience.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 the mandatory foreign-asset filing requirement continues
under Section 263 of the Income Tax Act, 2025, and the Black Money Act,
2015 is unchanged. For a FY 2025-26 (AY 2026-27) return, the 1961 Act
provisions apply. Same pattern as `new-act-2025-transition.md`.

## Sources

- [Income Tax Department — Schedule FA/FSI step-by-step guide](https://www.incometax.gov.in/iec/foportal/sites/default/files/2026-03/Step%20by%20Step%20Guide%20FA%20FSI.pdf)
- [TaxGuru — foreign assets, RSUs, Schedule FA reporting and penalties](https://taxguru.in/income-tax/foreign-assets-rsus-foreign-bank-accounts-itr-schedule-fa-reporting-notices-penalty.html)
- [ClearTax — Form 67, foreign tax credit](https://cleartax.in/s/form-67-claim-foreign-tax-credit)
- [Income Tax Rules — Rule 128 (foreign tax credit)](https://incometaxindia.gov.in/Rules/Income-Tax%20Rules/rule128.htm)
- [Reyman Wealth — RSU/ESPP taxation for Indian residents](https://www.reymanwealth.com/post/taxing-foreign-equity-in-india-rsus-espps-overseas-stocks)
- [Business Today — Budget 2025 TCS threshold raised to ₹10 lakh](https://www.businesstoday.in/personal-finance/tax/story/budget-2025-tcs-threshold-for-foreign-remittances-hiked-to-rs10-lakh-what-it-means-for-you-462983-2025-02-01)
- [ClearTax — TCS on foreign remittances, including the Budget 2026 2% education/medical proposal](https://cleartax.in/s/tax-on-foreign-remittance)
- Black Money (Undisclosed Foreign Income and Assets) and Imposition of Tax Act, 2015, Sections 41–43
