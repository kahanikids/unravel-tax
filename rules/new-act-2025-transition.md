# New Income Tax Act, 2025 — transition rule

**Applies to:** every profile, every rules file that mentions a section
number, form name, or "old Act vs new Act" distinction, for FY 2025-26
(AY 2026-27)
**Last verified:** 2026-07-06, against the Income Tax Department's own
1-April-2026 press release and the Act's official text (see Sources).

## What this covers

India has replaced the Income-tax Act, 1961 with a new **Income-tax Act,
2025**. The path there was not a single Bill: an original Income Tax Bill,
2025 was introduced, then withdrawn, and a revised Income Tax (No. 2)
Bill, 2025 was passed by Parliament on 12 August 2025 and received
Presidential assent on 21 August 2025, becoming the Income-tax Act, 2025.
The corresponding Income-tax Rules, 2026 were notified on 20 March 2026,
and the Act itself **came into force on 1 April 2026**, per the Income
Tax Department's own press release of that date. The new Act also
replaces the old "Previous Year / Assessment Year" pair with a single
**Tax Year**, starting with Tax Year 2026-27.

**This tool files for FY 2025-26 (AY 2026-27) — a return filed mid-2026
for income earned before 1 April 2026 — which is still governed
entirely by the old Income-tax Act, 1961.** The new Act only governs
income earned in FY 2026-27 (Tax Year 2026-27) onward. Nothing in this
tool's actual tax calculations for this filing season uses the new Act's
provisions or numbering.

## The transition trap: two different clocks

During the transition, two things can be true about the same document at
the same time, and they run on **different clocks**:

- **The tax treatment of income follows the year the income was earned**
  (the old, income-year clock). FY 2025-26 income is taxed under the
  1961 Act's rules and section numbers, full stop — it doesn't matter
  whether you file in June 2026 or, after a delay, in 2027.
- **Some administrative mechanics — which form, which form number, which
  portal template — follow today's calendar date** (the filing-date
  clock), regardless of which year's income the paperwork is about.

The concrete example already in use elsewhere in this repo: **Form
15CA/15CB, the NRI repatriation declaration and CA certificate, were
renamed Form 145/Form 146 with effect from 1 April 2026** (now under
Sections 393, 395, 397 and 462 of the Income-tax Act, 2025 and Rule 220
of the Income-tax Rules, 2026). If you remit money out of an NRO account
and file the declaration on or after 1 April 2026, you use Form 145/146
— the new numbers — **even if the remittance relates to FY 2025-26
income that is still taxed under the 1961 Act.** The form's name moved
to the new-Act clock on 1 April 2026; the tax treatment of the
underlying income did not move at all. Getting these two clocks
confused — assuming a new form name means new tax rules, or an old tax
year means an old form name — is the single most common mistake to
expect during this transition, and it's worth checking explicitly
whenever a rule in this repo cites both a form name and a tax year.

There is a saving/repeal clause that makes the income-year clock work
the way you'd expect: **Section 536 ("Repeal and savings") of the
Income-tax Act, 2025** repeals the 1961 Act but expressly preserves
everything already done, earned, accrued, or pending under it — orders
passed, assessments made, and proceedings begun before 1 April 2026
continue to be governed by the 1961 Act through to their conclusion.
Section 6 of the General Clauses Act, 1897 fills in anything Section 536
doesn't explicitly cover. This is the legal basis for "FY 2025-26 income
stays on 1961 Act rules even though you file after the new Act is in
force."

## On section-number mappings specifically

