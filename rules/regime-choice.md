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

## Which deductions each regime allows (and gives up)

The whole trade-off is: the new regime has lower slab rates but almost no
deductions; the old regime has higher rates but lets you subtract a lot
first. The actual rupee limits for the common ones live in the paired
`deduction-limits.json` (so they're written down once, not copied here).

- **Old regime allows** the familiar deductions: Section 80C (up to
  ₹1,50,000 for EPF/PPF, ELSS, life insurance, home-loan principal,
  children's tuition, and so on), Section 80D (health insurance), Section
  80CCD(1B) (an extra ₹50,000 for your own NPS), HRA (house rent
  allowance), and **Section 24(b) home-loan interest up to ₹2,00,000** a
  year on a self-occupied home.
- **New regime gives up almost all of those** in exchange for the lower
  rates. The one meaningful deduction it still allows is **Section
  80CCD(2)** — your *employer's* contribution to your NPS account. That
  one is allowed under *both* regimes and is capped as a percentage of
  salary (14% for government employees, 10% for others), not as a flat
  rupee figure, so there's no single number to quote.

## Which one should you choose?

There's no universal answer — it depends on how many deductions you
actually have. A rough guide:

- **Lean towards the new regime if** you don't track many tax-saving
  investments, don't pay home-loan interest or rent you can claim, or your
  gross salary is under about ₹12,75,000 — at that level the ₹75,000
  standard deduction plus the Section 87A rebate can bring your tax to
  zero, which the old regime can't match.
- **Lean towards the old regime if** you have a home loan (that ₹2,00,000
  interest deduction is large), claim HRA, and use a good chunk of the
  ₹1,50,000 80C limit and 80D health cover. Once those add up, the higher
  old-regime rates can still work out cheaper.

The safe way to decide is to compute it both ways with your real numbers —
which is exactly what this tool's regime comparison does. And remember the
new regime is the statutory default: if you do nothing, you're in it, and
you have to actively opt out to use the old one.

## Your break-even: how many deductions make the old regime worth it

The whole old-vs-new decision comes down to one number: how many
deductions do you actually have? So the tool works out your **break-even**
— the exact amount of old-regime deductions (80C, 80D, 80CCD(1B), HRA,
Section 24(b) home-loan interest, and the rest, added together) at which
the old regime's tax would exactly match the new regime's.

- Claim **more** than the break-even and the old regime saves you money.
- Claim **less** and the new regime, which is the default, wins.

It's worked out directly on the same slab tables above, so it already
accounts for the two different standard deductions (₹50,000 old, ₹75,000
new), the Section 87A rebate, and the 4% cess. There's nothing to
memorise and no rate is assumed.

**When there's no break-even to reach.** If your new-regime tax is already
zero (for a salaried filer, that's roughly up to ₹12,75,000 of salary,
thanks to the ₹75,000 standard deduction and the Section 87A rebate), then
no amount of old-regime deductions can beat it. The best the old regime can
do is also reach zero, which is a tie, not a win. So at that income the
tool shows no break-even and simply says the new regime wins.

**Worked example, ₹15,00,000 salary.** After the ₹75,000 standard
deduction, new-regime taxable income is ₹14,25,000, and the new-regime tax
works out to ₹93,750 (before the 4% cess). To make the old regime match
that, you'd need about **₹5,43,750** of deductions: enough to bring your
old-regime taxable income down to around ₹9,06,250, where the old slabs
produce the same ₹93,750. That's a realistic-but-not-trivial stack:
₹1,50,000 of 80C, ₹25,000 of 80D, the full ₹2,00,000 of Section 24(b)
home-loan interest, and roughly another ₹1,68,750 from HRA, extra NPS
(80CCD(1B)), and similar. Below that, stay in the new regime.

(A shortcut you'll see quoted online — `Gross − 6,75,000 − new-regime
tax ÷ 0.30` — gives ₹5,12,500 for this case. That formula assumes the
crossover falls in the 30% old-regime slab, which is true at higher
salaries like ₹20,00,000 and ₹25,00,000 but not at ₹15,00,000, where the
crossover lands in the 20% band. The tool solves the real slabs instead of
using the shortcut, so it stays correct at every income.)

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
