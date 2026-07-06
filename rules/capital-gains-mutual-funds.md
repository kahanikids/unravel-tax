# Capital gains — mutual funds

**Applies to:** every profile holding mutual fund units
**Last verified:** 2026-07-06, against ClearTax and TaxGuru coverage of
the Section 50AA "specified mutual fund" redefinition (see `source_refs`
in the paired JSON).

## What this covers

Mutual funds split into two very different tax treatments depending on
what they actually hold, and getting the split wrong is the single most
common mistake in this area.

## Equity-oriented funds — same rates as direct shares

A fund that counts as "equity-oriented" for tax purposes is taxed exactly
like direct listed equity: 12.5% long-term (Section 112A, above the
₹1,25,000 annual exemption, holding period over 12 months), 20% short-
term (Section 111A). See `capital-gains-equity.md` for the full mechanics
— they carry over unchanged here.

## Specified mutual funds (Section 50AA) — deemed short-term, always

At the other end, a fund that qualifies as a **"specified mutual fund"**
under Section 50AA is always treated as a **short-term** capital asset,
taxed at your **slab rate**, with **no indexation** — regardless of how
long you actually held it. A fund can be deemed short-term under this
rule even after being held for five years.

**The threshold that decides this, for FY 2025-26:** a fund investing
**more than 65%** of its assets in debt or money-market instruments (or
at least 65% in units of other such funds) is a specified mutual fund.
This is the current, narrower test after a Budget 2024 redefinition — an
older, wider formulation ("any fund with 35% or less in domestic
equity") still circulates in some material and pre-dates this change.
Don't rely on that older 35% figure for a fund you're classifying this
year.

**The gap in between matters.** A fund sitting roughly between 35% and
65% equity is not automatically caught by Section 50AA either way — it
may get equity-oriented treatment, or a different capital-asset
treatment, depending on what it actually holds. There's no shortcut here:
the fund's own category (as stated in its scheme information document or
factsheet) is what determines this, not a rule of thumb.

## What this tool does with this

For a mutual fund transaction you enter or upload, the tool needs to know
which bucket it falls into before it can apply the right rate. It
doesn't yet read a fund's exact debt/equity allocation from a broker or
AMC statement — that figure isn't usually on a contract note — so it
asks you to confirm the fund's type rather than guessing from the name
alone (fund names are not a reliable guide: "hybrid," "balanced," and
similar labels don't map cleanly onto the 65% legal threshold). Once you
confirm equity-oriented vs. specified, it applies the relevant rate
above.

## Sources

- [ClearTax — Section 50AA of the Income Tax Act](https://cleartax.in/s/section-50aa-income-tax-act)
- [TaxGuru — Budget 2024 amendment to the "specified mutual fund" definition, Section 50AA](https://taxguru.in/income-tax/amendment-specified-mutual-fund-definition-section-50aa-budget-2024.html)
- `capital-gains-equity.json` (Section 112A/111A rates applied to equity-oriented funds)
