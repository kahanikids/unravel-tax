# Senior citizen basics

**Applies to:** Senior Citizen (60+) / Super Senior Citizen (80+) profile
**Last verified:** 2026-07-06, against multiple current FY 2025-26 / AY
2026-27 filing guides and the Income Tax Department's own AY 2026-27
help page (see `source_refs` in the paired JSON).

## What this covers

The tax-specific things that change once a **resident individual**
crosses 60 (senior citizen) or 80 (super senior citizen): the Section
80TTB interest deduction (and why it replaces, not stacks with, the
smaller Section 80TTA everyone else gets), the higher Section 80D health-
insurance and Section 80DDB medical-treatment limits, and the Section
194P filing exemption for the oldest, simplest-income filers. All of
these — like almost every senior-citizen benefit in the Act — are
**old-regime-only or old-regime-relevant**; the new regime does not
change based on age at all.

## Age thresholds, and the resident-only catch

- **Senior citizen:** a **resident** individual who is 60 years or older
  at any time during the financial year.
- **Super senior citizen:** a **resident** individual who is 80 years or
  older at any time during the financial year.
- **Residency is a hard requirement, not a formality.** A Non-Resident
  Indian (NRI) does not get senior-citizen tax treatment no matter their
  age. That means an NRI does not get the higher old-regime basic
  exemption slabs (₹3,00,000 / ₹5,00,000 instead of ₹2,50,000 — see
  `regime-choice.md` for the full slab tables), does not get the Section
  87A rebate, and — as covered below — does not get Section 80TTB. An NRI
  aged 60+ uses the same ₹2,50,000 old-regime basic exemption as anyone
  else, non-senior included.

## Section 80TTB — interest deduction (replaces 80TTA once you're a senior)

- **Limit:** up to ₹50,000 a year, or actual interest income if lower.
- **Covers:** interest on savings accounts, fixed deposits, and recurring
  deposits with banks, co-operative banks, and post offices.
- **Old regime only.** Not available if you file under the new regime.
- **Resident senior citizens only** — see the residency point above.
- **It replaces Section 80TTA, it does not add to it.** Section 80TTA
  gives everyone under 60 a smaller deduction — up to ₹10,000, and
  savings-account interest only (no FDs or RDs). The moment you qualify
  as a senior citizen in a financial year, you claim under 80TTB instead
  of 80TTA for that year, not both. 80TTB's ₹50,000 ceiling is both wider
  (covers FD/RD interest too) and larger than 80TTA's ₹10,000.

## Section 80D — health insurance (senior citizen limit)

The ₹50,000 health-insurance premium limit that applies when a senior
citizen is covered is already the figure recorded in
`deduction-limits.json` (`section_80d.self_family_senior_citizen_inr`).
This file doesn't repeat or re-derive that number — it just confirms the
senior-citizen trigger is age 60+, and that, like everything else here,
it's old-regime only.

## Section 80DDB — medical treatment of specified diseases

A separate deduction from 80D: it covers actual expenditure on medical
treatment of specified critical illnesses (Rule 11DD lists conditions
including cancer, chronic renal failure, specified neurological diseases
such as Parkinson's and motor neuron disease, and AIDS), reduced by any
amount reimbursed by insurance or an employer.

- **Non-senior citizen:** up to ₹40,000.
- **Senior citizen (60+, including super seniors):** up to ₹1,00,000.
- The higher limit is based on the **patient's** age (self, spouse,
  children, parents, or siblings depended upon), not the taxpayer's own
  age — if the person being treated is 60+, the ₹1,00,000 limit applies
  even if the taxpayer claiming the deduction is younger.
- Requires a prescribed specialist's certificate.
- Old regime only, same as the rest of this file.

## Section 194P — some 75+ filers don't need to file at all

A senior citizen who is **75 or older**, is a **resident**, and whose
**only** income is pension plus interest from the *same* bank account
that pension is paid into, can submit a declaration to that (specified)
bank. The bank then computes total tax after Chapter VI-A deductions and
the Section 87A rebate, and deducts it as TDS. Once that's done, Section
194P exempts this person from filing a return under Section 139
entirely.

