# Loan treatment (home, education, electric vehicle, and other loans)

**Applies to:** anyone repaying a loan who wants to know what, if
anything, they can claim for it. Almost everything here works **only
under the old regime**, with one exception (let-out home-loan interest),
so it mainly matters if you are on, or comparing against, the old regime.
**Last verified:** 2026-07-03, against multiple current FY 2025-26 filing
guides (see `source_refs` in the paired JSON).

## The one thing to understand first

A loan itself is never income and never a deduction. What can save you
tax is the **interest** you pay on certain loans, and (for a home loan)
a slice of the **principal**. And almost all of it is switched off if you
file under the new regime. So the first question is always: which regime
are you on?

## Home loan

- **Interest, self-occupied home (Section 24(b)) up to ₹2,00,000.** If you
  live in the home (or it is empty because you work elsewhere), you can
  deduct up to ₹2,00,000 of home-loan interest a year, **old regime
  only**. The construction has to have finished within 5 years of the
  loan, otherwise the cap drops to ₹30,000. The new regime gives **no**
  interest deduction on a home you live in.
- **Interest, rented-out home (Section 24(b)) no cap.** If the home is let
  out, the **full** interest is deductible against the rent, under
  **both** regimes. The catch is the loss: if interest exceeds the rent,
  the resulting "loss from house property" can be set off against your
  other income only up to ₹2,00,000 a year (old regime), with the rest
  carried forward 8 years. Under the **new** regime that loss cannot be
  set off against other income at all and cannot be carried forward, so
  the benefit is effectively limited to the rent itself.
- **Principal (Section 80C), inside the ₹1,50,000 limit.** The principal
  part of your EMI, plus stamp duty and registration in the year you paid
  them, counts **inside** the single ₹1,50,000 Section 80C ceiling, not on
  top of it (see `deduction-limits.json`). Old regime only.
- **First-time-buyer top-ups (Section 80EE / 80EEA).** Extra interest
  deduction *over* the ₹2,00,000, but only for loans sanctioned in a
  closed window: 80EE for loans sanctioned in FY 2016-17 (cap ₹50,000),
  80EEA for affordable-housing loans sanctioned between 1-Apr-2019 and
  31-Mar-2022 (cap ₹1,50,000, stamp value up to ₹45 lakh). You cannot
  claim both for the same loan. Old regime only. If your loan was
  sanctioned after March 2022, neither applies.
- **Two homes can be self-occupied (FY 2025-26).** You can now treat up to
  two houses as self-occupied with no tax on notional rent on the second,
  but the combined self-occupied interest deduction still can't exceed
  ₹2,00,000.

## Education loan (Section 80E)

- **No rupee limit.** The entire interest paid in the year is deductible
  (the principal is not). Old regime only.
- **For up to 8 years**, counting from the year you start repaying, or
  until the interest is fully paid, whichever comes first.
- **For whom:** a loan for the higher education of you, your spouse, your
  children, or a student you're the legal guardian of, from a bank, NBFC,
  or approved charitable institution. Only individuals can claim it, not
  an HUF.

## Electric vehicle loan (Section 80EEB)

- **Up to ₹1,50,000** of interest on a loan to buy an electric vehicle,
  for loans **sanctioned between 1-Apr-2019 and 31-Mar-2023**. Old regime
  only. If the vehicle is used for business, interest above the cap may be
  claimable as a business expense instead.

## Personal loans, gold loans, top-up loans

- **No deduction by default.** These become deductible only by what the
  money was actually *used for*: interest on any loan used to buy or build
  a house can qualify under Section 24(b) even if it isn't called a "home
  loan"; interest on a loan used for a business is a business expense;
  interest on a loan taken to earn dividend income is deductible against
  that dividend, but capped at 20% of it (Section 57). Keep proof of what
  the borrowed money was used for.

## A special rule: lending within the family

A **genuine loan** to your spouse or a relative, at a reasonable interest
rate and properly recorded, is not a gift and does **not** trigger
income-clubbing under Section 64. But money simply **given** to a spouse,
or to a minor child, and then invested has its income clubbed back to
you. So if you help family with money, a documented loan (with interest)
is treated very differently from a transfer without consideration. See
`single-parent-clubbing.md` and `huf-clubbing.md` for the clubbing side.

## What this tool does with all this

On the results screen, under "Add more numbers to refine", you can enter
the interest you paid on a home loan (self-occupied), a first-time-buyer
80EEA top-up, an education loan, and an electric-vehicle loan. The tool
caps each one at the limit above (read from the paired JSON, never
hardcoded) and folds the total into the **old-regime** side of the old
vs new regime comparison, so you can see whether your loans actually make
the old regime cheaper for you. It does **not** try to model the let-out
house-property loss set-off, the 80C principal (that rides inside the 80C
figure you enter separately), or business-use vehicle interest. For those,
or for anything ambiguous, check with a CA.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 onward these sections are renumbered (80C → 123, 80E →
129, 80EE/80EEA → 130, 80EEB → 132, and the house-property interest under
24(b) → Section 22), with the limits unchanged. For a FY 2025-26
(AY 2026-27) return filed around July 2026, use the old 1961 Act numbers,
since that's what governs income earned in that year even if you pay after
1 April 2026. Same pattern as `new-act-2025-transition.md`.
