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

For the payout side there is no number for the tool to compute — whether a
maturity is taxable depends on the policy's issue date and its
premium-to-sum-assured history, which the tool doesn't hold. So if you
tell the tool you received a life-insurance payout this year, it adds an
insurance-payout item to your document checklist and flags the 10(10D)
taxability question for a closer look, rather than silently assuming the
payout is tax-free. If your premiums are above the ₹2.5 lakh (ULIP) or
₹5 lakh (traditional) lines, treat the payout as taxable and check with a
CA on the exact figure.

## Renumbering under the new Income Tax Act, 2025

From FY 2026-27 onward these are renumbered (80C → 123, 80D → 126, 10(10D)
→ Schedule II Sr. No. 2) with the rules unchanged. For a FY 2025-26
(AY 2026-27) return, use the 1961 Act numbers. Same pattern as
`new-act-2025-transition.md`.