- Breaks down completely if there's any other income source (rent,
  capital gains, dividends from outside that account, business income,
  and so on) — then a normal return is required.
- This is a filing-mechanics exemption, not a rate or deduction change —
  it doesn't reduce anyone's tax, it just removes the paperwork for a
  narrow group of the oldest filers.

## What this tool does not repeat here

- **The full old-regime slab tables** (including the higher ₹3,00,000 /
  ₹5,00,000 senior/super-senior basic exemption) live in
  `regime-choice.md` — this file only flags the resident-only condition
  on them.
- **Advance-tax exemption for a senior citizen with no business income**,
  and how regime-switching interacts with it, is covered in
  `senior-citizen-advance-tax-and-regime.md` — see that file rather than
  this one.

## What this tool does with this

- The orientation flow's age question drives both the correct old-regime
  slab set (`regime-choice.md`) and whether 80TTB or 80TTA applies: once
  you mark yourself 60+ and resident, the tool switches your interest-
  deduction cap from ₹10,000 (80TTA, savings-account interest only) to
  ₹50,000 (80TTB, savings/FD/RD interest), and stops offering both at
  once.
- If you mark yourself as an NRI, the tool does not apply any senior- or
  super-senior treatment even if your age is 60+ or 80+ — same
  ₹2,50,000 basic exemption and no 80TTB, no 87A rebate.
- The 80D widget already reads its ₹25,000/₹50,000 split from
  `deduction-limits.json`; this file adds no new number there.
- For 80DDB, the tool asks for the age of the person actually being
  treated (not just the taxpayer's own profile age) before choosing the
  ₹40,000 or ₹1,00,000 cap, and nets off any insurance/employer
  reimbursement you enter before applying the cap.
- For Section 194P, the tool does not attempt to auto-detect eligibility
  — it's a note in this file and in the orientation copy, since acting on
  it (not filing) is a decision the tool doesn't make on a filer's
  behalf.

## Sources

- [ClearTax — Section 80TTB deduction for senior citizens](https://cleartax.in/s/section-80ttb)
- [Tax Garden — Section 80TTA and 80TTB: ₹10,000 vs ₹50,000 (AY 2026-27)](https://taxgarden.in/blog/section-80tta-80ttb-savings-interest-deduction-ay-2026-27)
- [ClearTax — Section 80TTA vs 80TTB, key differences and how to claim](https://cleartax.in/s/80tta-vs-80ttb)
- [Shriram Life — can senior citizens claim both 80TTA and 80TTB](https://www.shriramlife.com/blog/advice/can-senior-citizens-claim-both-80tta-and-80ttb)
- [Income Tax Department — Senior Citizens and Super Senior Citizens, AY 2026-27](https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-2)
- [ClearTax — income tax slab for senior citizens, FY 2025-26](https://cleartax.in/s/income-tax-slab-for-senior-citizen)
- [S Lohia & Associates — income tax exemptions/deductions/reliefs for NRIs](https://www.slohia.com/income-tax-deductions-exemptions-reliefs-in-income-tax-act-nris-pios-ocis-expatriates/)
- [Tax2win — Section 80DDB deduction, limit, and diseases covered](https://tax2win.in/guide/section-80ddb)
- [PNB MetLife — claim 80DDB deduction for medical expenses, FY 2025-26](https://www.pnbmetlife.com/articles/taxation/section-80ddb-deduction.html)
- [Tax2win — Sections 80DD, 80DDB, and 80U deductions, FY 2025-26 limits](https://tax2win.in/guide/deductions-under-section-80dd-80ddb-80u)
- [Tax2win — Section 194P of the Income Tax Act](https://tax2win.in/guide/section-194p-of-income-tax-act)
- [ClearTax — Section 194P, exemption from ITR filing for senior citizens](https://cleartax.in/s/itr-filing-for-senior-citizen)
- [DisyTax — Section 194P, TDS relief for senior citizens aged 75 and above](https://disytax.com/section-194p-tds-senior-citizens/)
