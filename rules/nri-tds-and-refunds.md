# NRI — TDS and refunds

**Applies to:** NRI profile
**Last verified:** 2026-07-04, against the Income Tax Department's own
non-resident taxation guide and multiple current NRI filing guides (see
`source_refs` in the paired JSON).

## What this covers

A resident's tax is mostly self-assessed and paid through the year; an
NRI's Indian income is instead **withheld at source (TDS) by whoever
pays it**, almost always at a flat rate that has nothing to do with
their actual slab or final liability. This is why NRIs so often end up
owing nothing more, or even due a refund, once they actually file — the
TDS was just a conservative up-front collection, not the final bill.

The domestic (no-treaty) TDS rates are:

- **NRO account interest — 30%** under Section 195. This is well above
  what most NRIs actually owe once it's taxed at their real slab rate,
  which is why NRO interest so often produces a refund.
- **Dividends — 20%** under Section 115A. Unlike NRO interest, this
  *is* the final tax rate too (not just a withholding rate) — dividends
  paid to a non-resident are taxed flat, not at slab, regardless of how
  much other income they have.
- **Listed-equity capital gains — the same 12.5%/20% rates as
  Sections 112A/111A** (see `rules/capital-gains-equity.json`), since
  the broker/AMC withholds at whatever rate the gain is ultimately
  taxed at.

## Where a tax treaty (DTAA) changes this

A Tax Residency Certificate (TRC) plus Form 10F let the payer withhold
at a **lower treaty rate** instead of the 30%/20% domestic defaults,
where the India-[country] DTAA sets one — see
`rules/nri-dtaa.json`'s `nro_withholding_rates` for the specific
countries this tool knows. Two different things happen depending on the
income type:

- **NRO interest:** the treaty typically caps the tax India can charge,
  but only if that cap is *lower* than what slab-rate taxation would
  produce anyway — for many NRIs slab tax on interest already comes in
  under the treaty rate, so the treaty makes no difference. Getting
  this exactly right needs the interest taxed at its actual marginal
  slab rate, which needs full income context; this tool doesn't attempt
  that precision — see the caveat on the DTAA panel.
- **Dividends:** Section 115A explicitly says the taxpayer gets
  **whichever is lower, the 20% domestic rate or the treaty rate** —
  never the higher one, even for a country whose treaty dividend rate
  (which is often written for corporate shareholders, not individuals)
  happens to exceed 20%. This tool computes that lower-of comparison
  directly and shows it as the actual dividend tax figure, not just a
  caveat.

## What this tool calculates

- **Expected TDS vs. what you say was actually withheld**, for NRO
  interest and dividends, using the treaty rate when this tool knows
  one for your country (or the domestic default otherwise). A gap
  between the two is flagged as a recoverable refund (over-withholding)
  or a shortfall (under-withholding) — the same reconciliation
  philosophy as the AIS/TDS panel elsewhere in this tool.
- **Actual dividend tax at the Section 115A/DTAA flat rate**, applied
  as the real figure (not a caveat) and excluded from the slab-taxed
  side of the old-vs-new regime comparison, since it isn't slab income
  for a non-resident.

## What this tool still doesn't calculate

- Precise NRO interest tax at the real marginal slab rate (needs full
  income context this tool doesn't have) — interest still goes through
  the general slab computation, same as a resident's, which is the
  domestic-law default in the absence of a materially lower treaty
  benefit.
- NRO **capital gains** TDS-vs-actual reconciliation (this tool checks
  interest and dividends only for now).
- **Repatriation** limits and Form 15CA/15CB — see
  `rules/nri-repatriation.json`.
- **Form 13** lower/nil-deduction certificates — this tool doesn't
  generate or track one; it only reconciles what was actually withheld
  against what should have been.

## Sources

- [Income Tax Department — taxation of non-residents](https://www.incometaxindia.gov.in/documents/20117/42998/Taxation-of-Non-Resident_2026-03-19_04-28-57_6dbd99_en.pdf)
- [Income Tax Department — taxation of dividend and interest](https://www.incometaxindia.gov.in/taxation-of-dividend-and-interest)
- Income Tax Act, 1961, Section 195 (TDS on payments to a non-resident)
- Income Tax Act, 1961, Section 115A (tax on dividends, interest, royalties, fees for a non-resident)
- `rules/nri-dtaa.json` (per-country treaty rates, applied when more beneficial than these domestic defaults)
