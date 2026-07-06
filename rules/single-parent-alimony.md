# Single parent / guardian — alimony and maintenance

**Applies to:** Single Parent/Sole Guardian profile
**Last verified:** 2026-07-06, against judicial-doctrine summaries and current
tax-advisory coverage (see `source_refs` in the paired JSON). There is no
Income Tax Act section that governs alimony directly — this entire topic
rests on case law and how tax advisors currently apply it, so treat this
file as a well-established general position rather than a statutory rule.

## What this covers

Whether alimony or maintenance you receive (as the recipient — this tool
assumes you're typically the one receiving, though the payer side is
covered briefly too) counts as taxable income, and why that answer
depends on whether the payment is periodic or a one-time lump sum.

## Why periodic maintenance is taxed as income

Monthly or otherwise recurring maintenance payments are treated as a
**revenue receipt** and taxed in the recipient's hands as "Income from
Other Sources" under Section 56. The reasoning, most authoritatively laid
out by the Bombay High Court in *Princess Maheshwari Devi of Pratapgarh
v. CIT* (1984) 147 ITR 258 (Bom.), is that a court decree (or a
settlement agreement) is a "definite source," and periodical returns
from a definite source carry the character of income — regardless of
whether the underlying obligation is personal rather than commercial.
The court held that even though the recipient didn't marry "in order to"
receive alimony, the decree itself was obtained through her own effort,
and the regular monthly sum flowing from that decree meets the classic
definition of income: a periodical return from a definite source, not a
one-off windfall.

This has been the settled position since 1984 and is consistently
described the same way across current tax-advisory sources.

## Why a lump-sum settlement is generally treated differently

A one-time, full-and-final lump-sum alimony payment is generally treated
as a **capital receipt**, not taxable as income at all — because capital
receipts fall outside the tax net unless a specific provision taxes them,
and no provision taxes lump-sum alimony. This also traces to the same
*Princess Maheshwari Devi* case: alongside the monthly amount, the
Maharaja had been ordered to pay a one-time sum of Rs. 25,000. The
Bombay High Court held this was a capital receipt because it represented
the extinguishment (in whole or part) of the recipient's underlying
*right* to claim maintenance — not a "return" from any source.

**The nuance that matters:** the court's own reasoning contained a
condition, not a blanket rule. It held the lump sum was capital because,
on the facts, there was no pre-existing right to monthly payments that
the lump sum was substituting for ("commuting") — the lump sum and the
monthly alimony were both awarded fresh, side by side, in the same
decree. The court explicitly noted that if the lump sum had instead been
a commutation of a future monthly entitlement, the analysis could differ
— and even remarked that a larger monthly amount would likely have been
awarded had the lump sum not been paid, which it treated as not fatal to
the capital-receipt characterization, but which shows the line is a
matter of factual characterization, not a bright-line label.

In practice, this means: a payment described as "lump sum" in a
settlement deed is capital-receipt-favorable when it is genuinely a
**full and final settlement in lieu of all future maintenance claims**
— i.e., the recipient gives up the right to ask for anything more,
ever. It is on shakier ground if it's really just an accelerated or
bundled installment of what would otherwise have been periodic
maintenance (for example, "lump sum" payments made in tranches that
functionally continue to look like recurring maintenance).

## Is this settled law, or is there real dispute?

The periodic-is-taxable / lump-sum-is-capital split is described
consistently across current tax-advisory sources (ClearTax, Tax2win,
TaxGuru, Outlook Money, and others) and is treated as settled,
uncontroversial practice for straightforward cases. Where judgment
still matters:

- **The facts must actually support "capital receipt" characterization.**
  Labeling a payment "lump sum" in a settlement deed doesn't
  automatically make it a capital receipt if, in substance, it's a
  bundled or discounted stream of periodic maintenance. A CA (or the
  drafting advocate) needs to look at whether the settlement genuinely
  extinguishes the future maintenance right.
- **No Supreme Court ruling squarely affirms this for all fact patterns.**
  The doctrine rests on High Court authority (principally Bombay HC).
  It has not been contradicted in subsequent tax-advisory coverage, but
  it also hasn't been elevated to a Supreme Court precedent or codified
  in the Income Tax Act — so it remains "settled by consistent practice
  and unbroken judicial authority," not "settled by statute."
