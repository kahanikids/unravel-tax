# Old vs new tax regime

**Applies to:** every profile
**Last verified:** 2026-07-03, against the Income Tax Department's
official Budget 2025 FAQ (see `source_refs` in the paired JSON).

## What this covers

Two different sets of income tax slabs apply in India, and you pick one
each year: the "new regime" (lower rates, almost no deductions) or the
"old regime" (higher rates, but lots of deductions like 80C, 80D, and
HRA are allowed). This file has the slab rates, standard deduction, and
Section 87A rebate for both, for FY 2025-26 (AY 2026-27).

## New regime (the default if you don't actively choose otherwise)

| Income | Rate |
| --- | --- |
| Up to ₹4,00,000 | Nil |
| ₹4,00,001 - ₹8,00,000 | 5% |
| ₹8,00,001 - ₹12,00,000 | 10% |
| ₹12,00,001 - ₹16,00,000 | 15% |
| ₹16,00,001 - ₹20,00,000 | 20% |
| ₹20,00,001 - ₹24,00,000 | 25% |
| Above ₹24,00,000 | 30% |

Standard deduction: ₹75,000 (salaried/pension income only). Section 87A
rebate: if your slab-taxed income is ₹12,00,000 or less, you owe no tax
on it at all (rebate capped at ₹60,000). Almost no other deductions are
allowed under this regime.

**Marginal relief just above ₹12,00,000:** without it, earning ₹100 over
the rebate threshold would suddenly cost about ₹60,000 in tax. The law
smooths this: if your slab-taxed income is just above ₹12,00,000, your
tax (before cess) is capped at the amount you earned above ₹12,00,000.
So at ₹12,10,000 of income you owe at most ₹10,000 of tax, not ₹61,500.
The relief phases itself out naturally (around ₹12,75,000, normal slab
tax becomes the smaller number). The old regime's ₹5,00,000 rebate has
no such relief - that cliff is real.

## Old regime (opt in)

Same slabs for everyone below 60. Senior citizens (60 to 79) and super
senior citizens (80+) get a higher tax-free starting point:

| Income | Below 60 | 60 to 79 | 80+ |
| --- | --- | --- | --- |
| First slab, nil | Up to ₹2,50,000 | Up to ₹3,00,000 | Up to ₹5,00,000 |
| Next slab, 5% | Up to ₹5,00,000 | Up to ₹5,00,000 | N/A |
| Next slab, 20% | Up to ₹10,00,000 | Up to ₹10,00,000 | Up to ₹10,00,000 |
| Above that, 30% | Above ₹10,00,000 | Above ₹10,00,000 | Above ₹10,00,000 |

Standard deduction: ₹50,000. Section 87A rebate: if your slab-taxed
income is ₹5,00,000 or less, you owe no tax on it (rebate capped at
₹12,500). This regime is where 80C, 80D, HRA, home loan interest, and
most other deductions apply.

## What "slab-taxed income" means here, and what this doesn't cover

Both regimes tax salary, dividends, bank interest, and similar income at
these slab rates. Capital gains taxed under Sections 111A (short-term
equity) and 112A (long-term equity) are taxed at their own flat rates
under both regimes, the same either way, so a regime comparison in this
tool only looks at the slab-taxed portion of your income; it doesn't
change your capital gains tax.

Two things this tool does not model yet:

- **Surcharge**, an extra charge on top of the slab tax once your income
  passes roughly ₹50 lakh. If that applies to you, any comparison here
  won't be exact. Bring it to a CA.
- **The 80+ super senior slab** specifically. The orientation flow only
  asks whether you're a senior citizen (60+), not your exact age band,
  so a comparison for someone 80 or older will use the 60-79 slab
  instead of the correct, more generous one.

A 4% health and education cess applies to the tax amount after the
Section 87A rebate, under both regimes.

## Switching rules (not yet re-verified against a current source)

The rest of this rule (whether you can switch regimes freely each year,
and the once-in-a-lifetime restriction that applies once business or
speculative income is present) is still drafted from
`BUILD_PLAN.md`/`SYSTEM_SPEC.md` and hasn't had its own dedicated
re-check yet. Treat it as directionally right, not filing-ready, until
it gets the same verification pass as the slabs above.
