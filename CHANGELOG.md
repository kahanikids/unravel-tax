# Changelog

Dated log of rule changes and notable project milestones. Rule changes
should reference the `rules/` file(s) touched and the source for the
change (Budget, Finance Act, CBDT circular).

## 2026-07-05 (Schedule FA Phase 2 + Schedule FSI/OS: foreign share/RSU capital gains, salary perquisite, Section 90/91 foreign tax credit estimate)

- **Foreign shares and vested RSU/ESPP now get real Indian tax computed on
  a sale**, not just disclosed. New `webapp/src/lib/foreignEquity.ts`
  models a combined holding record (a regular foreign share and a vested
  RSU/ESPP are computed identically once vested - cost basis = FMV at
  vesting, holding period from the vesting date). Foreign shares are
  taxed like **unlisted** Indian shares, not listed equity: a new
  structured `income_taxation.capital_gains_on_foreign_shares` block in
  `rules/foreign-investments.json` (24-month long-term threshold, flat
  12.5% rate, no indexation, effective for transfers on/after 23-Jul-2024)
  replaces what was previously a plain-English note, verified against
  Budget 2024 secondary sources. A long-term sale's tax is its own CA
  Summary row; a short-term sale folds automatically into the regime
  comparison's other-income bucket.
- **RSU/ESPP vesting perquisite (Section 17(2)(vi)) now folds into the
  salary bucket, not other income** - a new `additionalSalaryIncome` input
  on `regimeComparison.ts`, added before the standard deduction on both
  regime sides, correctly reflecting that a perquisite is salary income
  and standard-deduction-eligible, unlike other-sources income. A new
  structured `income_taxation.rsu_espp_vesting` block documents the
  FMV-at-vesting-minus-exercise-price basis and the SBI TT-rate conversion
  convention (source: secondary RSU/ESPP taxation guides).
- **Foreign dividends/interest (from the Schedule FA Phase 1 accounts) now
  fold automatically into slab income too**, replacing the previous
  "add this to your own figures" note - this is what actually computing
  tax on Schedule FSI/OS income means, rather than leaving it as a
  disclosure-only reminder.
- **A Section 90/91 foreign tax credit estimate is computed**, per Rule 128. New `webapp/src/lib/foreignTaxCredit.ts`: exact for long-term
  foreign-share gains (a known flat rate - credit is the lower of foreign
  tax paid and the exact Indian tax); Rule 128's **average-rate method**
  for everything else taxed at slab (dividends, interest, short-term
  gains, RSU perquisite) - this filing's own average tax rate (from the
  existing regime-comparison output) applied to the doubly-taxed income,
  using whichever regime looks cheaper. Shown as one combined CA Summary
  row, explicitly framed as a planning estimate: real Form 67/Schedule
  FSI/TR filing itemizes credit per country, which this tool doesn't
  collect a country field for on income line items. New structured
  `foreign_tax_credit.computation_method`/`rule` fields in
  `rules/foreign-investments.json` (source: incometaxindia.gov.in Rule
  128, ClearTax Form 67 guide).
- The Schedule FA workbook sheet was extended (not duplicated) with an A3
  section for equity/RSU holdings beneath the A1/A2 accounts table, and
  renamed from "Schedule FA (Phase 1)" to plain "Schedule FA" now that it
  covers both phases.
- New components: `ForeignEquityPanel.tsx` ("Foreign shares, RSU & ESPP"),
  gated on the same foreign-assets profile flag as the Phase 1 panel.
- `rules/foreign-investments.json`'s verification block re-checked and
  re-dated (still `verified_secondary_source` - the underlying sources are
  secondary tax-reference summaries, not the bare statute/rule text).
- `docs/DESIGN-remaining-gaps.md`'s Schedule FA section gets a second
  build note recording this round's scope decisions. Phase 3 (foreign
  trusts/other assets) and a precise per-country foreign tax credit remain
  the honestly-flagged gaps.
- Validators extended: foreign-equity long-term/short-term/RSU-cost-basis/
  unsold cases, the flat-rate and average-rate foreign-tax-credit helpers,
  `additionalSalaryIncome` folding identically to entering salary directly,
  panel visibility/salary-gating, and a workbook round-trip for the
  extended Schedule FA sheet.

## 2026-07-05 (implemented the design-doc proposals: HUF clubbing, NRI repatriation check, Schedule FA Phase 1; 80+ super-senior slab; questionnaire review)