- **Even the 1984 judgment itself invited legislative clarification.**
  The Bombay High Court called the resulting asymmetry (monthly
  alimony taxed to the recipient, with no matching deduction for the
  payer) "unfortunate" and asked Parliament to fix it. That fix has
  never been made, in the 1961 Act or the new Income Tax Act, 2025.

## The payer's side (briefly, since some users of this tool may also be paying alimony)

Alimony paid — whether periodic or lump sum — is **not deductible** for
the payer. It isn't a business or professional expense, and there is no
specific provision allowing a deduction for maintenance paid to an
ex-spouse. This is confirmed by the same case law and is repeated
consistently in current advisory coverage. If alimony is paid by
diverting salary (for example, an employer pays part of the payer's
salary directly to the ex-spouse under instructions), that's treated as
an application of the payer's own already-accrued income, not a
diversion before accrual — so it doesn't reduce the payer's taxable
income either.

## Documentation implications

Because the tax result turns on the **character** of the payment, not
its label, the underlying document is what a CA will actually look at:

- A court decree or a registered settlement/consent deed should state
  clearly whether an amount is (a) periodic/monthly maintenance, or
  (b) a one-time payment made in full and final settlement of all
  present and future maintenance claims.
- If a payment is described as "lump sum" but the deed also preserves a
  right to seek further periodic maintenance later, or structures the
  "lump sum" as several tranches timed like installments, that weakens
  the capital-receipt argument.
- Keep the decree/deed, and any bank records tying the receipt to it, as
  the evidence a CA would need to support either treatment on audit.

## What this tool does with this / what still needs a CA

This tool asks you to flag whether a given alimony/maintenance receipt is
periodic or lump sum, and treats periodic receipts as taxable "Income
from Other Sources" and lump-sum receipts as a non-taxable capital
receipt for calculation purposes. It does not, and cannot, evaluate
whether a specific settlement deed's "lump sum" genuinely qualifies as a
full-and-final capital settlement versus a disguised periodic
arrangement — that determination depends on reading the actual decree or
deed, which is exactly the kind of fact-specific judgment call a CA
should make. If your lump sum was paid in tranches, followed later
periodic payments, or the deed's wording is ambiguous, get that read by
a CA before relying on the capital-receipt treatment. The tool also does
not model any deduction for a payer, consistent with the settled (if
"unfortunate," in the Bombay High Court's own words) position that none
exists.

## Sources

- [Taxation of Alimony — Sunil Shenoy, Bombay Chartered Accountants' Society Journal (BCAJ)](https://bcajonline.org/journal/taxation-of-alimony/) — professional-body publication quoting the *Princess Maheshwari Devi* judgment directly, including the capital-receipt reasoning and the court's remark urging legislative reform of the payer-deduction gap.
- [When A Princess Worried About Tax on Alimony — TheLeagle](https://theleagle.in/?p=1056) — detailed case walkthrough of *Princess Maheshwari Devi of Pratapgarh v. CIT*, including the commutation nuance and the no-deduction-for-payer holding, with a link to the judgment on Indian Kanoon.
- [Is Alimony In India Taxable? — ClearTax (CA Mohammed S Chokhawala)](https://cleartax.in/s/alimony-india-taxable) — current advisory confirming lump sum = capital receipt (not taxable), periodic = revenue receipt taxable under "Income from Other Sources," and no deduction for the payer.
- [Lump-Sum Alimony Not Taxable While Monthly Maintenance Is Taxable — TaxGuru](https://taxguru.in/income-tax/lump-sum-alimony-taxable-monthly-maintenance-taxable.html) — secondary confirmation of the same distinction and the *Princess Maheshwari Devi* citation.
- [Alimony & Taxation: Is Divorce Settlement Money Taxable in India? — Tax2win](https://tax2win.in/guide/alimony-taxation-divorce-settlement-india) — current advisory reiterating the same distinction and the "full and final settlement" framing for lump sums, with brief NRI-relevant notes on foreign-asset alimony.

**Caveat on sourcing:** the *Princess Maheshwari Devi of Pratapgarh v.
CIT* citation — (1984) 147 ITR 258 (Bombay High Court) — is corroborated
by two independent secondary sources (a CA-society journal and a legal
analysis blog, both quoting the judgment's actual text), which is
reasonably strong confirmation. I did not retrieve the primary judgment
text itself (it sits behind Indian Kanoon / paid law-report access), so
if this is ever used for anything beyond general guidance, a CA should
pull the primary text to confirm the citation and check for any later
decisions that have distinguished or narrowed it.
