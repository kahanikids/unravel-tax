# Which ITR form to file

**Applies to:** every profile
**Last verified:** 2026-07-03 (against a secondary source — see Sources)

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
scheme under Section 44AD, 44ADA or 44AE. This tool does not currently
compute presumptive income, so it does not route anyone to ITR-4.

## ITR-5, ITR-6, ITR-7 — not individuals

ITR-5 is for firms, LLPs, AOPs and BOIs; ITR-6 is for companies; ITR-7 is
for trusts and specified institutions. None of these apply to a personal
filing, and this tool does not produce them.

## What this tool can and can't check

The guided questionnaire asks about residency, HUF, income sources,
capital gains, and a minor's clubbed income, and it reads intraday
trading from your broker documents. From those it can correctly route
NRI, HUF, capital-gains, clubbing and intraday cases, and it applies the
Rs 50 lakh ITR-1 ceiling when you have entered enough income figures for
it to be known.

It **cannot** see, and so does not ask about: foreign assets or income,
unlisted shares, whether you are a company director, whether you have more
than one house property, or a loss carried forward from an earlier year.
Because of that, whenever the tool suggests ITR-1 it says so as
"ITR-1 fits **if** none of these apply", and lists them, rather than
asserting ITR-1 unconditionally. When in doubt, ITR-2 is the safe form —
it never hides income, it only asks for a little more detail.

## A note on the house-property count

The secondary source used here is internally inconsistent on whether
ITR-1 allows one or two house properties for AY 2026-27. This file uses
the long-standing, conservative rule of **one** house property for
ITR-1: a filer with two properties is routed to ITR-2, which is never
wrong even if the looser reading turns out to be correct. Confirm against
the official ITR-1 instructions if this matters to a specific filing.

## Sources

- ClearTax, "Which ITR to File in FY 2025-26 (AY 2026-27)?"
  <https://cleartax.in/s/which-itr-to-file>
- CBDT ITR-form notifications for AY 2026-27 (Official Gazette).
- BUILD_PLAN.md Section 15.6; SYSTEM_SPEC.md Section 10.

Due dates in the paired `itr-form-selection.json` are carried over from
the earlier draft and are still pending verification against the CBDT
due-date source — that is a separate check from form choice.