- **Old-regime super-senior (80+) slab is now selected**, not just the
  60-79 senior band. `webapp/src/state/types.ts` adds `superSeniorCitizen`
  to `OrientationAnswers`/`ProfileFlags`; `OrientationForm.tsx` asks an
  "are you 80 or older?" follow-up once "60 or older?" is Yes (and clears
  it if that's later changed back to No); `regimeComparison.ts` picks
  `rules/regime-choice.json`'s existing (already-verified)
  `slabs_above_80` instead of always using `slabs_60_to_80`. No rule
  value changed — this closes a gap the rule already documented
  (`comparison_scope_caveat`, `copy.ts`) but the webapp didn't act on.
- **HUF Section 64(2) transfer clubbing is now computed**, per the design
  doc's approved scope. New `webapp/src/lib/hufClubbing.ts`: a
  member/coparcener list (`HufMember`, reference only for the CA, feeds
  no calculation — coparcener status can turn on family-specific facts
  this tool can't verify) and an asset-transfer list
  (`HufAssetTransfer`) that flags, for every transfer without adequate
  consideration, that the asset's income belongs on the transferring
  member's own return, not the HUF's — without removing it from the
  HUF's own CA Summary total (this tool computes the HUF's return, not
  each member's). `rules/huf-clubbing.json` moves from
  `pending_current_source` to `verified_secondary_source` (source: Income
  Tax Department's own clubbing explainer plus a secondary summary — long-
  standing anti-avoidance provision, no yearly Budget change). Partition
  stays calculation-free by design (a private partial partition is
  tax-invisible under Section 171(9), and this tool can't verify an
  Assessing Officer's total-partition order) — the checklist now has a
  dedicated item pointing at that distinction instead of a blanket "not
  computed" caveat. New `HufPanel.tsx`.
- **NRI repatriation gets a planning-only check**, per the design doc's
  approved scope. `rules/nri-repatriation.json` moves from
  `pending_current_source` to `verified_secondary_source` (USD 1 million/
  year NRO cap, ₹5 lakh CA-certificate threshold, the Form 15CA/15CB →
  145/146 renaming effective 1 April 2026 — all re-checked against
  secondary tax-reference sources). New `webapp/src/lib/nriRepatriation.ts`
  and `NriRepatriationPanel.tsx` compare a user-entered cumulative USD
  figure against the annual cap and a separate rupee figure against the
  certificate threshold — two figures, not one converted from the other,
  since this tool has no live exchange-rate source. Purely informational:
  it's a banking/FEMA compliance signal, never folded into any tax figure.
- **Schedule FA Phase 1 (foreign bank/brokerage accounts) is now built**,
  per the design doc's approved phased scope. New
  `webapp/src/lib/scheduleFa.ts` and `ScheduleFaPanel.tsx`: a per-account
  record (country, institution, account number, opening date, peak/
  closing balance, gross interest — entered already converted to rupees
  by the user, since this tool doesn't do the SBI TT-rate conversion
  itself) produces the schedule's A1/A2 disclosure rows, output as a new
  workbook sheet (`buildScheduleFaSheet` in `workbookExport.ts`). The
  calendar-year disclosure window (distinct from the financial year) is
  shown explicitly to avoid the exact confusion this tool's own copy
  already calls out elsewhere. Disclosure only — no Indian tax computed
  on the interest shown; RSUs, foreign property, and trusts (Schedule FA
  tables A3/B/C) and the Schedule FSI/OS tax computation remain out of
  scope, per Phases 2-3 in `docs/DESIGN-remaining-gaps.md`.
- **Orientation questionnaire reviewed** for the NRI/HUF/senior-citizen/
  single-parent profile categories: confirmed the existing "single parent
  or guardian" phrasing is already gender-neutral (Section 64(1A)/10(32)
  clubbing has no gender-based distinction — Indian income tax hasn't had
  a separate female tax slab since it was equalised years ago), and no
  gender question was added, since one would have no calculation to
  attach to. Confirmed business income routes to ITR-3/ITR-4 via
  orientation flags but full bookkeeping and audit schedules remain out
  of scope (`WHO_ITS_FOR_EXCLUDES`); ITR-5/6/7 and non-individual
  entities are not supported.
- `docs/DESIGN-remaining-gaps.md` updated with a "Build note" under each
  of the three sections recording what was approved, implemented, and
  left out (and why), rather than leaving the document to imply nothing
  had moved. FEATURE_COVERAGE.md, ROADMAP.md, and the in-app capabilities
  list (`copy.ts`) updated to match.
- Validators extended: the super-senior 80+ slab (regime-comparison and
  orientation-visibility cases), HUF clubbing (member list, clubbed vs
  not-clubbed transfer cases), NRI repatriation (below-threshold/
  certificate-required/cap-breached cases, renamed form names), and
  Schedule FA Phase 1 (account totals, calendar-year derivation, panel
  visibility, and a workbook round-trip for the new sheet).

## 2026-07-04 (remaining gaps: 234C quarter precision, NRI DTAA/TDS, insurance per-policy, workbook carry-forward import; design doc for HUF/repatriation/Schedule FA)

- **Section 234C now dates listed-equity capital gains to the instalment they
  actually arose in**, instead of spreading all income evenly across the
  year. `rules/advance-tax.json` gains `financial_year_start_date` so
  transaction dates can be mapped to instalment windows, and the
  `later_income_caveat` is rewritten to say equity gains are now precise
  while dividends/intraday/debt-MF gains remain a whole-year ceiling (source:
  Income Tax Act, 1961, Section 234C proviso — unchanged provision, no rate
  or threshold change). `allocateCapitalGainsTaxByInstalment` in
  `webapp/src/lib/advanceTax.ts` walks each transaction's date to compute a
  cumulative capital-gains tax figure per instalment; `estimateSection234cInterest`
  now requires `ordinaryTax * fraction + capitalGainsCumulative` instead of
  `assessedTax * fraction`, so an instalment isn't penalised for gains that
  hadn't happened yet.
- **NRI dividend tax and NRO TDS reconciliation are now calculated.**
  `rules/nri-dtaa.json` gains `nro_withholding_rates.countries` — treaty
  interest/dividend withholding rates for 16 countries (Singapore, UAE, US,
  UK, Canada, Australia, Saudi Arabia, Germany, Malaysia, Kuwait, Oman,
  Qatar, Italy, Nepal, Philippines, Hong Kong; source: respective India DTAA
  texts via secondary tax-reference summaries — marked
  `verified_secondary_source`, not primary-text-verified). `rules/nri-tds-and-refunds.json`
  is rewritten from a pending stub to `verified_secondary_source` with the
  30%/20% domestic TDS rates on NRO interest/dividends (Section 195). New
  `webapp/src/lib/nriTax.ts` computes dividend tax at Section 115A's flat
  rate or the treaty rate, whichever is lower, and reconciles TDS actually
  withheld against what was owed on both interest and dividends. Dividends
  are now excluded from the NRI's slab-income total in the regime comparison
  (they're taxed flat, not at slab rates) via a new `excludeDividendsFromSlab`
  input. New `NriDtaaPanel` component surfaces the computation and TDS input
  fields.
- **Insurance payout tax is now computed per policy**, not as a single
  disclosure reminder. `webapp/src/lib/insurance.ts` adds a per-policy model
  (type, issue date, sum assured, premiums, payout) and applies both
  Section 10(10D) tests independently: the sum-assured ratio test
  (10%/20% depending on issue date) and the aggregate-annual-premium cap
  (₹2.5L ULIP / ₹5L traditional), pooling premium across _all_ policies of
  the same type issued on/after that type's cutoff — so one policy's premium
  can push a different policy of the same type over the cap, as the law
  requires. Failing either test makes the payout taxable (slab rate for
  traditional policies, capital-gains rate for ULIPs). No rule value change;
  `rules/insurance.json`'s existing fields are now read by new TypeScript
  types instead of being display-only. New `InsurancePolicyPanel` component
  for adding/removing policies.
- **A previous year's Unravel Tax full workbook can now be imported** from
  the welcome screen, prefilling orientation answers and carry-forward loss
  figures. New `webapp/src/lib/workbookImport.ts` reads the Orientation and
  CA Summary sheets back out of the exported XLSX (only the literal-value
  cells — capital-gains and Totals rows that hold live formulas are left
  alone, since a formula's cached value isn't reliable to read back).
- **Design proposals for the three largest remaining gaps** — HUF
  coparcener/partition modelling, NRI repatriation tracking, and a
  Schedule FA builder — are written up in the new
  `docs/DESIGN-remaining-gaps.md`, each with a data-model sketch, risk
  analysis, and open questions. None of the three are implemented yet;
  per the maintainer's explicit instruction, they're parked for review and
  sign-off before any code is written.
- Validators extended with known-figure cases for all four shipped items:
  234C quarter-precision (3 cases), NRI dividend tax (3 cases), NRO TDS
  reconciliation (2 cases), regime comparison with dividend exclusion,
  insurance policies across all four disqualification/exemption combinations
  (6 cases), and a full workbook import/export round trip using synthetic
  data. FEATURE_COVERAGE.md and ROADMAP.md updated to match.

## 2026-07-04 (four pending features built: 234C, let-out home + 80C principal, LRS rate branches, clubbing exceptions)

- **Section 234C instalment interest is now estimated** (was: 234B only).
  `rules/advance-tax.json` gains a `section_234c` block — the instalment
  calendar (15%/45%/75%/100% by 15 Jun/15 Sep/15 Dec/15 Mar), the 12%/36%
  safe harbours for the first two instalments, the 3/3/3/1-month interest
  periods, the ₹10,000 floor, and a `later_income_caveat` that the UI must
  always show (source: Income Tax Act, 1961, Section 234C — long-standing,
  unchanged provisions). `estimateSection234cInterest` in
  `webapp/src/lib/advanceTax.ts` computes per-instalment shortfall interest
  from what the user paid in each window; whatever part of "tax already paid"
  exceeds the entered instalments is treated as TDS and subtracted from the
  liability first. The advance-tax panel shows the per-instalment breakdown,
  the safe-harbour outcomes, and the whole-year-ceiling caveat next to the
  number every time. `rules/advance-tax.md` rewritten accordingly.
- **Let-out house property and home-loan principal are now modelled**
  (`rules/loan-treatment.json` gains the Section 24(a) 30%
  `net_annual_value_standard_deduction_rate`). The Loans panel takes rent
  received, municipal taxes, and uncapped let-out interest; computes the
  house-property income/loss; caps a loss's set-off at ₹2,00,000 on the
  old-regime side of the regime comparison (rest reported as carry-forward)
  and drops it on the new-regime side; and adds the figure as its own CA
  Summary row. Home-loan principal gets its own field that counts _inside_
  the shared Section 80C ceiling (capped together with the dashboard's 80C
  investments figure, shown on the same progress bar), never on top.
- **LRS TCS now uses the remittance purpose's rate branch**: the dashboard's
  foreign widget gains a purpose selector — 20% investment/gift/other, 2%
  education/medical, and nil when funded by a Section 80E education loan (all
  three already recorded in `rules/foreign-investments.json`; no rule change).
- **Minor's-income clubbing exceptions**: a new field for the portion of the
  minor's income Section 64(1A) never clubs (their own manual work, own
  skill/talent, or an 80U disability, per `excluded_from_clubbing` in
  `rules/single-parent-clubbing.json`), subtracted before the ₹1,500
  per-child exemption. The scope caveat now says the tool can't verify the
  exception applies, rather than that it ignores exceptions entirely.
- Validators extended with known-figure cases for all four:
  234C full-default (₹5,050 on a ₹1,00,000 default), safe-harbour and
  TDS-floor cases; let-out loss-cap/carry-forward/income cases including the
  per-regime feed into the comparison; combined 80C capping; the three LRS
  rate branches; and clubbing with exclusions. FEATURE_COVERAGE.md and
  ROADMAP.md updated to match.

## 2026-07-04 (standardised JSON extraction contract + missing-detail guidance)

- Rewrote the extraction prompt (`prompts/01-extract-statement.md` and its
  in-sync copy `webapp/public/extraction-prompt.txt`, kept byte-identical) so
  the AI reads **whatever** statement it's given (P&L, broker/AMC transactions,
  PMS annual report, bank/dividend/interest/insurance/loan statement, AIS,
  consolidated account statement) and returns **one standardised JSON object**,
  filling the fields it can find and omitting/nulling the rest. We can't map
  every bespoke report format, so we standardise our own side. The prompt still
  explains that per-transaction detail matters because the tool classifies
  STCG/LTCG and computes gains deterministically from the dates — the AI must
  not self-classify or self-calculate. JSON shape: `documentType`,
  `capitalGainsTransactions[]` (per-trade `scripName`/dates/`units`/values/
  prices/optional `instrumentType`), `annualFigures` (`dividendIncome`,
  `interestIncome`, `tdsDeducted`, `deductibleCharges`),
  `netRealisedCapitalGainNoDetail`, `confidence`, `notes`. The AI must never
  invent transaction rows (a net/aggregate gain goes in
  `netRealisedCapitalGainNoDetail`), and holdings-only lists are noted in
  `notes`, never placed in the transactions array.
- Deterministic JSON ingestion after the LLM Options step: `parseExtractionJson` in
  `ingest/parsers.ts` now runs first when a paste starts with `{`. It
  `JSON.parse`s defensively (ignores unknown fields, treats missing/null as
  absent, tolerates ₹/commas in numeric strings) and maps
  `capitalGainsTransactions` onto the existing canonical `RawTransactionRow`
  shape, running them through the same `normalizeRowsSoft`/`deriveComputedFields`
  path as every other format — so classification and the row-shape are
  identical. `annualFigures` + `netRealisedCapitalGainNoDetail` surface as
  `IngestResult.summaryFigures` (guidance only, never calculated) with a
  `netGainOnly` flag, plus `documentType`/`confidence`/`notes` (all optional,
  backward-compatible additions to the type).
- The **markdown-table / TSV path is preserved as a graceful fallback** for a
  paste that isn't JSON, so older prompts and hand-pasted tables still work.
  CSV/Excel/HTML/structured-text native parsing is untouched.
- Invalid JSON no longer dead-ends: it returns a plain-language `parse_error`
  telling the user to paste the whole JSON block (one obvious next action).
- `UploadStep.tsx` guidance for a readable-but-non-transaction paste (summary/
  annual-total, net-gain-only, or holdings-only): lists the recognised annual
  figures for the user to **type into** the results screen's "A few more
  numbers" (not auto-populated, per the declined full-ingest option), loudly
  flags a net-gain-only figure as unusable for ST/LT split and not fed into any
  calculation, and shows the AI's `documentType`/`notes` (e.g. holdings-only
  warning). Kept local to the upload flow (deliberate /ponytail shortcut — not
  wired into global reconciliation, since the figures are user-typed and the
  net-gain gap is document-local, not a profile-driven checklist item).