Several files in this repo (`advance-tax.md`, `insurance.json`,
`loan-treatment.json`) note which new-Act section number a familiar old
section (like 80C or 234B) becomes from FY 2026-27 onward. Those mappings
come from secondary sources — CA blogs, tax-filing sites, aggregators —
and **secondary sources sometimes disagree with each other**, most likely
because the section numbers moved between the original 2025 Bill draft,
the withdrawn Bill, the revised Bill, and the Act as finally passed.
Where a file in this repo cites a specific new-Act section number, treat
it as a well-corroborated best effort, not a certainty — and check the
Income Tax Department's own **"Utility to check provisions of
Income-tax Act, 1961 vis-a-vis Income-tax Act, 2025"** if the exact
number matters to you. That utility, published on incometaxindia.gov.in,
is the authoritative side-by-side comparison and supersedes any blog's
mapping table.

None of this section-renumbering affects FY 2025-26 filing itself — the
old numbers govern this year's return regardless of what they're renamed
to later.

## What this tool does with this

This tool computes FY 2025-26 (AY 2026-27) returns using the Income-tax
Act, 1961's provisions and section numbers throughout, since that's what
actually governs the income this filing season covers. Where a rule file
also mentions the new Act's renumbering or a renamed form (for CA
reference or forward-looking context), it links back to this file for
the general transition-clock caution rather than repeating it. This file
carries no calculation of its own — it exists so the other files don't
each have to restate the same "two clocks" caveat, and so a filer who
lands here from a cross-reference gets the full picture, not just the
one detail the referring file needed.

## Sources

- [Income Tax Department — Press Release: Income-tax Act, 2025 comes into force from 1st April, 2026](https://www.incometaxindia.gov.in/documents/d/guest/press-release-income-tax-act-2025-comes-into-force-from-01-april-2026-pdf)
- [Akashvani/News on Air — Income Tax Act 2025 gets President's assent; effective from 1st April 2026](https://newsonair.gov.in/income-tax-act-2025-gets-presidents-assent-will-be-effective-from-1st-april-2026/)
- [EY India — Presidential Assent Granted to Revised Income Tax (No. 2) Bill 2025](https://www.ey.com/en_in/technical/alerts-hub/2025/08/presidential-assent-granted-to-revised-income-tax-no2-bill-2025)
- [TaxGuru — Income-Tax Act, 2025 Receives President's Assent; To Apply From April 1, 2026](https://taxguru.in/income-tax/income-tax-act-2025-receives-presidents-assent-apply-april-1-2026.html)
- [Income Tax Department — Objective and scope of the New Act](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/objective-and-scope-new-act)
- [Income Tax Department — Utility to check provisions of Income-tax Act, 1961 vis-a-vis Income-tax Act, 2025](https://www.incometaxindia.gov.in/utility-to-check-provisions-of-income-tax-act-1961-vis-a-vis-income-tax-act-2025)
- [Income Tax Department — official 1961 Act vs 2025 Act page](https://incometaxindia.gov.in/pages/acts/income-tax-act-2025.aspx)
- [TaxGuru — What Happens to Old Tax Laws Under Income Tax Act, 2025? Section 536 Explained](https://taxguru.in/income-tax/happens-old-tax-laws-income-tax-act-2025-section-536-explained.html)
- [eztax.in — Section 536: Repeal and savings, Income Tax Act 2025](https://eztax.in/income-tax-act-2025/section-536)
- [ClearTax — Form 145 Income Tax 2025: Purpose, Applicability and Form 15CA Substitution](https://cleartax.in/s/form-145-income-tax)
- [KMG & Co LLP — Form 145 & Form 146 Replace Forms 15CA and 15CB from April 2026](https://kmgcollp.com/form-145-form-146-replace-forms-15ca-15cb/)
- [Income Tax Department — Form 145](https://www.incometax.gov.in/iec/foportal/newformpage/forms/form145-UM)

The Section 536 saving-clause mechanics and the exact Form 145/146
governing sections (393, 395, 397, 462) are corroborated across multiple
independent CA/tax-portal sources but are not, at time of writing, cross-
checked word-for-word against the Act's own numbered text in this repo —
if a specific proceeding's transition status matters, verify the precise
sub-clause with a CA or the Act's official text directly.
