# Design proposals: HUF partition/clubbing, NRI repatriation, Schedule FA

**Status:** After review, section 1 (HUF) and section 2 (NRI repatriation)
were approved and implemented at the scope proposed below. Section 3
(Schedule FA) had its Phase 1 (foreign bank/brokerage accounts) approved
and implemented; Phases 2-3 (RSU/ESPP, foreign property, trusts) and HUF
partition tracking remain out of scope by design, not oversight - see
each section's "Build note". Each section still ends with the open
questions raised during design, kept for the record even where a
decision has since been made.

**Why these three separately:** all three would touch either genuinely
unsettled family/property law (HUF), a compliance system outside the tax
return itself (NRI repatriation), or a data model this tool doesn't collect
today (Schedule FA). Getting any of them wrong is worse than leaving the
existing "bring this to a CA" caveat in place, so each one gets a real
design pass before code.

---

## 1. HUF: coparcener/member model, Section 64(2) clubbing, partition tracking

### What exists today

`rules/huf-basics.json` (verified) covers the entity-level rules: separate
PAN, no 87A rebate, no standard deduction, same slab rates as an individual.
`rules/huf-clubbing.json` (pending verification) has a four-field stub for
Section 64(2): a member's asset transferred into the HUF without adequate
consideration has its income clubbed back to the transferring member, not
taxed in the HUF's hands. The webapp only orients the user, builds the
checklist, and shows a scope caveat — no coparcener data, no clubbing
calculation, no partition tracking.

### Why this is the hardest of the three

HUF law is genuinely unsettled in three ways a plain calculation tool
can't paper over:

1. **Coparcener status has changed over time and by state.** The Hindu
   Succession (Amendment) Act, 2005 made daughters coparceners by birth,
   but retrospective application to family arrangements predating 2005 has
   been litigated repeatedly (*Vineeta Sharma v. Rakesh Sharma*, 2020,
   settled the point for succession, but partition-specific edge cases
   still reach courts). A tool that gets a coparcener's share wrong isn't
   making a rounding error — it's misstating who owns what.
2. **Partition has two distinct income-tax meanings that are easy to
   conflate**: a "total partition" recognized under Section 171 dissolves
   the HUF for tax purposes and requires an Assessing Officer's order, not
   just a family agreement; a "partial partition" (partition of some but
   not all property, or among some but not all members) has been
   **disallowed for tax purposes since 1978** (Section 171(9)) — a family
   can still do it privately, but the HUF continues to be assessed as if
   it hadn't happened. A tool that shows a partial-partition calculation
   as if it changes tax liability would be teaching a wrong rule.
3. **Section 64(2) needs a transfer ledger, not a snapshot.** The clubbing
   follows the transferred *asset*, indefinitely, across years — this
   asset's income is clubbed to that member every year the HUF holds it,
   not just the year of transfer. A single-year tool that doesn't carry
   state between filings can't track this correctly without asking the
   user to re-declare every prior transfer every year, which is exactly
   the kind of repeated-manual-entry the rest of this tool avoids.

### Proposed data model (draft, not final)

```ts
type HufMember = {
  id: string;
  name: string;
  isCoparcener: boolean;     // by birth, or by the 2005 amendment for a daughter
  relationshipToKarta: string;
};

type HufAssetTransfer = {
  id: string;
  transferringMemberId: string;
  assetDescription: string;
  transferDate: string;       // ISO
  adequateConsideration: boolean; // false = triggers 64(2)
  annualIncomeFromAsset: number;  // this year's income from the transferred asset
};
```

`adequateConsideration` is the crux: this tool cannot determine whether a
family loan or below-market sale counts as "adequate" — that is a facts-
and-circumstances judgment call the Act deliberately leaves to
interpretation, and even a CA will often disagree with another CA on a
borderline transfer. The best a tool can honestly do is ask the yes/no
question and club accordingly, the same way it already asks the single-
parent profile whether a minor's income is genuinely the minor's own work.

