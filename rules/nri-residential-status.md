# Residential status (Section 6 day-count test)

**Applies to:** every profile — this decides whether you file as a
**resident**, **NRI**, or **RNOR**, which in turn decides whether the
NRI and foreign-investment rules elsewhere in this tool even apply to
you.
**Last verified:** 2026-07-06, against the Income Tax Department's own
Non-Resident FAQ page and current FY 2025-26 filing guides (see
`source_refs` in the paired JSON).

## What this covers

Section 6 of the Income Tax Act, 1961 decides your **residential
status** for a financial year using a pure day-count test — how many
days you physically were in India, nothing to do with your passport,
citizenship, or where your money sits. Every other NRI rule in this
tool (`nri-nre-nro.md`, `nri-dtaa.md`, `nri-repatriation.md`,
`nri-tds-and-refunds.md`) and the foreign-asset disclosure rule
(`foreign-investments.md`) depend on getting this right first.

There are three possible outcomes: **Resident and Ordinarily Resident
(ROR)**, **Resident but Not Ordinarily Resident (RNOR)**, and
**Non-Resident (NRI)**. Determining status is a two-step process — first
decide resident vs non-resident, then, only if resident, decide
ROR vs RNOR.

## Step 1 — Resident or Non-Resident

You are a **resident** for the year if you meet **either** of these two
conditions:

1. You were in India for **182 days or more** during the year, OR
2. You were in India for **60 days or more** during the year **and**
   **365 days or more** in total across the **4 years immediately
   before** it.

If you meet neither, you are a **Non-Resident (NRI)** for the year.

Both the day of arrival and the day of departure count as days spent in
India, and the days don't need to be continuous. Time spent in India's
territorial waters (12 nautical miles from the coast) also counts.

### The 60-day condition is relaxed for some people

The second condition above (60 days + 365 days) does **not** apply, and
is replaced by the **182-day test alone**, for:

- **An Indian citizen leaving India for employment abroad**, or as a
  **crew member of an Indian ship**, during the year.
- **An Indian citizen or Person of Indian Origin (PIO) living abroad who
  comes to India on a visit**, with one exception below.

A **Person of Indian Origin (PIO)** is someone who, or whose parents or
any grandparent, was born in undivided India.

### The relaxation is narrower for high-income visiting citizens/PIOs

If a visiting Indian citizen or PIO has **total income (excluding
foreign-source income) of more than ₹15 lakh** in the year, the 60-day
figure in the relaxed test is **not fully removed** — it is **replaced
with 120 days** (instead of 60), still combined with the 365-days-in-4-
years condition. So such a person becomes resident if present **182 days
or more**, OR **120 days or more** in the year plus **365 days or more**
across the preceding 4 years.

"Income from foreign sources" here means income earned outside India,
other than from a business controlled from India or a profession set up
in India — see `nri-dtaa.md` and `foreign-investments.md` for how
foreign income is otherwise treated.

## The "deemed resident" rule for high-income citizens taxed nowhere (Section 6(1A))

Introduced by the Finance Act, 2020 and still in force for FY 2025-26,
Section 6(1A) targets Indian citizens who structure their affairs to
avoid tax residency anywhere. It applies regardless of days spent in
India:

- You are an **Indian citizen**,
- Your **total income other than foreign-source income exceeds ₹15
  lakh** in the year, **and**
- You are **not liable to tax in any other country or territory** by
  reason of domicile, residence, or any similar criterion.

If all three are true, you are **deemed a resident of India** — the
day-count test is skipped entirely. Someone caught by this rule is
automatically treated as **RNOR** (see below), not ROR, so their
non-Indian income still isn't taxed in India.

## Step 2 — If resident, ROR or RNOR?

Only individuals and HUFs can be RNOR; every other resident is
automatically ROR. A resident individual is **RNOR** (rather than the
default ROR) if **either** of these is true:

1. They were a **non-resident in India in at least 9 of the preceding
   10 years**, OR
2. They were present in India for **729 days or less** during the
   **preceding 7 years**.

If neither applies — i.e. the person was resident in at least 2 of the
preceding 10 years, **and** present for 730 days or more in the
preceding 7 years — they are **ROR**.

Two other situations also land someone in RNOR automatically:

- **Deemed residents** under Section 6(1A) above are always RNOR, never
  ROR, by the section's own terms.
- A visiting Indian citizen/PIO with income above ₹15 lakh who stays
  **120 days or more but less than 182 days** meets the resident test
  under the modified 120-day rule above but is treated as RNOR rather
  than ROR.

## Why the ROR/RNOR/NRI distinction matters

- **ROR is taxed on global income** — Indian and foreign income both.
  This is who `foreign-investments.md` is written for: an ROR with any
  foreign asset must disclose it in Schedule FA and pay Indian tax on
  foreign income, subject to foreign tax credit.
- **RNOR and NRI are taxed only on Indian income** — income received,
  accrued, or arising in India, plus income from a business controlled
  from India. Genuinely foreign income (foreign salary, foreign rental
  income, foreign bank interest not linked to India) generally escapes
  Indian tax for both RNOR and NRI. This is why returning NRIs value the
  RNOR window — it delays full global-income taxation for a few years
  after they come back.
- **Form availability.** ITR-1 and ITR-4 are only for **residents**, and
  ITR-1 additionally excludes RNOR by name. An NRI or RNOR must use
  ITR-2 or ITR-3 (or ITR-2 if there's no business income) — see
  `itr-form-selection.md`.

## What this tool does with this

This tool asks for your day-count in the current year and, where the
9-of-10-years or 729-of-7-years tests are relevant, your residential
status history for prior years, and applies the two-step test above to
compute ROR / RNOR / NRI. It flags the ₹15 lakh visiting-citizen/PIO
120-day variant and the Section 6(1A) deemed-resident rule as
conditions to confirm rather than silently assuming — both turn on
facts (foreign tax liability, exact income excluding foreign sources)
that a document upload can't fully verify. The computed status then
drives: which ITR form is offered (`itr-form-selection.md`), whether the
foreign-asset/Schedule FA questions are asked at all (`foreign-
investments.md`), and whether the NRI-specific rules (NRE/NRO treatment,
DTAA relief, TDS refunds, repatriation) apply.

Because residential status is genuinely fact-dependent — exact travel
dates, employment-departure timing, prior years' status, and foreign tax
liability all matter — anyone near a day-count boundary (within a week
or two of 182, 120, or 60 days, or close to the 365/730-day cumulative
lines) should have a CA confirm the final status before filing, since
getting this wrong changes which income is taxable and which ITR form is
valid.

## Sources

- [Income Tax Department — Non-Resident FAQs (official, covers Section 6 of both the 1961 Act and the Income Tax Act, 2025)](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/non%20resident%20-faq)
- [ClearTax — Residential Status Under Section 6 of Income Tax Act](https://cleartax.in/s/residential-status)
- [TaxGuru — Residential Status under Income-tax Act, 2025 – An Overview of Section 6](https://taxguru.in/income-tax/residential-status-income-tax-act-2025-overview-section-6.html)
