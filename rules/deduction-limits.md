# Deduction limits (80C, 80D, 80CCD(1B) NPS)

**Applies to:** anyone filing under the **old** regime who wants to claim
common deductions. The **new** regime allows none of these, so they only
matter if you are comparing regimes or filing under the old one.
**Last verified:** 2026-07-03, against multiple current filing guides
(see `source_refs` in the paired JSON).

## What this covers

Three of the most-used deductions, and how much of each you are allowed
to claim in a year:

- **Section 80C — up to ₹1,50,000.** A single combined ceiling covering
  EPF and PPF, ELSS (tax-saving mutual funds), life-insurance premiums,
  the principal portion of a home-loan EMI, five-year tax-saving fixed
  deposits, and children's tuition fees, among others. Putting more than
  ₹1,50,000 into these does not give you more deduction.
- **Section 80D — up to ₹25,000, or ₹50,000 if a senior citizen is
  covered.** Health-insurance premiums (and a small amount of preventive
  health check-up cost) for you and your family. The higher ₹50,000 limit
  applies when the policy covers someone aged 60 or above.
- **Section 80CCD(1B) — up to ₹50,000.** An *extra* deduction for your own
  National Pension System (NPS) contribution, on top of the ₹1,50,000
  Section 80C limit — not counted within it.

## Why this is a separate rule file

The dashboard's deduction-progress widget reads these ceilings from the
paired JSON so nothing is hardcoded in the interface (see CLAUDE.md). The
figures a filer enters for each section are their own; this file only
supplies the limit each one is measured against.

## What this does not cover

Many other deductions exist (80CCD(2) employer NPS, 80E education-loan
interest, 80G donations, 80TTA/80TTB interest, the 80D parents' add-on,
and more). Only the three headline limits above are modelled here, since
they are the ones the dashboard visualises. For anything else, or to
confirm eligibility, check with a CA. See `senior-citizen-basics.md` for
80TTA/80TTB, `loan-treatment.md` for 80E, and `regime-choice.md` for
80CCD(2).

## Sources

- [ClearTax — Section 80C and other deductions](https://cleartax.in/s/80c-80-deductions)
- Income Tax Act, 1961, Sections 80C, 80D, 80CCD(1B)