**Partition:** proposed to be explicitly **out of scope for calculation**,
even in a future build. A tool cannot verify that a Section 171 order was
actually obtained, and modelling partial partition risks presenting a
disallowed transaction as if it worked. The most honest contribution here
is a sharper checklist item ("get a CA to confirm whether your partition
is a Section 171 total partition or a private (tax-invisible) partial one
before assuming your HUF's tax position has changed") rather than a
calculator.

### Proposed calculation scope (if approved)

- A member/coparcener list (name + coparcener flag), shown for
  completeness on the checklist and CA Summary, not used in any tax math.
- An asset-transfer list (mirroring the loan/insurance-policy list pattern
  already used elsewhere in this codebase) that computes Section 64(2)
  clubbing: for every transfer marked `adequateConsideration: false`, add
  `annualIncomeFromAsset` to the transferring member's own return context
  (informational — this tool doesn't compute the MEMBER's personal return,
  only the HUF's, so this would surface as a note: "₹X of this HUF's
  income is actually taxed on [member]'s personal return, not here" —
  similar to how NRE interest is called out as excluded from the taxable
  total today).
- Partition: checklist/caveat only, as above — no calculation.

### Open questions for the user

1. Is the member/coparcener list worth building at all if it doesn't feed
   any calculation (i.e., is it purely for a CA's reference), or should it
   be dropped in favor of just improving the caveat copy?
2. For Section 64(2), is a same-year "this income belongs on a different
   return" note sufficient, or does the ask assume the tool would actually
   remove that income from the HUF's own CA Summary total (which would
   require confidently classifying every income-producing document by
   which asset it came from — a bigger ingestion change)?
3. Confirm partition should stay calculation-free. If not, which specific
   partition scenario is worth modelling despite the Section 171(9)
   disallowance risk?

### Build note

Approved and implemented exactly at the proposed scope: a member/
coparcener list (`webapp/src/lib/hufClubbing.ts`'s `HufMember`, reference
only, feeds no calculation — question 1 above answered "build it, for the
CA's reference") and an asset-transfer list computing the Section 64(2)
clubbing note (question 2 answered: a same-year "this belongs on the
member's own return" note, without removing the amount from the HUF's own
CA Summary total). Partition stays calculation-free (question 3 confirmed)
— the checklist now has a dedicated, sharper item pointing at the Section
171 vs 171(9) distinction instead. See `HufPanel.tsx`, `rules/huf-clubbing.json`
(now `verified_secondary_source`), and `rules/huf-clubbing.md`.

---

## 2. NRI repatriation tracking

### What exists today

`rules/nri-repatriation.json` (pending verification) has five stub fields:
a USD 1,000,000 annual NRO limit, no NRE cap, a ₹5,00,000 threshold above
which a CA certificate is required, and the old/new form names (15CA/15CB
→ 145/146). Nothing in the webapp reads this file yet.

### Why this one is smaller than it looked at first

Unlike HUF and Schedule FA, repatriation tracking doesn't need a new
per-item data model — it's much closer in shape to the LRS-TCS estimate
already shipped (`lib/foreignInvestments.ts`): the user reports a single
cumulative figure, the tool checks it against fixed thresholds, and shows
the result. The genuine complexity is elsewhere: **this is fundamentally a
banking/FEMA compliance question, not an income-tax return line item** —
Form 15CA/15CB (145/146) are filed with the remitting bank's own e-filing
system, not attached to the ITR, and the USD 1 million limit is a
cumulative *account-level* cap the bank enforces, not something that
appears anywhere on a tax return. A calculator here is a **planning aid**
("are you approaching the limit, will you need a CA certificate"), not a
number that changes any tax figure elsewhere in this tool — which is
exactly why it was scoped out of the "no bugs, not incomplete" build list
this round: it's a fundamentally different kind of correctness (banking
compliance status, not tax liability), and the two shouldn't be blended
without being explicit about which is which.

### Proposed design (draft, not final)

```ts
type NriRepatriationFigures = {
  nroRepatriatedThisYearUsd: number;  // cumulative, entered directly in USD to avoid a rate-conversion argument
};

type NriRepatriationCheck = {
  amount: number;
  annualLimitUsd: number;             // from rules/nri-repatriation.json
  overLimit: boolean;
  ceilingCertificateThresholdInr: number; // from the same rule file
  requiresCaCertificate: boolean;     // compared against the INR-denominated repatriated amount
  formNames: string[];                // ["Form 15CA", "Form 15CB"] pre-transition, ["Form 145", "Form 146"] after
};
```

This would render as a dashboard widget (or a "A few more numbers"
subsection), following the exact shape of the existing LRS-TCS widget:
enter one number, see a Meter against the limit, get a plain-language
status line. It changes no tax figures — it's purely informational, and
the panel should say so explicitly (matching the LRS-TCS panel's existing
"this is a planning estimate" framing).

### Open questions for the user

1. Confirm the scope: a single cumulative "repatriated this year" figure
   and a threshold check, no tax-figure integration. Is that worth
   building, or does "NRI repatriation tracking" mean something closer to
   Form 15CA/15CB *preparation* (which is a materially bigger ask — that
   form needs a CA/CA-certificate number, a remitter/remittee PAN, and
   purpose codes this tool has no reason to hold)?
2. Where should it live — the dashboard (next to the LRS-TCS widget it
   most resembles) or the NRI DTAA/TDS section on the Results page (next to
   the other NRI-specific numbers)?
3. `rules/nri-repatriation.json` is still `pending_current_source` — it
   needs a real verification pass (the ₹5 lakh CA-certificate threshold
   and the 15CA/15CB → 145/146 renaming both need a current-source check)
   before any UI reads it, regardless of which of the above is chosen.

### Build note

Approved and implemented at the proposed scope (question 1 answered: the
simple cumulative-figure-plus-threshold-check, not Form 145/146
preparation). Placed on the Results page next to the other NRI-specific
sections, right after "NRI: DTAA relief & NRO TDS" (question 2). Question
3's verification pass was done via secondary tax-reference sources (see
`rules/nri-repatriation.json`'s updated `verification` block and
`rules/nri-repatriation.md`) — not the RBI/CBDT primary text directly, so
it's marked `verified_secondary_source` rather than fully `verified`. See
`webapp/src/lib/nriRepatriation.ts` and `NriRepatriationPanel.tsx`.