- Added synthetic JSON fixture assertions to `scripts/validate-ingest.ts`
  (JSON with transactions maps + classifies; summary-only JSON recognises
  figures + flags net-gain-only; invalid JSON errors; markdown-table fallback
  still parses). No `rules/*.json` change (no rate/threshold touched).

## 2026-07-03 (insurance + foreign investments on the dashboard)

- Surfaced both topics on the **tax dashboard** as two new widgets, reusing
  the dependency-free `Meter` primitive (no new libraries):
  - **Insurance payout still tax-free? (10(10D))** — a premium input metered
    against the ULIP ₹2.5 lakh exemption line, with status copy covering the
    ₹5 lakh traditional line. Both caps read from `rules/insurance.json`
    (`payouts_section_10_10d.ulip` / `.traditional_non_ulip`
    `aggregate_annual_premium_exemption_cap_inr`), plus the 194DA rate/threshold.
    It runs only the threshold check the rule tells the user to run; it does
    **not** compute the taxable payout amount (needs issue date + sum-assured
    history the tool doesn't hold), and says so.
  - **Foreign assets & LRS remittances** — a Schedule FA disclosure reminder
    (no minimum value, ITR-2/ITR-3 only, ₹10 lakh Black Money Act penalty, all
    read from `rules/foreign-investments.json`) plus an LRS remittance input
    metered against the ₹10 lakh Section 206C(1G) TCS threshold, showing the
    estimated 20% TCS as a recoverable prepaid credit.
- Both widgets only render for someone they apply to (the `hasInsurancePayout`
  / `hasForeignAssets` orientation flags, or once a figure is entered), each
  carries a `RuleSourceLink`, and neither figure is folded into the taxable
  totals (planning figures only, matching the rules' stated intent).
- `rules/insurance.json` and `rules/foreign-investments.json` are now typed
  (`InsuranceRule` / `ForeignInvestmentsRule`) and read via two new pure
  helpers (`computeInsurancePayoutCheck`, `computeForeignRemittanceTcs`) that
  mirror `loanDeductions.ts`. Added `SupplementalFigures.insuranceAnnualPremium`
  and `.foreignRemittanceLrs` (defaulted, so saved sessions still load).
  `tsc --noEmit`, `validate:guided-ui`, `validate:calculations`, and lint pass.

## 2026-07-03 (insurance + foreign investments for residents)

- Added `rules/insurance.json` / `.md`: **Section 10(10D)** payout
  taxability, covering the Finance Act 2021/2023 carve-outs — ULIPs issued
  on/after 1-Feb-2021 with aggregate premium over ₹2.5 lakh (taxed as
  capital gains) and traditional policies issued on/after 1-Apr-2023 with
  aggregate premium over ₹5 lakh (taxed as income from other sources), the
  10%-of-sum-assured rule, always-exempt death benefits, and 194DA TDS.
  Premium deductions (80C/80D) cross-reference `deduction-limits.json`
  rather than restating the rupee caps.
- Added `rules/foreign-investments.json` / `.md` for **Resident and
  Ordinarily Resident** filers: mandatory **Schedule FA** disclosure of all
  foreign assets (RSUs, ESPP, foreign shares/accounts/property) for the
  calendar year with no minimum value and no ITR-1/4; slab-rate foreign
  dividends/interest; foreign shares as unlisted-share gains; foreign tax
  credit via Form 67/Schedule FSI/TR; **Finance Act 2025** LRS TCS change
  (threshold ₹7L → ₹10L from 1-Apr-2025, 20% on investment remittances,
  education-loan remittances exempt); and **Black Money Act** Section 43
  ₹10 lakh penalty with the 1-Oct-2024 ₹20 lakh movable-asset carve-out.
  Both synced to `webapp/src/rules/data/` and registered in the rule
  catalog (generic `RuleDocument` — reference/awareness content, no new
  calculation).
- Wired both into the guided flow the same way as loans: two new
  orientation questions (`insurancePayout`, `foreignAssets` — the latter
  resident-only), profile flags `hasInsurancePayout` / `hasForeignAssets`,
  tailored checklist items (payout + premium history; foreign statements +
  Form 67 proof), and `profileScopeCaveats()` entries stating plainly what
  the tool does _not_ compute (10(10D) taxability, Schedule FA table).
  Foreign assets now force **ITR-2/ITR-3** in `selectItrForm`, raise a
  form-changing risk trigger (Schedule FA / ₹10 lakh penalty) that flips
  the "get a CA to review" recommendation on; an insurance payout raises a
  routine risk trigger. `tsc --noEmit` and `validate:all` pass.

## 2026-07-03 (NRI orientation + DTAA mutual fund map)

- Reworked the **NRI track** in `OrientationForm`: after picking "I live
  outside India", users are asked their **country of tax residence**
  (drives DTAA lookup) and **days physically in India this year**
  (skippable — reported on the return to confirm non-resident status).
  Resident-only questions (HRA, EPF) are hidden; income-source labels are
  NRI-specific (NRO vs NRE called out). New `number` question kind +
  `nriDaysInIndia` field on `OrientationAnswers`.
- Populated `rules/nri-dtaa.json` / `.md` with a country-by-country map
  for **mutual fund capital gains** under DTAAs, including the ITAT Mumbai
  Mar 2025 ruling (_Anushaka Sanjay Shah_) that MF units are not company
  shares and may be exempt in India for Singapore/UAE-style residual-clause
  treaties. Synced to `webapp/src/rules/data/nri-dtaa.json`.
- `profileScopeCaveats()` now surfaces a country-specific MF DTAA heads-up
  when an NRI reports capital gains. Checklist TRC copy is tailored when
  MF exemption may apply.

## 2026-07-03 (regime break-even point)

- Added an old-vs-new regime **break-even** calculation and display: the
  exact amount of old-regime deductions (80C, 80D, 80CCD(1B), HRA, Section
  24(b), etc.) at which the old regime's tax would match the new regime's.
  New `computeRegimeBreakEven()` in `webapp/src/lib/regimeComparison.ts`
  solves it generically off the existing `compareRegimes()` slab engine (a
  monotonic search, no slab rates or offsets restated), so it's correct at
  every income and handles the zero-tax band (up to ~₹12.75L salary) by
  reporting no break-even, since no deduction can beat a zero new-regime
  tax. Surfaced in the Results regime panel and the dashboard regime widget
  as a headline number plus a progress bar of entered deductions vs the
  break-even target. Added a plain-language explanation and a ₹15L worked
  example to `rules/regime-choice.md`, and a `values.break_even`
  explanatory note (no numeric constants) to `rules/regime-choice.json`
  (typed as optional, synced to `webapp/src/rules/data/`). Validation cases
  added in `validate-calculations.ts` for ₹12.75L (no break-even), ₹15L
  (₹5,43,750), ₹20L (₹7,08,333), and ₹25L (₹8,00,000). Note: the widely
  quoted `Gross − 6,75,000 − newTax/0.30` shortcut matches the slab-accurate
  engine at ₹20L/₹25L but overstates the old regime's case at ₹15L
  (₹5,12,500 vs the correct ₹5,43,750), because the crossover there falls in
  the 20% old-regime band, not the 30% band the shortcut assumes; the tool
  uses the accurate slab solve.

## 2026-07-03 (source links next to claims + speculative-income label)

- Risk-trigger copy: the speculative/intraday form-changing flag now reads
  "Speculative/intraday trading income is considered Business Income"
  (`webapp/src/lib/riskTriggers.ts`, plus the matching assertion in
  `webapp/scripts/validate-guided-ui.tsx`). Consequence text unchanged.
- `rules/filing-mistakes-and-penalties.json` / `.md`: added an authoritative
  source URL (ClearTax Section 234F late-filing fee, FY 2025-26) as the first
  `source_refs` entry so the risk-trigger claims have a linkable source.
- `rules/capital-gains-equity.json` / `.md`: added source URLs (ClearTax
  Section 112A LTCG 12.5% and Section 111A STCG 20%, FY 2025-26) as the first
  `source_refs` entries. No rule values changed in either file; `last_verified`
  bumped only to record the source-link check, status kept pending.
- New `webapp/src/components/RuleSourceLink.tsx`: a compact "Source" anchor
  that reads the first URL out of a rule's `source_refs` at runtime (no
  hardcoded URLs) and renders nothing when a rule only cites internal docs.
  Wired next to risk-trigger flags (checklist panel), the Recommended ITR form
  reason (results), capital-gains "why this number?" rows, and the old-vs-new
  regime caveat.

## 2026-07-03 (loan treatment embedded in the workflow)

- New rule file `rules/loan-treatment.json` (paired with
  `rules/loan-treatment.md`), recording how loans affect a FY 2025-26
  (AY 2026-27) return. Covers Section 24(b) home-loan interest
  (self-occupied ₹2,00,000 cap, old regime only; let-out uncapped in both
  regimes with the ₹2,00,000 house-property-loss set-off ceiling and the
  new regime's no-set-off/no-carry-forward rule), home-loan principal
  inside the 80C ceiling (cross-referenced to `deduction-limits.json`,
  not duplicated), the first-time-buyer top-ups 80EE (₹50,000) and 80EEA
  (₹1,50,000) with their closed sanction windows, Section 80E education-
  loan interest (no cap, interest-only, 8 years), Section 80EEB electric-
  vehicle-loan interest (₹1,50,000), the "personal/gold loans deduct only
  by what the money was used for" rule, the special loan-vs-gift clubbing
  point (a genuine documented family loan doesn't trigger Section 64), and
  the new Income Tax Act 2025 section renumbering (use the 1961 numbers for
  this year's filing). Verified against multiple current filing guides
  (ClearTax, TaxGuru, TaxSmooth); `verification.status`
  `verified_secondary_source`, pending an incometax.gov.in cross-check.
  Synced to `webapp/src/rules/data/` and typed as `LoanTreatmentValues` /
  `LoanTreatmentRule`.
- Embedded loans across the guided flow: a new orientation question ("Are
  you repaying any loans this year?") drives a `hasLoans` profile flag,
  which adds a "Loan interest certificate(s)" item to the personal
  checklist. On the results screen, filers with loans get a dedicated
  "Loans (home, education, electric vehicle)" section under "Add more
  numbers to refine": each interest figure is capped at its section limit
  (read from `loan-treatment.json`, never hardcoded, via a new pure
  `computeLoanDeductions` helper) and the capped total folds into the
  old-regime side of the old-vs-new regime comparison, both on the results
  panel and the dashboard, so loans actually move the cheaper-regime call.
  The generic "old regime deductions" field was relabelled to exclude home-
  loan interest to avoid double-counting. Let-out house-property loss
  set-off, the 80C principal, and business-use vehicle interest are left
  to a CA and documented as out of scope in `loan-treatment.md`.

## 2026-07-03 (regime rules completeness + ITR-V history upload)

- `rules/regime-choice.json` / `.md`: confirmed the FY 2025-26 (AY 2026-27)
  model is complete — universal new-regime slabs, old-regime slabs for all
  three age bands (below 60, senior 60-79, super-senior 80+), both standard
  deductions (old ₹50,000 / new ₹75,000), both Section 87A rebates, and the
  new-regime marginal relief above ₹12,00,000 were already present and
  unchanged. Added a `deductions_by_regime` block plus a much richer `.md`:
  a plain-language "which deductions each regime allows/gives up" section
  (80C/80D/80CCD(1B)/HRA and the Section 24(b) ₹2,00,000 home-loan-interest
  limit under the old regime; Section 80CCD(2) employer-NPS under both), and
  a "which should you choose?" guide (new regime if few tracked investments
  or gross salary under ~₹12.75L; old regime with a home loan, HRA, and
  heavy 80C/80D). The enforced rupee ceilings are cross-referenced from
  `deduction-limits.json`, not duplicated. No rule value changed, so no
  hardcoded duplicates needed updating; regime slabs/deductions/rebate are
  read from the JSON in `regimeComparison.ts`, the dashboard regime
  simulator, and the Results regime panel (the old-regime senior 60-79 band
  is applied via the existing `seniorCitizen` flag). Honest limitation kept:
  because orientation only asks a yes/no "senior citizen?", an 80+ filer is
  compared on the 60-79 band, not the more generous super-senior one.
- Dashboard past-filing history now also accepts **ITR-V acknowledgement
  PDFs**, not just ITR JSON. The PDF is read with the existing client-side
  pdf.js text extractor (`ingest/pdfExtract`), then a new tolerant,
  label/regex reader (`parseItrVText` in `lib/pastFilings.ts`) pulls what it
  can — assessment year, ITR form, gross total income, taxes paid, and
  refund/payable, plus regime when the wording is unambiguous. It never
  throws: anything it can't read falls back to the manual form with a clear
  message, and auto-read fields are tagged "read from file". No bespoke PDF
  table parser was added (CLAUDE.md), and no new dependency.

## 2026-07-03 (deduction limits + visual dashboard)

- New rule file `rules/deduction-limits.json` (paired with
  `rules/deduction-limits.md`), recording the FY 2025-26 old-regime
  ceilings for Section 80C (₹1,50,000), Section 80D (₹25,000, or ₹50,000
  when a senior citizen is covered), and Section 80CCD(1B) NPS (₹50,000).
  These are long-standing, well-known limits carried unchanged into
  FY 2025-26; verification status is `verified_secondary_source` pending a
  check against the official instructions on incometax.gov.in. Synced to
  `webapp/src/rules/data/` and typed as `DeductionLimitsRule`.
- Dashboard reworked into a visual, at-a-glance command centre distinct
  from the Results working view: regime-comparison cards, a capital-gains
  donut with a Section 112A tax-free-LTCG harvesting tracker, 80C/80D/NPS
  deduction-progress bars (limits read from the new rule file, never
  hardcoded), an AIS/TDS variance gauge, and an ITR-form badge with a
  FY 2025-26 / AY 2026-27 timeline. No new charting dependencies (CSS
  conic-gradient donuts and inline SVG only).

## 2026-07-03 (repo cleanup)

- Repository hygiene pass for open source readiness. Stopped tracking
  editor/agent and scratch artifacts that `.gitignore` already excludes
  (`.claude/`, `.cursor/plans/`, `**/NOTES.md`, `**/DESIGN_NOTES.md`,
  `WORKING_PLAN.md`, `*.tmp.*`); they stay on disk locally. Deleted the
  unused `assets/` folder (the logo the README shows lives in
  `webapp/public/`).
- Moved the internal specs `BUILD_PLAN.md` and `SYSTEM_SPEC.md` into `docs/`
  and updated links in `README.md`, `CONTRIBUTING.md`, `DISCLAIMER.md`,
  `LICENSE`, and `CLAUDE.md`.
- Added standard tooling: root `.editorconfig` and `.nvmrc` (Node 20),
  root `requirements.txt` (openpyxl for the notebook/template path; the rest
  is standard library), and Prettier + ESLint (flat config) in `webapp/`
  with `lint`/`format`/`format:check` scripts. Lint runs in CI
  (`.github/workflows/validate.yml`); it currently reports only warnings for
  pre-existing unused variables.

## 2026-07-03 (ITR form selection)

- ITR form selection rules recorded and verified: `rules/itr-form-selection.json`
  and `rules/itr-form-selection.md` were stubs; they now carry the full
  AY 2026-27 form applicability (ITR-1/2/3/4 who-can/who-cannot, the ITR-1
  Rs 50 lakh income ceiling, the Section 112A LTCG ≤ Rs 1.25 lakh carve-out,
  agri ≤ Rs 5,000, one-house-property rule, and the complete ITR-1
  disqualifier list). Cross-checked against ClearTax "Which ITR to File in
  FY 2025-26 (AY 2026-27)" and the CBDT ITR-form notifications; source URL
  added to `source_refs`, verification status moved off `pending_current_source`.
  Due dates were left as-is and flagged as a separate pending check.
- Questionnaire honesty fixes (no misrepresentation of the ITR form):
  - `selectItrForm` now applies the Rs 50 lakh ITR-1 ceiling (read from the
    rule file, not hardcoded): a resident with only salary/interest/dividends
    but total income above Rs 50 lakh is routed to ITR-2, not ITR-1. Total
    income is derived from the figures the app actually knows; when unknown it
    stays low and the ceiling never trips (the safe direction).
  - The ITR-1 recommendation note now states the disqualifiers the tool
    can't observe (income above Rs 50 lakh, more than one house property,
    foreign income/assets, unlisted shares, company directorship, carried-
    forward losses) as an explicit "ITR-1 fits if none of these apply"
    caveat, instead of asserting ITR-1 unconditionally.
  - Confirmed already-correct routing left unchanged: intraday = speculative
    business income to ITR-3, NRI/HUF to ITR-2, and the conservative
    capital-gains to ITR-2 (safe even though small 112A LTCG can now use ITR-1).
  - Validation case added (`validate:guided-ui`) covering the ceiling, the
    capital-gains/clubbing/NRI/HUF/intraday routing, the unknown-income safe
    default, and the presence of the ITR-1 disqualifier caveat.

## 2026-07-03 (quality pass)

- Section 87A marginal relief (new regime): added
  `values.new_regime.marginal_relief` to `rules/regime-choice.json` and the
  explanation to `rules/regime-choice.md` (source: Income Tax Department
  Budget 2025 FAQ, already in `source_refs`). The webapp regime comparison
  now caps new-regime tax (before cess) at the income earned above the
  Rs 12,00,000 rebate threshold, removing the false Rs ~60,000 tax cliff
  for incomes just above it. Validation case added.
- Regime comparison fix: the old-regime standard deduction is now clamped
  to salary income, so interest/dividend-only filers no longer had
  Rs 50,000 wrongly knocked off their non-salary income.
- Sample-mode fix: leaving sample data via a welcome-screen card, or adding
  a real document while viewing sample data, now clears the demo data
  instead of letting the next autosave overwrite a real saved filing.
- Ingestion robustness: multi-sheet Excel workbooks are scanned for the
  sheet whose headers match the transaction columns best (new fixture +
  validation case); a malformed CSV line downgrades to a row warning
  instead of rejecting the whole file; accounting-style `(1,234.56)`
  negatives parse; exact canonical headers win over synonym columns like
  ISIN; the row-edit long-term threshold reads from
  `rules/capital-gains-equity.json` instead of a hardcoded 365.
- Full workbook export: duplicate/reserved Excel sheet names are deduped
  with a numeric suffix so the export always opens.
- Journey fixes: filers with no broker documents can skip the documents
  step and reach results (income typed in on the results screen); the
  single-parent orientation question now asks specifically about minor
  children so solo filers without kids don't get clubbing guidance.
- Sale/cost totals and broker cross-check: every gain bucket (intraday,
  STCG, LTCG, debt MF) is now derived explicitly as total sale value
  minus total cost. The CA summary gains rows show that derivation in
  their notes, and two new rows carry the overall Total sale value /
  Total cost of purchase. The full workbook's Detailed Summary asset-
  class table gained Total Sale Value, Total Cost, Gain (=Sale−Cost),
  Broker-reported, and Variance (should be 0) columns per asset class -
  equity intraday/ST/LT and debt MF - with the broker check driven by
  the statement's own "Taxable Gain"/"Realised Gain"/"Net Gain" column
  when present (intraday checks against a separate speculative column
  when the broker reports one). The linked CA Summary sheet gained a
  formula-linked "Totals & check" section. On screen, the same broker
  check runs automatically: per-bucket computed vs broker-reported in
  the full-detail view, with differences counted as reconciliation
  mismatches in the open-issues total. Validation cases added for the
  totals round-trip and the broker check (grouped-header HTML fixture).

## 2026-07-03

- Detailed full workbook export: styled Excel output with per-broker sheets,
  live formulas, and cross-sheet traceability. Added `health_education_cess_rate`
  (0.04) to `rules/capital-gains-equity.json` for workbook tax-estimate seeding.
- Folder session backup and restore (Chromium): when the user picks a local
  folder, the app now writes `unravel-tax-session.json` there on every save
  alongside document copies and exports. A "Restore from a folder" action on
  the welcome screen re-picks that folder and reloads the full filing if
  browser storage was wiped. Deliberately did not persist the folder handle
  in IndexedDB — a "clear browsing data" wipe clears that too; the on-disk
  JSON is the durable backup.
- CMOTS/ABML-style HTML broker exports: HTML ingest now scans the first few
  rows of each table for the real header row (same as Excel), instead of
  assuming row 0. Fixes saved webpages with a decorative group-banner row
  above column names. Duplicate column labels (two "Buy Value" columns) keep
  the first occurrence; subtotal rows with blank scrip names are dropped.
  Added `fixtures/sample-broker-statement-grouped-header.html` to
  `validate-ingest.ts`.
- Ingest UX overhaul (Stage 4 handoff): parsing returns rows plus warnings
  instead of throwing on odd headers or bad cells. PDFs get client-side text
  extraction (pdf.js) before routing to the guided LLM prompt; CSV/Excel/HTML
  failures route to the same prompt instead of dead-ending. Review modal shows
  row-level warnings, buy/sell price columns, and a manual column mapper when
  required headers are missing. Expanded date parsing (DD/MM/YYYY, DD-MM-YYYY,
  Excel serials); Excel title-row scan; tightened substring header matching;
  debounced session save and memoised derived state in `App.tsx`.
- Mobile UI compression pass: dedicated phone density layer in
  `webapp/src/styles.css` (620px/420px breakpoints), bottom step bar with
  short labels (`About` / `List` / `Docs` / `Files`), and screen-by-screen
  copy/layout tightening on welcome, orientation, checklist, upload,
  results, and modals. Welcome and upload use mobile-only shorter ledes;
  orientation gets a progress bar; checklist rows and capabilities/confidence
  groups collapse behind disclosures; upload preview becomes labeled row
  cards on narrow widths; results refinement splits into accordions with CSV
  under "Other format"; modals behave as bottom sheets on phone.
- Fixed a hard blocker where uploading a CSV/Excel/HTML statement with
  differently worded column headers failed with a generic "Could not find
  a transaction table with the expected headers" error and refused to add
  the document. Added fuzzy header matching (`webapp/src/ingest/headerMatching.ts`):
  normalizes header casing/spacing/punctuation, matches against a synonym
  list per column (e.g. "Security Name"/"Symbol" for Scrip Name, "Qty" for
  Units, "Purchase Amount" for Buy Value), then falls back to small
  edit-distance typo tolerance for near-misses like "Purchse Date". Column
  order no longer matters. If a required column genuinely can't be found,
  the error now names exactly which one(s) are missing instead of a
  generic message. Deliberately did not add a value-shape fallback
  (guessing date/numeric columns by content) since the synonym and typo
  passes cover the reported failure; documented as a follow-up if it's
  ever needed. Added `fixtures/sample-broker-statement-fuzzy-headers.csv`
  (relabeled, reordered, one typo) and
  `fixtures/sample-broker-statement-missing-column.csv` to
  `validate-ingest.ts`, alongside the existing exact-header fixtures.
- Completed the design-audit pass over the webapp flow: renamed the
  jargon-heavy "Start with Computation" path to "Add documents", added a
  time estimate and clearer file-format caveat on welcome, moved the
  orientation privacy reassurance beside the question instead of the nav
  controls, and made "Start over" a separated danger action with an
  in-app confirmation modal instead of a native browser dialog. The upload
  step now gives parsing feedback, blocks zero-document results, supports
  real drag-and-drop, and shows the PDF/free-form extraction prompt inline
  instead of pointing users to a repo path. Results now lead with the
  summary before optional refinement inputs, put export guidance before
  the file buttons, give the XLSX CA Summary the primary action, keep the
  full workbook as the secondary record file, and show a green success
  message after export. Mobile polish keeps side-nav labels visible,
  adds a chevron to the checklist toggle, and hides secondary numeric
  preview-table columns on phone widths.
- Added a Section 234B advance-tax interest estimator (`AdvanceTaxPanel`,
  `lib/advanceTax.ts`, new `rules/advance-tax.json`/`.md`): enter total tax
  liability, what's already paid via TDS/instalments, and a date, and it
  estimates 1%-per-month interest on the shortfall from 1 April of the
  assessment year, correctly exempting resident senior citizens without
  business income (Section 207(2)) and cases under the Rs 10,000 Section
  208 threshold or already 90%+ paid. Deliberately does not estimate
  Section 234C (the per-quarter-instalment interest), since that needs
  income dated by quarter to avoid overstating it for anyone whose gains
  or dividends arrived later in the year; this tool doesn't capture income
  by quarter yet, and `rules/advance-tax.md` explains the gap plainly.
- Wired partial NRI/HUF/single-parent calculations that were previously
  checklist-only caveats (WORKING_PLAN.md item 3): NRE interest can now be
  entered as its own exempt line (Section 10(4)(ii), kept out of the
  taxable interest total); minor's-income clubbing computes the clubbed
  amount after the Section 10(32) per-child exemption (capped at 2
  children); and the old-vs-new regime comparison tool now explicitly
  tells HUF filers to skip it, since that tool's salary/standard-deduction
  assumptions don't fit an HUF's numbers at all (HUF can't have salary
  income, gets no standard deduction, and gets no Section 87A rebate).
  Upgraded `rules/nri-nre-nro.json`, `rules/huf-basics.json`, and
  `rules/single-parent-clubbing.json` from `pending_current_source` to
  `verified` after checking each against the Income Tax Department's own
  pages and current filing guides; still deferred and left as caveats:
  DTAA/repatriation and NRO TDS-rate precision for NRI, HUF partition and
  Section 64(2) transfer-without-consideration clubbing (needs an
  asset-level transfer log this tool doesn't have), and clubbing
  exceptions (a minor's own manual work/skill income, Section 80U
  disability) for single parents.
- Redesigned "Get to know the tool" into a 3-step tour (`ToolTour`): plain
  use cases ("turns your statements into numbers a CA can check", not a
  feature list), a walk-through of the real flow including "rules-based,
  never AI-guessed" computation and the two export files, then a direct
  "See with sample data" button that drops you straight into the existing
  sample-data flow. Distinct from the "What can this do?" panel, which
  stays the honest available-vs-planned scope list for a more skeptical
  reader; the two are separate doors for two different readers.
- Removed the standalone "See with Sample Data" link from the bottom of
  the welcome card, since it's now step 3 of the tour above; sample data
  is still one click away, just through the tour instead of a second,
  redundant link.
- Made the header logo a "back to home" control: click it from any step to
  return to the welcome screen. Non-destructive by design, since it only
  changes which screen is showing; it doesn't touch saved session state,
  so nothing is lost and the same filing is still there if you navigate
  forward again (or the side nav/"Resume" still gets you back to it).
- Simplify pass over this session's diff: fixed a validation check that
  used `.some()` where it needed to check every entry (so a single empty
  string could have slipped through unnoticed), removed a redundant
  re-check of `HOW_IT_WORKS` content already covered elsewhere, and
  collapsed two `loadSession()` calls on `App` mount into one shared read.
- Replaced the header's horizontal step indicator with a persistent
  vertical icon rail (`SideNav`) down the left edge of the whole app,
  visible on every screen including welcome. Same underlying step model as
  before (current step, furthest step reached, never a way to skip ahead),
  just a different view of it, and it now works before you've clicked
  "Resume": `furthestStepIndex` is seeded from any saved session on first
  render, so a reload or crash that lands back on welcome still shows and
  links to real progress instead of looking like step one. See
  `webapp/DESIGN_NOTES.md` for why this replaced the header stepper.
- Redesigned the welcome screen's 3 entry-path cards to be icon-led
  instead of paragraph-heavy: a small hand-rolled SVG icon, a short
  heading, and one supporting line each, no separate call-to-action line.
  Restored the "What can this do?" corner trigger on the welcome card
  (it opens the same capabilities panel as the "Get to know the tool"
  card; the two are just separate doors into it).
- Reworked the welcome screen's responsive layout across laptop, tablet,
  and mobile widths: a new 540px breakpoint alongside the existing 860px
  one, so the 3 entry cards go from a row (laptop) to 2-up with the third
  spanning full width (tablet) to a single stacked column (mobile), with
  matching adjustments to card padding and the headline's font size.
- Fixed `OrientationForm`'s nav row so "Back" and "Start over" sit on
  opposite ends of the same row (left/right) with the privacy note
  centered between them, instead of both buttons sharing the left side.
- Added the pending advance tax estimator and year-rollover items to
  `WORKING_PLAN.md`'s "Current Next Slice" list alongside the NRI/HUF
  wiring that was already tracked there, so they're visible as tracked
  work rather than only mentioned in chat.
- Welcome screen redesign, "show value first": replaced the single
  "Get started" call to action with 3 entry-path cards so a new user picks
  how they want to begin instead of being funneled straight into
  orientation questions:
  - "Checklist": the existing 8-question orientation flow, unchanged.
  - "Start with Computation": jumps straight to the document upload step
    for people who just want to drop in statements and see numbers first.
    Orientation answers stay at their safe null/default state (resident,
    no special circumstances); `deriveProfileFlags()` already treats a
    null answer as "No" everywhere, and the capital gains/dividends/
    interest math never reads orientation at all, so the numbers are
    correct immediately. A banner on the checklist/documents/results
    screens says plainly that defaults are in use, with a one-click way
    back to "About you" to answer the real questions. The step nav
    already makes "About you" and "Your checklist" reachable again once
    you land past them, reusing the existing furthest-step tracking with
    no special-cased jump logic.
  - "Get to know the tool": opens the capabilities preview panel. This
    replaces the old standalone "What can this do?" corner link in the
    welcome card, folded into this card instead.
- Moved "Start over" again: it now lives inside `OrientationForm` itself
  (bottom-left, next to "Back"), styled as a green CTA with the same
  visual weight as "Get started", instead of a plain text link next to
  the header's step nav. Removed from the header entirely. Note: since
  it's scoped to the orientation step only, there's currently no
  "Start over" affordance once you're past it (checklist/documents/
  results); reaching orientation again via the step nav is the way back.
- Changed the orientation "Skip this question" link to just "Skip", in
  the brand accent green, so it reads faster without competing with the
  Yes/No buttons above it.
- Merged the two separate scope notes into one line, shown once, in the
  footer's note box on every screen: "Built for FY 2025-26 (AY 2026-27)
  filings only. It organizes your numbers. It doesn't replace a CA."
  Removed the standalone note that used to sit above the welcome card
  and the disclaimer line that used to sit inside it.
- Added an old vs new tax regime comparison. `rules/regime-choice.json`
  now has FY 2025-26/AY 2026-27 slabs, standard deductions, and Section
  87A rebate thresholds for both regimes, verified against the Income
  Tax Department's official Budget 2025 FAQ (previously a stub pending
  verification). Enter your salary and old-regime deductions on the
  results screen to see an estimated cheaper-regime call. Scoped
  honestly: only the slab-taxed portion of income is compared (capital
  gains under 111A/112A are the same either way and excluded), and
  surcharge plus the 80+ super senior slab aren't modelled yet, both
  stated up front alongside the estimate. Marked "available" in the
  capabilities panel.
- Added an editable extraction review step to document upload. The
  "confirm what we read" screen is no longer read-only: every row's scrip
  name, dates, and buy/sell values can be corrected inline, or a single
  bad row removed, without discarding and re-adding the whole document.
  Gain/loss and short-term/long-term/intraday classification recompute
  live as you edit, using the same rules a freshly parsed row gets.
  Marked "available" in the capabilities panel.
- Follow-up polish on the welcome screen and orientation flow:
  - Renamed the sample-data link to "See with Sample Data".
  - The "What can this do?" capabilities preview now has exactly one entry
    point (the welcome card's corner button); removed the duplicate
    header trigger.
  - Moved "Start over" out of the header's own corner and onto the same
    row as the step navigation (the app's closest equivalent to a "Back"
    control), right-aligned. It still only shows once there's a filing in
    progress to reset.
  - Added a centered, visually secondary "Skip this question" option to
    every orientation question that's genuinely optional (HUF, senior
    citizen, single parent, multiple employers, HRA and EPF follow-ups).
    Residency and income sources stay required since they decide which
    checklist and rules branch applies at all.
  - Added a short note above the welcome card: "Built for FY 2025-26
    (AY 2026-27) filings only," since that's the only year the rules
    data is populated and verified for.
- Added a pre-export confidence report (`ConfidenceReportPanel`) to the
  results screen: one glanceable "still missing / may change your numbers
  / flagged but safe to export as-is" summary right above the export
  buttons. Regroups signals that already exist elsewhere in the flow
  (checklist gaps, form-changing risk triggers, AIS/26AS/TDS mismatches,
  NRI/HUF/single-parent scope caveats) by how urgently each one matters
  before you hand the files off, so nothing gets forgotten between the
  checklist step and export. Marked "available" in the capabilities panel.
- Added a manual AIS / Form 26AS / Form 16 reconciliation panel to the
  results screen (`ReconciliationPanel`): enter what those documents show
  for dividends, interest, and TDS per source, and any mismatch against
  the calculated figures is flagged immediately, no button to press, per
  BUILD_PLAN.md Section 4's "runs on every dashboard view" requirement.
  Entirely optional and never blocks an export; mismatches now also count
  toward the open-issues total shown before exporting. Wired the existing
  `tdsRows` plumbing (previously hardcoded empty) into the full workbook's
  TDS Reconciliation sheet, and persisted the new figures in the
  browser-only session so a resumed filing keeps them. Updated the
  capabilities panel to mark this and the "why this number" drilldown as
  available.
- Added a plain-language "Why this number?" drilldown to every results row:
  each `CaSummaryRow` now carries a specific, rule-grounded explanation
  (holding-period thresholds and rates for STCG/LTCG, why intraday income
  moves the ITR form, which of your profile flags or risk triggers drove
  the CA-vs-self-file call, and which fields were entered by you rather
  than read from a document) instead of a generic "rule-backed
  calculation" placeholder. Shown as a collapsed `<details>` under each
  row on the results screen, off by default so it doesn't clutter the
  summary view.
- Added a "What can this do?" capabilities preview (new `CapabilitiesPanel`,
  backed by a `CAPABILITIES` list in `src/lib/copy.ts`) for skeptical
  first-time users who want the full scope before entering any personal
  data: an "Available now" group (profiling, checklist, ingestion, guided
  AI extraction, capital gains/dividends/interest calculations, risk
  triggers, ITR/CA recommendation, exports, local-only storage, free
  hosting) and a "Planned, not yet available" group (AIS/26AS/Form 16
  reconciliation, a pre-export confidence check, editable extraction
  review, regime comparison, advance tax estimator, year rollover, and
  NRI/HUF/single-parent number calculations), so it never overstates
  today's coverage. Reachable from two shared-state triggers: the header
  (every step, same pattern as `HelpPanel`) and a dedicated corner button
  on the welcome card itself, both opening the same modal instance rather
  than duplicating it. Purely informational, dismissible, never blocks or
  reorders the guided flow.
- **Hosted the webapp on GitHub Pages** at
  https://kahanikids.github.io/unravel-tax/ - the top-priority gap called
  out in README.md/WORKING_PLAN.md, since a first-time non-technical user
  was never going to `git clone` and run `npm install`. Added
  `.github/workflows/deploy-pages.yml` (builds and deploys on every push
  to `main` touching `webapp/`), a `GITHUB_PAGES`-gated base path in
  `vite.config.ts` (local `npm run dev`/`npm run build` are unaffected),
  and made the header logo path base-aware so it resolves under the
  `/unravel-tax/` project-site prefix. Updated README.md's "Start here"
  and Status sections to lead with the live link, local `npm run dev` is
  now the fallback for contributors, not the primary path.
- Added "Where do I get this?" guidance to checklist documents (new
  `DOCUMENT_SOURCE_GUIDE` in `src/lib/copy.ts`, rendered via a new
  `DocumentSourceHint` component on both the main checklist step and the
  persistent sidebar). Covers the broker/AMC capital gains statement,
  Form 26AS/AIS, dividend statements, bank interest certificates, and
  Form 16, since a first-time filer often doesn't know which website or
  menu to look under. Static reference copy, not a live integration.
- Copy pass across all user-visible webapp text and README.md: removed
  dashes used as sentence punctuation (" - " standing in for a comma,
  period, or parenthesis), rewriting as separate sentences or comma/colon
  joins instead. Left hyphens in actual compound words (`self-file`,
  `non-technical`, etc.) and code comments untouched. Also fixed the
  welcome screen's "Any file format" badge to "Most File Formats" (it
  overstated PDF/free-form handling, which routes through the guided
  extraction prompt rather than being parsed directly).
- Added a "?" help button in the header (`HelpPanel`, visible on every
  screen including welcome): how the guided flow works, who the tool is
  for, and a fuller plain-language disclaimer, all in one place instead of
  spread across every screen. Centralized disclaimer/how-it-works/who-it's-
  for copy in `src/lib/copy.ts` (single source, was duplicated inline
  before). Tightened wording on the welcome screen and the checklist/
  upload step ledes.
- Made the header step indicator (`ProgressSteps`) into real navigation:
  any step already reached this filing is now a clickable button, so
  users can jump back to the checklist/documents/results without
  restarting from the welcome screen. Steps not yet reached stay inert -
  never a way to skip ahead. Tracked via a new `furthestStepIndex`, saved
  in the session cache so it survives a resume.
- Fixed `OrientationForm` to resume at the first unanswered question (or
  the last one, if all are answered) when navigated back to, instead of
  always restarting at Question 1.
- Swapped the header logo to the new artwork (`webapp/public/unravel-tax-logo.png`,
  cropped from the full lockup to fit the header) and updated README's
  hero image to the same new logo.
- Added `webapp/DESIGN_NOTES.md` capturing a user-provided dashboard
  reference image and how (and how much) it informed the nav decision
  above, so the reference doesn't need to be re-shared.

## 2026-07-02 (post-M4 hardening, PM review follow-up)

- Fixed a correctness gap: debt/specified mutual funds (Section 50AA) were
  silently classified using equity STCG/LTCG rates. Added an optional
  `Instrument Type` ingest column (defaults to "equity" for backward
  compatibility) and a separate "short-term-deemed, slab rate" bucket in
  calculations, exports, and the CA Summary rows, per
  `rules/capital-gains-mutual-funds.json`.
- Added the hard-block popup BUILD_PLAN.md Section 1.4 calls for on
  form-changing/recommendation-changing risk triggers (e.g. a trade moving
  someone to ITR-3). These previously only showed inline in the sidebar.
- Added "Known limits for your profile" caveats for NRI/HUF/single-parent
  flags, so the checklist doesn't imply calculation coverage (TDS
  reconciliation, NRE/NRO split, HUF partition, minor's-income clubbing
  amounts) that isn't wired in yet - those remain Phase 2/3 per
  SYSTEM_SPEC.md Section 14.
- Added localStorage session caching (BUILD_PLAN.md Section 9: resume
  convenience only, never the system of record) - orientation answers,
  documents, supplemental figures, and acknowledged risk triggers persist
  across a closed tab, with a "Resume where you left off" welcome-screen
  action and a "Start over" control to clear it.
- Added local-folder saving via the File System Access API (Chromium
  browsers, with a download fallback everywhere else): users can pick a
  folder once and have submitted documents and generated exports (CA
  Summary CSV/XLSX, full workbook) written straight there instead of
  piling up in Downloads.
- Fixed a pre-existing bug in `validate:guided-ui`: adjacent JSX
  expressions (`Question {index + 1} of {visible.length}`) get React SSR
  hydration comment markers inserted between them, so the literal substring
  assertion never matched. Collapsed to a single template-string expression.
- Reconciled README.md/WORKING_PLAN.md's contradictory status ("early
  scaffold" vs. "all slices complete") and pointed "Start here" at real
  local-run instructions (`cd webapp && npm install && npm run dev`) since
  there's no hosted link yet - that's now called out as the top remaining
  gap in both files.
- Removed a path reference in `templates/master-template.gsheet-link.md`
  that named an external file identifying a real person's financial data,
  per this repo's own "never real personal data in docs" rule.

## 2026-07-02

- Completed M4E: added browser-side CA Summary CSV/XLSX and full workbook
  XLSX generation, surfaced fixed export actions in the webapp handover
  panel, warned when checklist/reconciliation issues remain, and validated
  generated outputs against fixture expectations with
  `npm run validate:exports`.
- Completed M4D: ported reconciliation into the webapp, added a guided
  orientation/review flow with a persistent "Things To Check" panel, kept
  simple view as the first-time default with an explicit advanced-detail
  toggle, and validated that checklist consequences render before totals
  with `npm run validate:guided-ui`.
- Completed M4C: mirrored `rules/*.json` into the webapp, added typed rule
  loading and pure rule-backed calculation helpers, validated CA Summary
  parity against the Milestone 1 reference and Milestone 2 fixture buckets
  with `npm run validate:calculations`, and surfaced the calculation ledger
  in the webapp shell.
- Completed M4B: added client-side CSV, Excel, HTML, and structured-text
  ingestion under `webapp/src/ingest/`, kept PDF/free-form text routed to
  `prompts/01-extract-statement.md`, validated fixture parity with
  `npm run validate:ingest`, and surfaced supported formats in the webapp
  shell.
- Completed M4A: scaffolded the static Vite + React + TypeScript webapp
  under `webapp/`, kept it backend-free/account-free/API-key-free, added
  a Swiss-style milestone readiness shell, and validated it with
  `npm run build`.
- Completed M3C: added pure reconciliation functions for checklist gaps,
  calculated-vs-reported figure mismatches, and TDS cross-checks, plus a
  planted fixture validator proving missing documents and mismatches are
  reported before the webapp consumes the logic.
- Completed M3B: added rule markdown/JSON pair validation covering missing
  pairs, non-empty values, verification metadata, effective dates, and source
  references, with pending current-source review reported as warnings.
- Completed M3A: populated all 18 `rules/*.json` files with structured
  values, effective dates, source references, and explicit
  `pending_current_source` verification metadata.
- Completed M2C: notebook exports now generate a CA Summary CSV and full
  workbook from parsed transactions, and validation compares CA Summary
  totals to the Milestone 1 reference.
- Completed M2B: added deterministic notebook ingestion/calculation helpers
  for CSV, Excel, HTML, and structured text fixtures, kept PDF/free-form text
  routed to the guided prompt, and validated fixture parity in the notebook.
- Completed M2A: added `notebooks/build-workbook.ipynb` with runnable
  setup, fixture selection, calculation placeholder, export placeholder,
  and readiness-check cells, plus a validator that executes every code
  cell without manual edits.
- Completed M1C: ran a repeatable manual-flow dry run using the non-CSV
  HTML fixture, produced a full workbook copy and CA Summary CSV, and
  recorded friction points in `dry-runs/m1c/README.md`.
- Completed M1B: generated `templates/excel-export/UnravelTax-Template.xlsx`
  from synthetic fixture data, with common tabs, profile-specific tabs,
  formula-backed working sheets, and repeatable build/verification scripts.
- Completed M1A: README now links to the guided master prompt and template
  status file directly, and `prompts/README.md` makes
  `00-master-guide.md` the single prompt entry point.
- Added `WORKING_PLAN.md` as the loop-by-loop plan from scaffold to
  webapp: template + prompts, notebook, rules + reconciliation, then
  webapp. Each loop ends with validation, commit, and push.
- Repo scaffold initialised from `BUILD_PLAN.md` Section 6: `CLAUDE.md`,
  `README.md`, `CONTRIBUTING.md`, this file, `prompts/`, `rules/` stubs,
  `fixtures/`. `templates/`, `notebooks/`, and `webapp/` left as empty
  placeholders per the milestone sequencing in Section 12 — content for
  those comes with Milestones 1, 2, and 4 respectively.
