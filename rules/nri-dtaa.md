# NRI — DTAA relief, mutual fund capital gains, and NRO withholding

**Applies to:** NRI profile  
**Last verified:** 2026-07-04

## What this covers

How double-taxation treaties between India and your country of residence
change what you owe on **Indian income** — especially the recent ruling
that **mutual fund units are not the same as company shares** for treaty
purposes.

## The short version

- India has DTAAs with 90+ countries. Which one applies depends on where
  you are a **tax resident**, not your passport.
- To claim any treaty benefit you need a **Tax Residency Certificate
  (TRC)** from that country and **Form 10F** filed on the Indian e-filing
  portal. They are not optional extras.
- **Form 67** is different: use it when claiming **foreign tax credit**
  for tax already paid abroad. Do not mix up exemption (TRC + 10F) with
  credit (Form 67).

## Mutual fund gains — the ITAT ruling (Mar 2025)

In *Anushaka Sanjay Shah v. ITO* (ITAT Mumbai), a Singapore tax resident
redeemed Indian mutual funds for ₹1.35 crore of gains. The department
wanted to tax this in India. The tribunal said **no** — mutual fund units
are issued by **trusts**, not companies, so they are **not "shares"**
under the India–Singapore DTAA. The gains fell under the treaty's
**residual clause** (Article 13(5)): taxable only in Singapore.

Singapore does not tax personal capital gains, so her effective tax was
zero — but she still had to **file an ITR in India** to claim the
exemption and recover TDS the AMC had deducted.

The same residual-clause logic has been applied in comparable cases under
the India–UAE DTAA. It does **not** automatically apply to every country.

## Country-by-country (mutual fund redemptions)

| Your tax residence | MF gains taxable in India? | What to expect |
| --- | --- | --- |
| Singapore, UAE, Saudi, Kuwait, Oman, Qatar | Usually **no** (residual clause) | File ITR anyway; claim DTAA exemption; recover TDS |
| Germany, Italy, Malaysia, Nepal, Philippines | Usually **no** (residual clause) | Taxed per your home country's rules |
| USA, UK, Australia, Hong Kong | **Yes**, at Indian rates | May claim foreign tax credit at home |
| Canada | **Yes**, with credit method | Pay in India; credit in Canada |
| Other / not listed | **Check your treaty** | Article numbers differ; get CA help |

**Direct equity shares** are treated differently from mutual fund units
under most DTAAs. Do not assume the MF ruling covers stock sales.

## What you still need to file

Even when gains are exempt in India:

1. **ITR-2** (not ITR-1) — NRIs cannot use Sahaj.
2. Disclose the capital gains in the return.
3. Claim relief under **Section 90** citing the correct DTAA article.
4. Attach TRC + Form 10F.
5. If TDS was deducted at redemption, claim a **refund** through the
   return — the exemption is not automatic.

## Common mistakes

- Redeeming without a valid TRC for that financial year.
- Assuming "I live abroad so I owe nothing" without filing.
- Treating NRO interest as exempt (only **NRE** interest is exempt under
  Section 10(4)(ii); NRO is fully taxable in India).

## NRO interest and dividend withholding rates by treaty

Separately from the mutual fund question above, most DTAAs also cap the
rate India can withhold (and, for dividends, the rate India can
ultimately tax at) on **NRO interest and dividends** — see
`nro_withholding_rates` in the paired JSON. Two different mechanics
apply depending on the income type:

- **NRO interest:** the treaty rate is a **cap on what India can
  charge**, but only actually helps if it's lower than what slab-rate
  taxation would otherwise produce — many NRIs' slab tax on modest
  interest income already comes in under the treaty cap, so the treaty
  makes no practical difference for them. This tool checks the treaty
  rate against what was **withheld** (for a refund/shortfall estimate)
  but doesn't attempt to recompute interest at a precise marginal slab
  rate — see `rules/nri-tds-and-refunds.md`.
- **Dividends:** Section 115A already sets a flat 20% rate for a
  non-resident, and the law is explicit that the taxpayer gets
  **whichever is lower — 20% or the treaty rate** — never the higher
  one. Some treaties' individual/portfolio-investor dividend rate (US
  25%, Canada 25%, Italy 25% for a holding under 10%) is actually
  *above* 20%, in which case the 20% domestic rate wins and the treaty
  gives no benefit at all. This tool applies that lower-of comparison
  directly to your dividend figure.

A `null` rate below means this tool could not corroborate a specific
number for that country from the sources it checked (a genuine gap, not
a zero-rate claim) — the domestic 30%/20% default from
`rules/nri-tds-and-refunds.json` is used instead, and you should confirm
the real treaty rate with a CA if it's material. Every figure here is
sourced from multiple current filing/withholding guides, not the
primary treaty text of each country — treat the whole table as a
starting point, not a substitute for a CA checking your specific
treaty's Article 10/11 wording.
