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
  are treated like unlisted shares: long-term only after **24 months**
  (12.5%), otherwise short-term at slab rate.
- **RSU / ESPP:** the value at vesting is a salary perquisite taxed at
  slab rate; selling later is a separate capital gain.
- **Foreign tax credit.** If tax was withheld abroad, you can credit it
  against your Indian tax on the same income under Section 90/91, by
  filing **Form 67** (before you file the return) along with Schedule FSI
  and Schedule TR. Miss Form 67 and the credit can be denied.

## TCS when you send money abroad (LRS)

When you remit money overseas under the Liberalised Remittance Scheme
(e.g. to buy foreign shares), the bank collects TCS:

- From **1 April 2025** the threshold rose from ₹7 lakh to **₹10 lakh** per
  financial year, combined across all your LRS remittances.
- **20%** on investment, gift, and most other remittances above ₹10 lakh.
- **2%** on education (not loan-funded) and medical remittances above
  ₹10 lakh; **nil** where the remittance is funded by an education loan.
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

The tool can't compute a Schedule FA for you — it doesn't hold your
per-asset foreign values. What it does do when you say you hold foreign
assets: it adds foreign-asset and Form 26AS/AIS items to your document
checklist, forces the ITR form to **ITR-2/ITR-3** (never ITR-1), raises a
form-changing risk flag about Schedule FA and the ₹10 lakh Black Money
penalty, and tips the "get a CA to review" recommendation on, since
foreign holdings, DTAA, and Form 67 are exactly where a professional
earns their fee. The actual disclosure and foreign tax credit you do in
the portal or with your CA.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 the mandatory foreign-asset filing requirement continues
under Section 263 of the Income Tax Act, 2025, and the Black Money Act,
2015 is unchanged. For a FY 2025-26 (AY 2026-27) return, the 1961 Act
provisions apply. Same pattern as `new-act-2025-transition.md`.
