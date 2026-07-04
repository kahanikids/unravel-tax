# Insurance (life and health)

**Applies to:** anyone who pays an insurance premium or receives an
insurance payout.

**Last verified:** 2026-07-03, against multiple current FY 2025-26 filing guides (see `source_refs` in the paired JSON).

## The one thing to understand first

Insurance touches your return in two completely separate ways, and people
mix them up. **Paying** a premium may get you a deduction. **Receiving**
a payout is normally tax-free, but not always any more. Keep the two
apart.

## Paying premiums

- **Life-insurance premium counts inside Section 80C.** Premiums for you,
  your spouse, or your children ride *inside* the single ₹1,50,000 Section
  80C ceiling, not on top of it (see `deduction-limits.json`). Old regime
  only. And the premium only qualifies up to 10% of the sum assured (20%
  for policies issued 1-Apr-2003 to 31-Mar-2012).
- **Health-insurance premium is Section 80D.** Up to ₹25,000, or ₹50,000
  when a senior citizen is covered. Old regime only. The rupee limits live
  in `deduction-limits.json`.

Because both of these already sit in `deduction-limits.json`, this file
does not repeat the rupee figures — it points at them.

## Receiving a payout (Section 10(10D))

This is where the recent changes are. A maturity or survival payout used
to be simply tax-free. It still usually is, but two Budgets carved out
high-premium policies:

- **ULIPs issued on/after 1-Feb-2021.** If your **aggregate** annual
  premium across all your ULIPs goes over **₹2,50,000** in any year, the
  maturity is no longer exempt. The gain is taxed as **capital gains** at
  listed-equity rates — 12.5% long-term above the ₹1.25 lakh yearly
  exemption, 20% short-term (same treatment as `capital-gains-equity.md`).
- **Traditional (non-ULIP) policies issued on/after 1-Apr-2023.** If your
  **aggregate** annual premium across all such policies goes over
  **₹5,00,000** in any year, the maturity is taxed as **income from other
  sources** at your slab rate, on (payout minus the premiums you paid).
- **The old 10%-of-sum-assured rule still applies too.** Independent of
  the caps above, for any policy issued on/after 1-Apr-2012 the annual
  premium must stay within 10% of the sum assured (20% for 1-Apr-2003 to
  31-Mar-2012) for the payout to be exempt.
- **Death benefits are always fully exempt**, regardless of premium — the
  only exception is Keyman insurance.
- **TDS (Section 194DA).** A taxable payout of ₹1 lakh or more has 2% TDS
  deducted on the income portion (payout minus premiums paid).

## What this tool does with all this

The premium side needs nothing new: your life and health premiums already
flow through the ₹1,50,000 80C figure and the 80D figure you enter, and
the tool folds those into the old vs new regime comparison.

For the payout side, the dashboard's aggregate-premium figure is a quick
planning signal, but a precise answer needs the policy's issue date and
premium-to-sum-assured history — so the Results page has a per-policy
"Insurance" section where you add one card per policy (type, issue date,
sum assured, this policy year's premium, total premiums paid to date, and
this year's payout). From that the tool:

- Checks **both** the sum-assured-ratio test and the type's
  aggregate-premium cap, per policy — either one failing loses the
  exemption, independent of the other.
- Pools the aggregate-premium test correctly: it sums premium across every
  policy of the *same type* issued on/after that type's cutoff date, not
  just the one policy, since a shortfall on one policy can be caused by
  premium paid into another of the same type.
- Computes the **taxable amount** (payout minus premiums paid) for any
  policy that loses its exemption.
- For a taxable **ULIP**, estimates the capital-gains tax at listed-equity
  rates, split short/long-term by that policy's own holding period —
  folded into the CA Summary as its own row. It does **not** yet combine
  that gain with any other equity long-term gains you have this year under
  the *one* shared ₹1.25 lakh annual exemption; each taxable ULIP uses the
  full exemption on its own, so your real combined liability may be higher
  than shown if you also have other LTCG this year. The tool says this
  plainly rather than silently double-exempting.
- For a taxable **traditional** policy, computes the taxable amount and
  folds it into the "other income" side of the old-vs-new regime
  comparison at slab rate (both regimes see it the same way, since regime
  choice doesn't change how it's taxed).
- Death benefits are always exempt, and skip the rest of the form.

If you don't want to enter per-policy detail, the dashboard's original
aggregate-premium check against the ₹2.5 lakh (ULIP) / ₹5 lakh
(traditional) lines still works as a lighter-weight signal — treat it as a
heads-up, not a final answer, since it can't see any individual policy's
issue date or exact ratio.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 onward these are renumbered (80C → 123, 80D → 126, 10(10D)
→ Schedule II Sr. No. 2) with the rules unchanged. For a FY 2025-26
(AY 2026-27) return, use the 1961 Act numbers. Same pattern as
`new-act-2025-transition.md`.
