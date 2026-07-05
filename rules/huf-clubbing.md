# HUF clubbing (Section 64(2))

**Applies to:** HUF profile
**Last verified:** 2026-07-05 (secondary sources — see below)

## What this covers

Families sometimes move a personally-owned asset — a house, shares,
cash — into the HUF's name, often to spread income across a separate
tax entity. Section 64(2) closes that loophole: if a member transfers or
converts their own asset into HUF property **without receiving fair
payment for it (adequate consideration)**, the income that asset earns —
rent, interest, dividends, capital gains, whatever it throws off — stays
taxed in **that member's own return**, not the HUF's, for as long as the
HUF holds it. Even if the HUF sells the asset and reinvests the proceeds
into something else, the income from the replacement asset is still
traced back to the original member. This is different from (and stricter
than) the general spousal-clubbing rule, and it's a commonly missed
point when a family consolidates assets into an HUF.

**"Adequate consideration"** means the HUF actually paid a fair price for
the asset — a genuine sale at market value, not a token amount. A below-
market sale or an outright gift into the HUF triggers clubbing; a real
arm's-length sale doesn't. Whether a specific transfer counts as
"adequate" is a facts-and-circumstances judgment call the law leaves to
interpretation — even two CAs can read the same transfer differently.

## What this tool does with this

If any income or investment in this filing is held through an HUF, you
can list each asset a member transferred into the HUF, when, whether the
HUF paid a fair price for it, and how much income that asset earned this
year. For every transfer where the HUF did **not** pay adequate
consideration, this tool shows a note that income belongs on the
transferring member's own personal return, not the HUF's — it doesn't
remove that amount from the HUF's own CA Summary total, since this tool
computes the HUF's return, not each member's individual return. There's
no rupee threshold or partial exemption here, unlike the single-parent
minor's-income clubbing rule — once a transfer lacks adequate
consideration, the income clubs to the member in full, for as long as
the HUF holds the asset.

The member/coparcener list you can also enter is for the CA's reference
only — it doesn't feed any calculation, since coparcener status can turn
on family-specific and historical facts (see `docs/DESIGN-remaining-gaps.md`)
that this tool can't verify.

Partition of an HUF — total or partial — is not computed here at all.
See `huf-basics.md` and the checklist for why.

## Sources

- [Income Tax Department — Will any clubbing provision apply in case of
  transfer of asset to HUF by its member?](https://www.incometaxindia.gov.in/w/will-any-clubbing-provision-apply-in-case-of-transfer-of-asset-to-hindu-undivided-family-huf-by-its-member-)
- [CallMyCA — Section 64(2) of Income Tax Act: Clubbing of Income for HUFs](https://callmyca.com/blog/section-64-2-of-income-tax-act-clubbing-of-income-for-hufs)

Section 64(2) is a long-standing anti-avoidance provision, not something
a yearly Budget changes — these are secondary tax-reference summaries
corroborating the Income Tax Department's own explainer, not the bare
statute text itself.