---

## 3. Schedule FA builder

### What exists today

`rules/foreign-investments.json` (verified) already documents Schedule
FA's disclosure rule in detail: every foreign asset held at any point in
the *calendar* year (not financial year) must be disclosed, with no
minimum value, using the SBI TT buying rate for conversion, on ITR-2/
ITR-3 only. The webapp surfaces this as a checklist item and a dashboard
reminder plus the LRS-TCS estimate — it does not build any part of the
actual schedule.

### Why this needs a bigger data model than anything shipped this round

Schedule FA is not one table — it's **several sub-tables (A1 through E in
the current ITR utilities)**, each for a different kind of foreign
interest, with different columns:

- **A1 — Foreign depository accounts**: country, institution name/address,
  account number, opening date, peak balance during the calendar year,
  closing balance, gross interest.
- **A2 — Foreign custodial accounts**: similar, for brokerage-style
  holdings.
- **A3 — Foreign equity/debt interest**: entity name, nature of interest,
  date of acquisition, initial investment cost, closing value, gross
  proceeds from sale, and gross income (dividends/interest) from the
  holding.
- **B — Foreign trusts** and **C — other foreign assets** (e.g. property):
  each with their own column sets.
- Plus **RSU/ESPP** specific handling (grant date, vesting date, FMV at
  vesting) that intersects with Schedule FA *and* the salary-perquisite
  computation *and* a later Schedule CG entry when sold.

