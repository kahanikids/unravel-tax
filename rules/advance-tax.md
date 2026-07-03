# Advance tax and Section 234B interest

**Applies to:** every profile with capital gains, dividends, or other
income beyond what's covered by salary TDS
**Last verified:** 2026-07-03, against multiple current filing guides
(see `source_refs` in the paired JSON).

## What this covers

Most tax in India is meant to be paid as the year goes along ("advance
tax"), not as one lump sum when you file. If your total tax for the year,
after subtracting TDS already deducted, comes to ₹10,000 or more, you're
expected to have paid it in instalments during the year under Section
208. Miss that, and Section 234B charges simple interest at 1% per month
(any part of a month counts as a full month) on the shortfall, running
from 1 April of the assessment year until you actually pay it, if what
you paid in advance came to less than 90% of your assessed tax.

**Resident senior citizens (60+) with no business or professional income
are exempt from all of this** under Section 207(2). This is the same
exemption already recorded in
`rules/senior-citizen-advance-tax-and-regime.json`.

## What this tool calculates

You enter your total tax liability for the year and what's already been
paid through TDS or advance tax instalments, plus a date. The tool
checks whether advance tax was required at all, whether the senior
citizen exemption applies, and if neither lets you off, estimates the
234B interest using the 1%-per-month, part-month-counts-as-full-month
rule above.

## What this tool does not calculate: Section 234C

Section 234C charges the same 1%-per-month rate, but on a shortfall in
each of four quarterly instalments (15% by 15 June, 45% by 15 September,
75% by 15 December, 100% by 15 March) rather than on the year as a whole.
Doing this correctly needs to know *when* in the year each rupee of
income arrived, because capital gains and dividends that only showed up
later in the year are excluded from the earlier instalments' targets.
This tool doesn't capture income by quarter yet, so a naive full-year
estimate would overstate 234C interest for anyone whose gains or
dividends came in later in the year. Rather than show a number that's
likely wrong in the direction of frightening you more than the law
actually requires, 234C is left out entirely for now. If your total tax
after TDS is meaningfully more than ₹10,000, assume some 234C interest
may also apply and ask a CA for the precise figure.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 onward, Section 208 becomes Section 404, Section 234B
becomes Section 424, and Section 234C becomes Section 425, though the
underlying rates and thresholds carry over unchanged. This tool is scoped
to FY 2025-26 (AY 2026-27), so it uses the 1961 Act's section numbers
throughout, since that's what actually governs income earned in that
year even if payment happens after 1 April 2026 (see
`rules/new-act-2025-transition.json` for the same pattern already noted
for NRI repatriation forms).
