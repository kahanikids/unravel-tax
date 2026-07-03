# HUF basics

**Applies to:** HUF profile
**Last verified:** 2026-07-03, against the Income Tax Department's own HUF
tax rates page (see `source_refs` in the paired JSON).

## What this covers

A Hindu Undivided Family (HUF) is its own taxable entity, separate from
any individual member (including the karta who manages it), with its own
PAN and its own return. It's taxed at the same slab rates as an
individual, under both the old and new regimes, but three things make it
different from filing as a person:

- **No Section 87A rebate.** That rebate (the one that brings an
  individual's tax to zero up to ₹12,00,000 under the new regime, or
  ₹5,00,000 under the old one) is written into the law as available only
  to a resident individual. An HUF pays tax from the very first taxable
  slab, with no equivalent zeroing-out.
- **No standard deduction.** The ₹75,000 (new regime) or ₹50,000 (old
  regime) standard deduction only applies against salary/pension income,
  and an HUF can't have salary income in the first place.
- **Can't have salary income at all.** An HUF's income comes from house
  property, capital gains, business, or other sources, never a salary,
  since a salary requires an employer-employee relationship an HUF
  structurally can't be party to.

It also can't use ITR-1 or ITR-4 (those are individual-only forms):
ITR-2 without business income, ITR-3 with it.

## What this tool does with this

Because the app's old-vs-new regime comparison tool is built around a
salary-income input and a standard deduction, that comparison doesn't fit
an HUF's numbers at all, not just the missing rebate. Rather than quietly
running the wrong math, the tool tells an HUF filer to skip that
comparison and take actual slab-tax figures to a CA. The capital gains,
dividend, and interest calculations elsewhere in the app apply the same
way to an HUF as to an individual, since those use flat rates untouched
by any of the differences above.