Every one of these needs its own per-asset record with several dated
fields, and the **calendar-year vs financial-year mismatch already causes
real confusion** (BUILD_PLAN and this tool's own copy already call this
out as a common trap) — a badly-designed input UI could make that worse,
not better, if it silently used the wrong year window for one sub-table
and not another.

### Proposed scope, phased rather than all-at-once

Building the *entire* schedule (all five sub-tables plus RSU/ESPP) in one
pass is the highest-risk option on this list — more distinct record types
than everything else shipped this round combined, each with its own date-
window rule. A staged approach is proposed instead, ordered by how many
of this tool's actual users the sub-table probably affects:

**Phase 1 — Foreign depository/custodial accounts (A1/A2 combined).**
The most common case for a retail NRI-turned-resident or someone who
worked abroad: a foreign bank or brokerage account. A single record type
covers both sub-tables reasonably (they're structurally similar), and the
peak-balance-during-calendar-year rule can be computed from month-end
balances the user enters, or accepted as a single user-supplied peak
figure if month-end entry is judged too heavy for the "one obvious next
action" principle.

**Phase 2 — Foreign equity/debt interest (A3), including RSU/ESPP.**
Needs acquisition-date, cost, and closing-value fields per holding, and
should reuse the vesting-value-as-perquisite logic already documented in
`rules/foreign-investments.md` rather than inventing a second salary
computation path.

**Phase 3 — Trusts and other assets (B/C).** Lowest priority: rare for
this tool's stated audience (BUILD_PLAN's resident + senior-citizen +
common-profile MVP scope), and the "other assets" category is broad
enough that a generic free-text entry may be more honest than a
false-precision structured form.

None of these three phases would compute Indian tax on the underlying
foreign income as part of Schedule FA itself (that's Schedule FSI/OS, a
separate follow-on calculation already flagged as a gap) — Phase 1
scope is disclosure-only: producing the schedule's rows, not the tax.

### Open questions for the user

1. Confirm the phased approach, and which phase (if any) to design in
   full detail next. Phase 1 alone is still a meaningfully sized feature
   (new record type, new UI list, calendar-year date-window logic) —
   comparable to the insurance-policy panel shipped this round, but with
   an extra "which calendar year does this fall in" wrinkle that panel
   didn't have.
2. Should Schedule FA output live as a workbook sheet (matching the
   existing raw-reference-sheet pattern for uploaded documents), a CA
   Summary row per sub-table, or both?
3. Does "building Schedule FA" in the original ask mean producing the
   disclosure rows (Phase 1-3 above) or also computing the foreign
   dividends/interest/capital-gains tax on those holdings (Schedule
   FSI/Schedule OS/Schedule CG)? These are separate schedules in the real
   ITR and were bundled together in the original roadmap wording
   ("Schedule FA and foreign income computation") — worth confirming
   whether both are wanted or just the disclosure half.

### Build note

Phase 1 approved and implemented at the proposed scope (question 1:
Phase 1 only, foreign bank/brokerage accounts). Output is a workbook
sheet (question 2 answered: sheet, not a CA Summary row - there's no tax
figure to summarize, only disclosure rows), matching the existing
raw-reference-sheet pattern. Question 3 answered narrowly for this
phase: disclosure rows only, no tax computation - the panel says so
explicitly, and the gross-interest total is shown with a note that it
isn't added to any tax figure automatically. Amounts are entered already
converted to rupees by the user rather than converted by this tool,
since there's no live exchange-rate source available (same reasoning as
the NRI repatriation check above). Phases 2 (RSU/ESPP, foreign
equity/debt) and 3 (trusts, other assets) remain undesigned. See
`webapp/src/lib/scheduleFa.ts`, `ScheduleFaPanel.tsx`, and the
`buildScheduleFaSheet` workbook export.
