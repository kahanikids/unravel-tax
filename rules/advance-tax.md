# Advance tax and Section 234B/234C interest

**Applies to:** every profile with capital gains, dividends, or other
income beyond what's covered by salary TDS
**Last verified:** 2026-07-04, against multiple current filing guides
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

## What this tool calculates: Section 234B

You enter your total tax liability for the year and what's already been
paid through TDS or advance tax instalments, plus a date. The tool
checks whether advance tax was required at all, whether the senior
citizen exemption applies, and if neither lets you off, estimates the
234B interest using the 1%-per-month, part-month-counts-as-full-month
rule above.

## What this tool calculates: Section 234C

Section 234C charges the same 1%-per-month rate, but on the shortfall in
each of four instalments during the year rather than on the year as a
whole. Counting only your tax after TDS ("assessed tax"), you were meant
to have paid at least **15% by 15 June, 45% by 15 September, 75% by
15 December, and 100% by 15 March**. Each of the first three shortfalls
is charged 1% a month for three months; the last one for one month.

Two softenings are built in, and this tool applies both:

- **Safe harbours for the first two instalments.** If you'd paid at
  least 12% of your assessed tax by 15 June, the first instalment
  charges nothing (even though the target is 15%); at least 36% by
  15 September clears the second (target 45%).
- **The ₹10,000 floor.** If your tax after TDS is under ₹10,000, advance
  tax wasn't required and no 234C interest applies at all. Resident
  senior citizens with no business income stay fully exempt, same as for
  234B.

You enter what you actually paid as advance tax in each instalment
window; anything left over in your "tax already paid" figure is treated
as TDS and subtracted from the liability before the instalment targets
are worked out (TDS never needed to be paid as instalments — it was
deducted at source through the year).

**The one thing this estimate can't see: when your income arrived.**
Dividends and capital gains only count toward the instalments due
*after* they actually showed up, and escape 234C entirely if the next
instalment covered the tax on them. This estimate spreads your whole
year's tax across all four instalments, so if part of your tax comes
from gains or dividends that arrived mid-year, the true figure is
**lower** than what's shown. The tool says this next to the number every
time (see `later_income_caveat` in the paired JSON): treat the estimate
as the ceiling, not the bill, and have a CA compute the precise figure
if it's material. The estimate also skips Rule 119A's
round-down-to-₹100 step, which can only make the real figure very
slightly smaller.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 onward, Section 208 becomes Section 404, Section 234B
becomes Section 424, and Section 234C becomes Section 425, though the
underlying rates and thresholds carry over unchanged. This tool is scoped
to FY 2025-26 (AY 2026-27), so it uses the 1961 Act's section numbers
throughout, since that's what actually governs income earned in that
year even if payment happens after 1 April 2026 (see
`rules/new-act-2025-transition.json` for the same pattern already noted
for NRI repatriation forms).
