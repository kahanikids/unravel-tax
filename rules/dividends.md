# Dividends

**Applies to:** every resident profile with dividend income (from Indian
company shares, foreign company shares, or mutual funds). NRI dividend
taxation is a different, flat-rate regime — see `nri-tds-and-refunds.md`
and don't duplicate it here.

**Last verified:** 2026-07-06, against multiple current FY 2025-26 filing
guides (see `source_refs` in the paired JSON).

## What this covers

How dividend income is taxed for a resident individual: full taxability
at slab rate since the 2020 abolition of Dividend Distribution Tax (DDT),
the current Section 194/194K TDS threshold and rate, why dividends need a
quarter-wise breakup in Schedule OS for advance-tax purposes, the Section
57 interest-deduction cap, and the Section 2(22)(e) deemed-dividend edge
case.

## Full taxability at slab rate (no DDT since FY 2020-21)

Before 1 April 2020, the company paying the dividend bore Dividend
Distribution Tax and the shareholder received it tax-free. The **Finance
Act, 2020** abolished DDT: **any dividend received on or after 1 April
2020 is taxable in the recipient's hands**, reported under **"Income from
Other Sources"** (Section 56), at their normal **slab rate** — not a flat
rate, and not eligible for any special-rate treatment. This is still the
position for **FY 2025-26 (AY 2026-27)**; nothing in Budget 2025 changed
this basic mechanic. The old Section 115BBDA (a 10% tax that used to
apply only above ₹10 lakh of dividends for resident individuals/HUFs/
firms) was withdrawn at the same time, so there's no separate
higher-dividend-amount rule to track either — it's slab rate from the
first rupee, full stop.

This applies equally to dividends from an **Indian company**, a **foreign
company**, and **mutual fund distributions** — all three are "income from
other sources" taxed at slab rate for a resident. A foreign-company
dividend can also trigger double taxation (taxed both in India and
abroad); relief is available under the relevant DTAA or, absent a treaty,
under Section 91.

**No equivalent to the equity capital-gains exemption.** Unlike listed-
equity capital gains, which get the first ₹1,25,000 of long-term gains
tax-free (see `capital-gains-equity.md`), dividends have **no** exemption
threshold of any kind. Every rupee of dividend is taxable.

## TDS: Section 194 (shares) and Section 194K (mutual funds)

- **Section 194** covers dividends on shares (equity or preference) paid
  directly by an Indian or foreign company. **Section 194K** covers
  dividend/income distributions from mutual fund units — a separate
  section, but with the same numbers in practice.
- **Threshold: ₹10,000 per financial year, per payer** (i.e., per company
  or per fund house/AMC) — raised from the earlier ₹5,000 by
  **Budget 2025**, effective **1 April 2025**, so this is a genuine change
  for FY 2025-26 compared to FY 2024-25. Below that amount from a given
  payer in the year, no TDS is deducted at all.
- **Rate: 10%** with a valid PAN on record. **20%** if you haven't
  furnished your PAN. No surcharge or cess is added at the TDS stage.
- **The threshold applies per payer, not on your total dividend income
  for the year.** Ten separate companies each paying you ₹9,999 attracts
  no TDS anywhere, even though your total dividend income is nearly
  ₹1,00,000 — TDS is purely a payer-side withholding check, not a measure
  of your actual tax liability, which is still due on the full amount at
  your slab rate regardless of whether any TDS was withheld.
- **Form 15G/15H** can be submitted to stop TDS altogether if your
  estimated total tax for the year is nil (15G) or you're a senior citizen
  with nil tax payable (15H) — this doesn't change taxability, only
  whether TDS is deducted upfront.
- TDS on dividends paid to **non-residents** is a different rate (20%
  under Section 115A, subject to treaty) — see `nri-tds-and-refunds.md`.

## Why this matters for advance tax specifically

