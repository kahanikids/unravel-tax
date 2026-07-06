# Single parent / guardian — minor's income clubbing

**Applies to:** Single Parent/Sole Guardian profile
**Last verified:** 2026-07-04, against Income Tax Department case law text and
current filing guides (see `source_refs` in the paired JSON).

## What this covers

If a minor child has income of their own (interest on a bank account or
investment opened in their name, for example), that income doesn't get
its own separate tax return. Instead, it's added ("clubbed") into the
income of whichever parent earns more, under Section 64(1A), and reported
in that parent's Schedule SPI.

## The one exemption that softens this

Section 10(32) lets the parent it's clubbed into deduct up to ₹1,500 per
minor child from the clubbed amount, or the actual clubbed income if it's
less than that. This is available for up to 2 children. So if your child
earned ₹1,000 in bank interest, ₹1,000 gets clubbed minus ₹1,000
exemption, net zero. If your two children each earned ₹5,000, that's
₹10,000 clubbed minus ₹3,000 exemption (₹1,500 x 2), net ₹7,000 added to
your income.

## What isn't clubbed

- Income the minor earned from their own manual work, or from applying
  their own skill or talent (a young performer's earnings, for example).
- Income of a minor with a disability recognized under Section 80U.
- Once the child turns 18 partway through the year, clubbing stops from
  that point; they file their own return after that.

## What this tool calculates vs. what still needs a CA

This tool computes the clubbed amount after the per-child exemption, from
the minor's income and child count you enter, and adds it as its own line
in your results. If part of the minor's income falls under the exceptions
above (their own manual work, their own skill or talent, or a Section 80U
disability), you can enter that part separately and the tool leaves it
out of the clubbed amount before applying the exemption. It doesn't place
the figure into Schedule SPI itself, and it can't verify that an
exception genuinely applies — keep the evidence (the source of the
minor's earnings, or the 80U certificate) and have a CA confirm it.

## Sources

- Income Tax Act, 1961, Section 64(1A) (clubbing of minor's income)
- Income Tax Act, 1961, Section 10(32) (per-child exemption on the clubbed amount)
