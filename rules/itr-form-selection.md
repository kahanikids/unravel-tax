# Which ITR form to file

**Applies to:** every profile
**Last verified:** 2026-07-05, against current AY 2026-27 filing guidance

## The one-line version

There are seven ITR forms. Which one you file depends on three things:
who you are (an individual, a family/HUF, a firm, a company), where you
lived this year (resident or not), and what kinds of income you had.
Picking a form that is too simple can hide income you were meant to
report; picking one that is too complex just makes you disclose more than
you needed to. The aim is the simplest form that still fits.

This tool only ever deals with individuals and, partially, HUFs. Firms,
companies and trusts (ITR-5, ITR-6, ITR-7) are out of scope.

## ITR-1 (Sahaj) — the simplest form

You can use ITR-1 only if **all** of these are true:

- You are a **resident** individual (not an NRI, not RNOR).
- Your **total income is Rs 50 lakh or less**.
- Your income comes only from: salary or pension; **one** house property;
  other sources like bank/FD interest (but not lottery or race-horse
  winnings); long-term capital gains under **Section 112A of up to
  Rs 1.25 lakh** with **no** capital loss being carried forward; and
  agricultural income of **up to Rs 5,000**.

You **cannot** use ITR-1 if any of these apply — this is the list that
matters most, because several of these are things a document upload
can't reveal:

- Total income above Rs 50 lakh.
- Any short-term capital gains, or any capital gains other than the small
  Section 112A long-term gain described above.
- Any loss carried forward from an earlier year, or a loss this year that
  needs to be carried forward, under any head of income.
- Income from more than one house property.
- Any business or professional income (this includes **intraday share
  trading**, which counts as speculative business income, and F&O).
- You were a **company director** at any time in the year.
- You held **unlisted equity shares** at any time in the year.
- Any **foreign income or foreign assets**, or signing authority over a
  foreign bank account.
- You were a **non-resident** or **RNOR**.
- Agricultural income above Rs 5,000.
- Tax deducted under **Section 194N** (large cash withdrawals), or ESOP
  tax deferred under the eligible start-up rules.

## ITR-2 — individuals and HUFs without business income

Use ITR-2 if you are an individual or a HUF, you do **not** have business
or professional income, but you fall outside ITR-1 for any reason above.
That includes: capital gains of any amount, more than one house property,
total income above Rs 50 lakh, foreign income or assets, being a company
director, holding unlisted shares, being an NRI or RNOR, or having a
minor's income clubbed into your return (Schedule SPI). Total income can
be more than Rs 50 lakh.

## ITR-3 — individuals and HUFs with business or professional income

Use ITR-3 if you (as an individual or HUF) have income from a business or
profession — including **intraday trading** (speculative business income)
and F&O — or you are a partner in a firm. It can also carry your salary,
house property and capital gains alongside the business income. This is
the form for anyone who is an individual or HUF but doesn't fit ITR-1,
ITR-2 or ITR-4.

## ITR-4 (Sugam) — presumptive income

Use ITR-4 if you are a resident individual/HUF/firm (not an LLP) with
total income up to Rs 50 lakh who has opted for the presumptive taxation
scheme under Section 44AD, 44ADA or 44AE. This tool routes presumptive
cases to ITR-4 when you say so in About You, but it does not yet compute
presumptive turnover or audit thresholds — confirm eligibility with your CA.

## ITR-5, ITR-6, ITR-7 — not individuals

ITR-5 is for firms, LLPs, AOPs and BOIs; ITR-6 is for companies; ITR-7 is
for trusts and specified institutions. None of these apply to a personal
filing, and this tool does not produce them.

## What this tool can and can't check

The guided questionnaire asks about residency, HUF, income sources,
capital gains, foreign assets, and a minor's clubbed income, and it reads intraday
trading from your broker documents. From those it can correctly route
NRI, HUF, capital-gains, foreign-asset, clubbing and intraday cases, and it applies the
Rs 50 lakh ITR-1 ceiling when you have entered enough income figures for
it to be known.

It **cannot** see from uploaded documents alone: unlisted shares, whether
you are a company director, whether you have more than one house property,
or a loss carried forward from an earlier year.
Because of that, whenever the tool suggests ITR-1 it says so as
"ITR-1 fits **if** none of these apply", and lists them, rather than
asserting ITR-1 unconditionally. When in doubt, ITR-2 is the safe form —
it never hides income, it only asks for a little more detail.

## Conservative routing for small Section 112A gains

AY 2026-27 ITR-1 can report long-term capital gains under Section 112A up
to Rs 1.25 lakh when there is no capital loss to carry forward. This tool
still routes detected capital-gains uploads to ITR-2 because uploaded
broker statements can include STCG, non-112A gains, or losses that need
carry-forward treatment. That is conservative: ITR-2 asks for more detail,
but it avoids hiding a disqualifying capital-gains fact.

## Due-date split for AY 2026-27

The due date is not a single date for every profile. The rule JSON uses:

- 31 Jul 2026 for resident-simple, resident-ITR-2, NRI-without-business,
  and HUF-without-business paths.
- 31 Aug 2026 for non-audit business/professional ITR-3 paths.
- 31 Oct 2026 for audit ITR-3 paths.
- **30 Nov 2026** for anyone (or any firm partner) required to furnish a
  Section 92E transfer-pricing report — this carve-out applies **instead
  of** the 31 Aug non-audit date, not in addition to it. This tool
  doesn't yet detect Section 92E applicability, so a filer with
  international or specified-domestic transactions should confirm 30 Nov
  applies to them rather than assuming the 31 Aug default.

The 31 Aug bucket itself is a genuinely new addition for AY 2026-27 —
in past years, non-audit business/professional filers were also due
31 July, same as everyone else. No general extension of the 31 Jul
deadline had been announced for AY 2026-27 as of this check (unlike
AY 2025-26, whose 31 Jul deadline was extended twice, ultimately to
16 Sep 2025). Confirm the date on the e-filing portal before filing,
especially if the case has audit, transfer-pricing, or firm-partner
complications.

## Sources

- ClearTax, "Which ITR to File in FY 2025-26 (AY 2026-27)?"
  <https://cleartax.in/s/which-itr-to-file>
- Economic Times, "Made less than Rs 1.25 lakh LTCG from equities this year,
  do you need to file ITR?"
  <https://m.economictimes.com/wealth/tax/made-less-than-rs-1-25-lakh-ltcg-from-equities-this-year-do-you-need-to-file-itr/articleshow/132135264.cms>
- Economic Times, "Will the ITR filing deadline for AY 2026-27 be extended?"
  <https://m.economictimes.com/wealth/tax/will-the-itr-filing-deadline-for-ay-2026-27-be-extended-heres-what-taxpayers-need-to-know/articleshow/131964799.cms>
- Economic Times, "Is extended August 31 ITR deadline applicable to all
  taxpayers or only select categories?"
  <https://m.economictimes.com/wealth/tax/is-extended-august-31-itr-deadline-applicable-to-all-taxpayers-or-only-select-categories/articleshow/127855824.cms>
- [ClearTax — income tax return due dates](https://cleartax.in/s/due-date-tax-filing)
- [Upstox — why an AY 2026-27 due-date extension may not happen](https://upstox.com/news/personal-finance/tax/3-reasons-why-itr-filing-due-date-extension-for-ay-2026-27-may-not-happen-what-to-do-now/article-195737/)
- BUILD_PLAN.md Section 15.6; SYSTEM_SPEC.md Section 10.
