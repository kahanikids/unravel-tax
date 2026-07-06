# Capital gains — listed equity

**Applies to:** every profile with equity/equity-MF transactions
**Last verified:** 2026-07-06, against multiple current FY 2025-26 filing
guides and the Bombay High Court/ITAT rulings on the Section 87A rebate
(see `source_refs` in the paired JSON).

## What this covers

How gains on listed shares and equity mutual funds are taxed: the LTCG
and STCG rates, the annual LTCG exemption, whether STT and transaction
charges reduce your taxable gain, the surcharge cap on these gains, why
the Section 87A rebate doesn't apply to them, and what happens to a
capital loss you can't use this year.

## The rates

- **Long-term (Section 112A) — 12.5%, no indexation.** A listed share or
  equity mutual fund held for **more than 12 months** is long-term. The
  first **₹1,25,000** of long-term gains in a year is exempt; only the
  excess is taxed, at a flat 12.5%. You don't get to adjust the cost for
  inflation (no indexation) — the rate is flat instead.
- **Short-term (Section 111A) — 20%.** Held 12 months or less, taxed
  flat at 20%, from the first rupee (no equivalent exemption).
- **Both rates date from 23 July 2024** (Budget 2024). Before that, LTCG
  was 10% above a ₹1,00,000 exemption and STCG was 15% — if you're
  comparing against older material or a mid-year sale, the gain has to
  be split at that date.

## STT and transaction charges

Securities Transaction Tax (STT) is **not** deductible in computing a
capital gain — it never was, for capital-gains purposes (it *is*
deductible if the same trading counts as speculative business income
instead, which is a different computation entirely). Other transaction
charges — brokerage, exchange fees, GST on them — **are** deductible.
Check your contract notes: many brokers already net these out of the
reported buy/sell values, so double-counting them is the more common
mistake, not missing them.

## Surcharge and the Section 87A rebate

- **Surcharge is capped at 15%** on these gains specifically, even for
  someone whose total income would otherwise put them in a higher
  surcharge slab. This is a specific relief for 111A/112A income; it
  doesn't extend to your other income.
- **Section 87A rebate does not apply to 111A or 112A gains, for FY
  2025-26.** This is worth explaining rather than just stating, because
  it changed recently and the online commentary is inconsistent by
  vintage. Section 112A(6) has always excluded LTCG from the rebate.
  Section 111A (STCG) was genuinely contested: CBDT's July 2024
  ITR-utility update stopped allowing the rebate against STCG even when
  total income was within the rebate threshold, the Bombay High Court
  (*Chamber of Tax Consultants v. DGIT(Systems)*, 2025) held that
  restriction improper, and ITAT Ahmedabad allowed the rebate against
  STCG for AY 2024-25/2025-26 on the same reasoning in August 2025. That
  window closed with **Finance Act 2025**, which amended the law
  prospectively, effective **AY 2026-27** — this filing year — to
  expressly bar the 87A rebate against all special-rate income,
  including both 111A and 112A. So "no rebate" is the right answer for
  this year's return, but only because of a recent amendment, not
  because it was always the position. If you filed for AY 2024-25 or
  AY 2025-26 and were denied the STCG rebate, that denial may have been
  wrong for those specific years — worth a CA's second look if it's
  material.

## Losses

- **Short-term capital loss** offsets both short-term and long-term
  capital gains, in the same year or carried forward.
- **Long-term capital loss** offsets only long-term capital gains — it
  cannot be set against a short-term gain.
- **Carry-forward window: 8 assessment years.**
- **Filing late forfeits the carry-forward.** A capital loss can only be
  carried forward if the return is filed by the original due date under
  Section 139(1) — a belated return loses the right to carry the loss
  forward, even though the loss itself is real and the return is
  otherwise valid. See `filing-mistakes-and-penalties.md`.

## What this tool does with this

The tool reads your uploaded broker/AMC statements, classifies each sale
as short- or long-term from the actual holding period, applies the
₹1,25,000 long-term exemption cumulatively (used up by your earliest
gains first, consistent with how the advance-tax instalment calculation
in `advance-tax.md` also dates each gain), and keeps the resulting tax
out of the Section 87A rebate and out of the old-vs-new regime
comparison, since it's flat-rate income taxed the same way under both
regimes (see `regime-choice.md`). It does not yet model the 15% surcharge
cap explicitly — if your income is high enough for surcharge to bite,
have a CA confirm the final figure.

## Sources

- [ClearTax — long-term capital gains on shares](https://cleartax.in/s/long-term-capital-gains-on-shares)
- [ClearTax — short-term capital gains on shares](https://cleartax.in/s/short-term-capital-gain-on-shares)
- [ClearTax — Section 87A rebate](https://cleartax.in/s/income-tax-rebate-us-87a)
- [CAalley — will the ITAT ruling on Section 87A allow a rebate against STCG?](https://www.caalley.com/news-updates/indian-news/87a-and-stcg-will-recent-itat-ruling-on-section-87a-allow-taxpayer-to-claim-87a-rebate-on-short-term-capital-gains-while-filing-itr)
- [TaxGuru — Section 87A rebate post Bombay High Court judgment](https://taxguru.in/income-tax/section-87a-rebate-post-bombay-high-court-judgement.html)
- [EY India — Ahmedabad Tribunal allows rebate against STCG under the new regime](https://www.ey.com/en_in/technical/alerts-hub/2025/09/ahmedabad-tribunal-allows-rebate-against-short-term-capital-gains-under-new-regime)
- [FirstReports — Section 87A rebate and capital gains, FY2025-26](https://www.firstreports.in/blog/section-87a-rebate-capital-gains-stcg-ltcg-2025-26)