Dividends are exactly the kind of income that trips people up on Section
234C interest. Because dividend income doesn't arrive evenly and isn't
taxed at a flat rate, the ITR's **Schedule OS** asks for a **quarter-wise
breakup** of dividend income received during the year, specifically so
the advance-tax instalment computation can credit each quarter with the
dividends actually received by that point, rather than assuming your full
year's dividend arrived on day one. If you don't provide the quarter-wise
split, the return (and the underlying 234C computation) defaults to
spreading the dividend income **evenly across all four quarters** —
which can overstate what was "due" in the earlier instalments if most of
your dividends actually arrived later in the year, or understate it if
they arrived earlier. See `advance-tax.md`, which already flags that
dividends (unlike dated capital-gains transactions) are one of the income
types this tool cannot precisely quarter-date on its own.

## Deemed dividend — Section 2(22)(e) (out of scope, flag only)

A loan or advance from a **closely-held company** (one in which the
public isn't substantially interested) to a shareholder holding **10% or
more** of its voting power, up to the company's accumulated profits, can
be **taxed as a deemed dividend** even though no dividend was formally
declared. This also extends to loans made to a concern (like a firm) in
which that shareholder has a substantial interest. This is a narrow
anti-avoidance provision that mostly matters for close family-run
companies and private-company promoters. This tool does not model it —
if you or a family member has taken a loan from a closely-held company
where you're a substantial shareholder, get a CA's opinion on whether
Section 2(22)(e) applies.

## Interest expense against dividend income (Section 57)

If you borrowed money to invest in dividend-paying shares or mutual fund
units, the interest you pay is deductible against the dividend, but
**capped at 20% of the dividend income** — no other expense (collection
charges, demat fees, etc.) is deductible at all. This exact mechanic,
including how the tool applies the cap, is already documented in
`loan-treatment.md` — see its "Personal loans, gold loans, top-up loans"
section; this file doesn't restate it.

## What this tool does with this

The tool takes your total dividend income for the year and taxes it in
full at slab rate under "Income from Other Sources," on both the old- and
new-regime sides of the comparison (dividends are taxed the same way
under both regimes, so regime choice doesn't affect this income). If you
provide a quarter-wise breakup, the advance-tax calculator uses it to date
your dividend income into the correct instalment window for the Section
234C computation, the same way it already dates listed-equity capital
gains; if you don't, it falls back to spreading the total evenly across
all four quarters and flags that assumption next to the number (see
`later_income_caveat` in `advance-tax.json`).

## What still needs a CA

- Section 2(22)(e) deemed-dividend exposure from loans out of a
  closely-held company.
- Interest deducted under Section 57 beyond simple cases — the tool
  applies the flat 20%-of-dividend cap but does not verify that the
  underlying loan was genuinely used to acquire the dividend-paying
  investment.
- Foreign-company dividends where double-taxation relief (DTAA or
  Section 91) is claimed — the tool doesn't compute this relief.

## Sources

- [ClearTax — tax on dividend income, FY 2025-26](https://cleartax.in/s/how-dividends-taxable)
- [ClearTax — Section 194 dividend TDS, thresholds and rates for FY 2025-26](https://cleartax.in/s/section-194-income-tax-act)
- [ClearTax — Section 194K, TDS on mutual fund income](https://learn.quicko.com/section-194k-tds-dividend-mutual-funds)
- [IndiaFilings — TDS rule changes from 1 April 2025](https://www.indiafilings.com/learn/tds-rule-changes-from-1st-april-2025)
- [TaxBuddy — how to fill Schedule OS for interest and dividend income](https://www.taxbuddy.com/blog/schedule-os-income-reporting)
- [ClearTax — interest under Section 234C](https://cleartax.in/s/interest-imposed-by-income-tax-department-under-section-234c)
- [Tax2win — deemed dividend under Section 2(22)(e)](https://tax2win.in/guide/deemed-dividend-section2-22e)
- [ClearTax — Dividend Distribution Tax](https://cleartax.in/s/dividend-distribution-tax)
- `rules/loan-treatment.md` (Section 57 interest-deduction cap mechanics)
- `rules/advance-tax.md` (Section 234C instalment dating, dividends as an undated income type)
- `rules/capital-gains-equity.json` (contrast: the ₹1,25,000 LTCG exemption dividends don't get)
- `rules/nri-tds-and-refunds.md` (non-resident dividend taxation under Section 115A — separate flat-rate regime)
