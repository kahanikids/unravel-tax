# Filing mistakes and penalties

**Applies to:** every profile
**Last verified:** 2026-07-06 — Section 234F late-filing fee fully
verified against a current source; the rest of the trigger table below
is drafted from internal planning documents and flagged item-by-item as
verified or not, rather than treated as a single block.

## What this covers

A list of the mistakes that most often turn a straightforward filing
into a notice, a defective-return flag, or an interest/penalty charge —
and what triggers each one.

## Late filing — Section 234F (verified)

Miss the due date (see `itr-form-selection.md` for which date applies to
you) and two things happen:

- **A late fee**: ₹1,000 if your total income is ₹5,00,000 or less,
  otherwise up to ₹5,000.
- **Loss carry-forward is forfeited.** A capital loss, business loss, or
  other loss you'd otherwise be entitled to carry forward to future years
  can only be carried forward if you file by the original due date under
  Section 139(1). File late and the loss is still computed correctly on
  this year's return, but the right to carry it forward is gone — see
  `capital-gains-equity.md` for how this interacts with a capital loss
  specifically.

## Other risk triggers (drafted, not yet individually re-verified)

These are structured from internal planning documents rather than a
fresh source-by-source check, so treat the mechanism as directionally
right and the consequence as worth confirming with a CA if it applies to
you:

- **Wrong ITR form.** Filing on a form you weren't eligible for risks
  the return being treated as **defective** under Section 139(9), which
  the department will ask you to fix within a given window. See
  `itr-form-selection.md` for the eligibility rules this tool applies.
- **AIS/Form 26AS/Form 16 mismatch.** The department's systems
  cross-check what you report against what was reported about you by
  employers, banks, and other deductors. A mismatch commonly triggers an
  automated notice, even before any human review.
- **Multiple employers, unreconciled TDS.** Each employer withholds tax
  assuming you have no other income from anyone else that year. Two
  employers in the same year, without you separately declaring the
  other's salary via Form 12B, routinely under-withholds tax relative to
  your real combined liability — a shortfall you then owe, sometimes with
  234B/234C interest on top (see `advance-tax.md`).
- **HRA claimed without the landlord's PAN.** Once annual rent crosses
  ₹1,00,000, most current guidance requires the landlord's PAN on the
  HRA claim; without it, the claim risks rejection on scrutiny.
- **Advance-tax shortfall.** Tax after TDS above the ₹10,000 threshold
  without adequate advance-tax payment triggers 234B/234C interest — see
  `advance-tax.md` for the full mechanics.
- **EPF withdrawal before the minimum service period.** Withdrawing
  provident fund before five years of continuous service can make the
  withdrawal taxable and subject to TDS, reversing accumulated-tax-free
  treatment.
- **Deductions claimed without supporting proof.** 80C, 80D, HRA, and
  similar deductions are typically not verified at the point of filing —
  which is exactly why they're a common scrutiny target afterward. Keep
  the receipts.
- **Underreporting vs. misreporting (Section 270A).** Underreporting
  income carries a **50%** penalty on the tax on the underreported
  amount; misreporting (broadly, deliberate misstatement rather than an
  honest omission) carries **200%**. The distinction turns on intent and
  is a facts-and-circumstances call the department and, ultimately, an
  appellate authority make — not something this tool can assess for you.

## What this tool does with all this

The tool currently applies the Section 234F late fee and carry-forward
forfeiture directly, using the thresholds in the paired JSON. The rest of
the risk-trigger table above is used to raise checklist-style warnings —
missing landlord PAN, multiple employers, and so on — rather than to
compute a penalty figure, since most of these consequences depend on
facts (intent, department discretion, timing) this tool can't observe
from your documents alone.

## Sources

- [ClearTax — late income tax return filing, Section 234F](https://cleartax.in/s/late-tax-return)
- Income Tax Act, 1961, Sections 139(1), 139(9), 234F, 270A (statutory text; the specific consequences above beyond 234F still need their own dedicated source check — see verification note)
