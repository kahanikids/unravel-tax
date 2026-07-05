# Unravel Tax — Open Source Tool: System Spec

Version 0.1. Drafted from a working session filing a sample taxpayer's FY2025-26 (AY2026-27) return. Every rule referenced here was checked against current sources during that session; see citations throughout.

> **Status note:** this is the original discovery-phase draft, written before
> `docs/BUILD_PLAN.md` and the repo scaffold were finalized. Dozens of files in
> `rules/*.md` and `rules/*.json` cite specific section numbers from this
> document as source material — **section numbers below must not be
> renumbered or removed**, even when content is edited. Where this draft's
> proposed prompt filenames, repo layout, or product name disagree with what's
> actually in the repo today, `docs/BUILD_PLAN.md` and the live `prompts/`,
> `rules/`, and `webapp/` directories are authoritative — this file's lasting
> value is the problem statement (Section 1–2) and the sourced rule detail
> (Sections 8–12, 14) that the rules library still points back to.

## 1. Problem

Indian individual tax filing is not actually hard — it's scattered. The rules live in Finance Acts and CBDT circulars, the data lives in broker/AMC/bank PDFs with no common format, and the computation logic (LT vs ST vs speculative, exemptions, surcharge caps, what's deductible and what isn't) has to be held in someone's head and redone every year. Most families either pay a CA for routine work that's mostly mechanical, or muddle through and get it wrong — most commonly by missing a rate change, misclassifying a trade, or double-counting (or forgetting) a deduction.

This tool exists to make that mechanical part free and repeatable, without requiring the user to know anything about spreadsheets, tax law, or software.

## 2. Who this is for

Non-technical individuals and families who:

- Have a handful of income sources (salary/pension, bank interest, broker capital gains, dividends, maybe rent) — not a business needing full accounting.
- Don't have — and don't want to pay for — a CA for the data-gathering and first-pass computation, though they may still want a CA to review before filing.
- Have never used ChatGPT, or have only the free tier.
- Could be a plain resident individual, or fall into one or more of: NRI, HUF (as karta or member), senior citizen, single parent/guardian.

## 3. Design principle: the spreadsheet is the engine, ChatGPT is the guide

This is the single most important decision in this spec, so it's stated up front.

An LLM should not be the thing computing 200 rows of capital gains arithmetic. It will occasionally get a number wrong, it can't be audited the way a formula can, and — critically for this tool — the free tier of ChatGPT is not built for that job. As of this session, ChatGPT's free tier:

- Allows file uploads, but caps them at roughly 3 files/day (Plus gets far more).
- Has Code Interpreter, but rate-limited to a handful of executions per hour, with the sandbox timing out fast.
- Frequently "forgets" an uploaded file's contents after a few messages in the same chat — there's no reliable persistent memory of a large dataset across a long conversation.
- Has no Custom GPT builder (that's Plus/Pro), so this cannot ship as a one-click installable GPT that only paid users can make.
- Runs a lower-tier model with a smaller effective usable context than Plus.

(Sources: [ChatGPT Free Tier 2026 Guide](https://pecollective.com/tools/chatgpt-free-tier-guide/), [ChatGPT Plans Compared 2026](https://intuitionlabs.ai/articles/chatgpt-plans-comparison), [OpenAI File Uploads FAQ](https://help.openai.com/en/articles/8555545-file-uploads-faq))

So the architecture puts the actual computation in a spreadsheet template with real formulas (the same pattern used in this session's sample workbook — classification, gain calculation, and tax estimates are all live formulas, not typed-in numbers). ChatGPT's job is narrower and better suited to what an LLM is actually good at:

1. Ask the user plain-language questions to figure out their profile (NRI? HUF? senior citizen? none of these?).
2. Point them to the right template and the right checklist of documents.
3. Do one bounded, one-shot task per broker/AMC statement: read the uploaded file and output a clean table the user pastes into the spreadsheet's raw-data tab. This fits inside free-tier limits because it's one file, one extraction, not an ongoing multi-turn analysis.
4. Answer specific rule questions, using a rules document the user pastes in as ground truth — not from ChatGPT's own training data, which may be stale or wrong on rates that change every Budget (this session caught ChatGPT-adjacent web content getting the STT deductibility rule wrong and quoting a superseded LTCG rate, from the broker's own website).
5. Flag things that need a real CA — this tool should make people confident about the 80% that's mechanical, not pretend to replace judgment on the ambiguous 20%.

The spreadsheet does the arithmetic, every time, the same way, auditable by anyone who opens it. ChatGPT does the parts that need language understanding: reading a messy PDF, asking the right follow-up question, explaining a rule in plain words.

## 4. System components

Three things, all living in one open-source repo:

**A. Template Workbook(s)** — original plan: Google Sheets as the primary
manual format (free, browser-only, no install, works on a phone), with an
Excel export for users who prefer it or work offline. Current repo status:
the webapp is the primary path, the Excel template exists in
`templates/excel-export/`, and the Google Sheets master copy link is not
published yet.

**B. Rules Library** — short, plain-language markdown files, one per topic, each dated and versioned by financial year, e.g. `rules/capital-gains-equity-FY2025-26.md`. This is what gets pasted into ChatGPT as grounding context — never rely on the model's own memory of tax rates. This mirrors the `Reference/` folder built during this session, generalized and expanded (Section 8 has the full list, including everything added in this pass for NRI/HUF).

**C. Prompt Pack** — a small number of copy-paste text blocks, each doing one job (Section 9). No installation, no API key, no custom GPT. Works identically whether the user is on free or paid ChatGPT, or switches to Gemini/Claude free tiers if OpenAI's limits change — the design doesn't depend on any one vendor's specific features beyond "can read pasted text and an uploaded file."

## 5. Non-technical setup — the actual steps

Written the way it should appear in the repo's README, on the assumption the reader has never used ChatGPT or Google Sheets before.

> Superseded by the actual shipped flow: the webapp ([README.md](../README.md)
> "Start here") is now the primary path, and the manual prompt pack that
> shipped is `prompts/00-master-guide.md` (single entry point) plus
> `prompts/01-extract-statement.md` and `prompts/02-explain-my-results.md` —
> not the three-prompt draft (`01-getting-started.md` /
> `02-extract-statement.md` / `03-ask-a-rule.md`) originally sketched below.
> Kept for the reasoning behind each step, which still holds.

1. Go to `sheets.google.com` in a browser. Sign in with any Google account (free).
2. Open the template link from the repo (`File > Make a copy` to get your own editable version). This is your working file from now on.
3. Go to `chatgpt.com`. Sign up if you haven't — free, no card needed.
4. Start a new chat. Copy the master guide prompt from the repo's `prompts/00-master-guide.md` and paste it in.
5. Answer ChatGPT's questions about your situation (resident/NRI, HUF involved, age 60+, sole parent handling this, etc.). It will tell you which tabs in your spreadsheet copy you need and hand you a document checklist.
6. Gather those documents — mainly your broker/AMC capital gains statement(s), Form 16 or pension statement, bank interest certificates, dividend statement if you have one.
7. For each broker/AMC statement: start a fresh message (or new chat if the old one has gone quiet for a while — free tier forgets fast), the master guide switches to the extraction behaviour in `prompts/01-extract-statement.md` and you upload that one file. ChatGPT outputs a clean table.
8. Copy that table and paste it into the matching "Raw Data" tab in your spreadsheet. The Summary tabs calculate themselves — no formulas to touch.
9. Read the flagged notes in the Detailed Summary tab (colour-coded: things needing your input are highlighted). When all documents are in, the master guide switches to `prompts/02-explain-my-results.md` for anything unclear.
10. When done, the CA Summary tab is the one to hand to an actual CA for review, or to use for self-filing if you're comfortable.

No step requires installing anything, writing a formula, or paying for anything.

## 6. Workbook data model

### 6.1 Tabs common to every profile

| Tab                            | Purpose                                                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Profile`                      | Name, PAN, FY, residential status, which category flags apply (can be more than one)                                                                                                      |
| `Raw Data - <Broker/AMC name>` | One per source, pasted from the ChatGPT extraction step. Raw columns preserved as-is from the source file.                                                                                |
| `Working - <Broker/AMC name>`  | Added columns: LT/ST/Intraday classification (formula off dates), computed gain (formula), applicable tax treatment, rule-change flag — same pattern as the ABML sheet built this session |
| `Dividends`                    | Quarter-wise, not annual — needed for the Section 234C advance-tax interest calc in Schedule OS                                                                                           |
| `Interest & Other Income`      | Bank/FD/RD interest, any other "Other Sources" income                                                                                                                                     |
| `Transaction Charges`          | STT vs non-STT charges, split by deductibility rule (capital gains vs speculative income)                                                                                                 |
| `Carry Forward Losses`         | Register by AY, type, section, original amount, amount used, balance, expiry (8 AYs from the year the loss arose)                                                                         |
| `CA Summary`                   | Numbers only, no rules or notes — the one to hand a real CA                                                                                                                               |
| `Detailed Summary`             | Full working: tax estimate, rule flags, profile-specific advice, sources                                                                                                                  |
| `ITR Form Guide`               | Auto-suggests ITR-1/2/3 based on what's populated elsewhere (see Section 10)                                                                                                              |

### 6.2 Additional tabs by profile

**NRI**

- `NRE-NRO Tracker` — separate columns per account, since NRE interest/balance is exempt and NRO interest is fully taxable
- `TDS Reconciliation` — brokers/AMCs deduct TDS on NRI capital gains at source (residents don't have this); this tab reconciles TDS actually deducted (from contract notes/AMC statements) against Form 26AS/AIS and computes the refund or shortfall
- `DTAA & Residency` — country of residence, TRC status/expiry, Form 10F or 67 filed y/n, days-in-India count feeding the Section 6 residential status test (resident/NRI/RNOR)
- `Repatriation Log` — NRO remittances, running total against the USD 1 million/year limit, Form 15CA/15CB status (see Section 10 for the FY2025-26/FY2026-27 forms renaming)

**HUF**

- `Coparceners & Members` — names, relationship, PAN
- `Transfers Without Consideration` — assets a member put into the HUF without adequate payment; income from these clubs back to that member under Section 64(2), not taxed in the HUF's hands — easy to miss and a common error
- `Partition Log` — if a full or partial partition has occurred, with the deed reference

**Senior Citizen**

- `80TTB Tracker` — interest income eligible for the ₹50,000 deduction (old regime only), separate from 80TTA which doesn't apply once someone crosses 60
- `Regime & Advance Tax Flags` — auto-flags if the person has any business/speculative income, which (a) may disqualify the usual senior-citizen advance-tax exemption and (b) restricts regime-switching to once-in-a-lifetime instead of every year

**Single Parent / Sole Guardian**

- `Minor's Income (Clubbing)` — investments/accounts in a minor child's name, clubbed under Section 64(1A) with the custodial parent, feeding Schedule SPI in the ITR (see Section 10)
- `Alimony/Maintenance Log` — periodic vs lump-sum flag, since they're taxed differently

## 7. Prompt Pack — draft content

> Superseded by the shipped Prompt Pack (see `prompts/README.md`): a single
> entry point, `prompts/00-master-guide.md`, internally routes to
> `prompts/01-extract-statement.md` and `prompts/02-explain-my-results.md`
> instead of the three separately-invoked drafts below. Kept as the earliest
> version of the wording these prompts evolved from.

### `prompts/01-getting-started.md`

```
You are helping a non-technical person in India prepare their income tax
filing data. You are NOT a substitute for a CA — say so if asked to give
final tax advice, and recommend professional review before filing.

Ask me, one or two questions at a time, not all at once:
1. Am I a resident of India for tax purposes, or an NRI, for this financial year?
2. Do I have income or assets through a Hindu Undivided Family (HUF)?
3. Am I 60 or older?
4. Am I the sole parent/guardian handling this for myself and my children?
5. What income do I have: salary/pension, bank interest, shares/mutual
   funds sold this year, dividends, rental income, anything else?
6. Did I change jobs this year, or have more than one employer/Form 16?
7. Am I claiming HRA? If so, is my annual rent over ₹1 lakh (this needs
   my landlord's PAN)?
8. Did I withdraw from my EPF/PF this year, especially before completing
   5 years of continuous service?
9. Did I already pay any advance tax this year, or is this the first time
   I'm calculating what I owe?

Based on my answers, tell me:
- Which optional tabs I should keep in my copy of the template spreadsheet
  (link: [REPO LINK]) and which I can ignore.
- A short checklist of documents to gather before we continue, specific to
  my situation (don't give me the generic list, give me MY list).
- Which of the risk triggers in `rules/filing-mistakes-and-penalties.md`
  apply to me based on what I've just told you, stated plainly (e.g. "you
  changed jobs, so your TDS from each employer needs reconciling or you
  risk an automatic mismatch notice").
- Do not attempt to calculate anything yet. Wait for documents.
```

### `prompts/02-extract-statement.md`

```
I'm uploading one broker or mutual fund capital gains/transaction
statement (PDF, Excel, or CSV). Read it and output ONLY a table with these
exact columns, one row per transaction:

Scrip/Fund Name | Purchase Date | Sell Date | Units | Buy Value | Sell
Value | Buy Price | Sell Price

Rules:
- If the file has subtotal or summary rows mixed in with transaction rows,
  drop the subtotal rows — I only want individual transaction lines.
- Use DD-MMM-YYYY date format.
- Do not classify long-term/short-term yourself — the spreadsheet formulas
  do that.
- Do not calculate gains yourself — the spreadsheet formulas do that too.
- If any transaction is missing a purchase date or sell date, flag it in a
  separate line after the table instead of guessing.
- Output the table in a format I can copy straight into a spreadsheet
  (tab-separated or markdown table, your choice, just tell me which).
```

### `prompts/03-ask-a-rule.md`

```
I'm going to paste a rules document below. Answer my question using ONLY
what's in that document — if it doesn't cover my question, say so plainly
rather than filling the gap from general knowledge, since tax rates and
thresholds change every year and you may not have the current figures.

Rules document:
[PASTE FROM rules/ FOLDER HERE]

My question:
[QUESTION]
```

These three cover the flow used in this session. A repo maintainer can add more (e.g., an "explain this flagged warning" prompt, an "old vs new regime comparison" prompt) without changing the architecture.

## 8. Rules Library — file list

Each file: what it covers, dated to a financial year, short enough to paste into a chat message without hitting length limits.

**General (every profile)**

- `capital-gains-equity-FY2025-26.md` — 111A/112A rates, exemption, STT/charges deductibility, surcharge cap, 87A exclusion
- `capital-gains-mutual-funds-FY2025-26.md` — equity-oriented vs debt/specified fund treatment (Section 50AA)
- `dividends-FY2025-26.md` — TDS threshold, quarterly Schedule OS reporting requirement
- `regime-choice-FY2025-26.md` — old vs new regime slabs, what's lost/gained switching
- `itr-form-selection-AY2026-27.md` — see Section 10, including the split ITR-1/2 vs ITR-3/4 due dates
- `filing-mistakes-and-penalties-AY2026-27.md` — the full Section 12 trigger table: wrong form, AIS/26AS mismatches, HRA/landlord PAN, EPF withdrawal TDS, late filing (234F), underreporting/misreporting (270A)
- `new-act-2025-transition.md` — what changes FY2026-27 onward, what doesn't apply yet

**NRI**

- `nri-residential-status.md` — Section 6 day-count test, RNOR
- `nri-nre-nro.md` — full NRE vs NRO treatment (Section 10.1)
- `nri-tds-and-refunds.md` — broker/AMC TDS at source, Form 13 lower-deduction certificate, claiming refunds
- `nri-dtaa.md` — TRC, Form 10F, Form 67
- `nri-repatriation.md` — USD 1M limit, Form 15CA/15CB (now 145/146)

**HUF**

- `huf-basics.md` — separate-entity taxation, slabs, no 87A rebate
- `huf-clubbing-64-2.md` — transfers without consideration

**Senior Citizen**

- `senior-citizen-basics.md` — exemption thresholds, 80TTB, 80D, 80DDB
- `senior-citizen-advance-tax-and-regime.md` — the business-income caveats found this session

**Single Parent / Guardian**

- `single-parent-clubbing.md` — Section 64(1A), Schedule SPI
- `single-parent-alimony.md` — periodic vs lump sum

Update cadence: review after every Union Budget (usually February) and after any mid-year Finance Act amendment (the July 2024 capital gains rate change being the precedent for why this can't just be an annual check). Each file's top line should read something like "Last verified: [date] against [source]" so users can see how fresh it is at a glance.

## 9. NRI deep-dive (the part explicitly flagged as needing more depth)

This is the most complex profile and deserves more than a stub. Six things that are structurally different from a resident filer, not just "the same thing with different numbers":

**9.1 NRE vs NRO are not interchangeable for tax purposes.** NRE holds foreign-sourced money; the interest is tax-exempt in India and the account isn't caught by Section 195 TDS at all, since there's no Indian-sourced income in it. NRO holds India-sourced income (rent, dividends, pension, capital gains proceeds); interest on NRO is fully taxable at slab rates with TDS deducted by the bank. Mixing these up in a data entry — say, treating NRO interest as exempt because "it's an NRI account" — is the single most common NRI filing error this tool should guard against. (Source: [ClearTax NRE vs NRO](https://cleartax.in/s/nre-nro-taxation))

**9.2 TDS on capital gains is deducted at source by the broker/AMC — residents don't have this.** For a resident, no TDS applies when you sell listed shares or mutual fund units; the person self-assesses and pays via advance tax or self-assessment tax. For an NRI, the broker or AMC is required to deduct TDS at the time of sale/redemption — currently 12.5% on LTCG and 20% on STCG for STT-paid equity, up to the maximum slab rate (with cess) on debt fund gains. This means an NRI's actual liability and what's already been withheld are two different numbers from day one, and reconciling them (not just computing the "right" tax) is a core part of the workflow. (Source: [Rupeeflo — TDS Rules for NRIs FY2025-26](<https://www.rupeeflo.com/resources/tds-rules-for-nris-on-interest-rent-capital-gains-(fy-2025-26)>))

**9.3 Form 13 exists to fix over-withholding before it happens, not just after.** If an NRI's actual liability will clearly be lower than the standard TDS rate (e.g., losses elsewhere, DTAA relief, low overall income), they can apply for a lower/nil deduction certificate in advance rather than waiting a year for a refund. Worth surfacing this explicitly since most people only find out about it after they've already overpaid.

**9.4 DTAA relief needs two different forms depending on the method.** Exemption method: Tax Residency Certificate (TRC) from the country of residence, plus Form 10F filed electronically. Credit method (claiming foreign tax credit instead): Form 67. These aren't interchangeable and the wrong one gets the claim rejected.

**9.5 Repatriation has its own compliance layer, separate from the tax return.** NRO repatriation is capped at USD 1 million per financial year (cumulative across all NRO accounts); NRE has no cap. Above ₹5 lakh repatriated from NRO, both a self-declaration and a CA certificate are required. As of 1 April 2026 (i.e., now, under the new Income Tax Act 2025), these are renamed — Form 15CA is now Form 145, Form 15CB is now Form 146 — but the underlying requirement is the same. This is a good example of "the form name is dictated by today's date, the tax treatment is dictated by the year the income was earned" — a distinction worth stating explicitly in the tool since it's genuinely confusing during a transition year. (Source: [Panda — NRO Repatriation USD 1M Limit](https://www.getpanda.money/blogs/nro-account-repatriation-usd-1-million-limit/))

**9.6 ITR form choice is narrower for NRIs than for residents.** NRIs cannot use ITR-1 or ITR-4 at all, regardless of how simple their income is — they must use ITR-2 (no business income) or ITR-3 (with business/speculative income). This should be hard-coded into the `ITR Form Guide` tab's logic, not left to the user to figure out.

## 10. ITR form selection logic (for the auto-guide tab)

| Condition                                                                                                                                                 | Form                                                  | Due date, AY2026-27             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| Resident, salary/pension + up to 2 house properties + LTCG (112A) ≤ ₹1.25L and nothing else                                                               | ITR-1                                                 | 31 Jul 2026                     |
| Resident, any capital gains beyond the ITR-1 threshold, foreign assets, RNOR status, director in a company, unlisted shares, or clubbing provisions apply | ITR-2                                                 | 31 Jul 2026                     |
| Anyone (resident, NRI, or HUF) with business or professional income — including speculative/intraday trading — accounts not requiring audit               | ITR-3                                                 | 31 Aug 2026                     |
| Same as above, but accounts requiring a tax audit                                                                                                         | ITR-3                                                 | 31 Oct 2026                     |
| NRI, any income profile without business income                                                                                                           | ITR-2 (never ITR-1/4)                                 | 31 Jul 2026                     |
| HUF, no business income                                                                                                                                   | ITR-2                                                 | 31 Jul 2026                     |
| HUF, with business income                                                                                                                                 | ITR-3                                                 | 31 Aug 2026 (31 Oct if audited) |
| Clubbed income present (Section 64)                                                                                                                       | ITR-2 or ITR-3, reported in Schedule SPI, never ITR-1 | per form above                  |

(Sources: [TaxGuru — ITR Forms AY2026-27](https://taxguru.in/income-tax/itr-forms-ay-2026-27-form-file-key-changes.html), [ClearTax — ITR-2 Filing AY2026-27](https://cleartax.in/itr-2-filing), [Income Tax India — Schedule SPI](https://www.incometaxindia.gov.in/w/schedule_spi), [CACLubIndia — July 31 vs August 31 AY2026-27](https://www.caclubindia.com/articles/due-date-for-filing-itr-ay-202627-july-31-vs-august-31-55204.asp))

Practical note carried over from this session: a senior citizen with pension and capital gains only needs ITR-2 (due 31 Jul), but the moment they also have speculative/intraday trading income (like the sample taxpayer), they move to ITR-3 — which this year also means a different, later due date (31 Aug, not 31 Jul). This is a real correction worth surfacing to the user: don't assume everyone shares the same deadline, and don't assume the deadline is fixed at 31 July the way it was in past years — this "different form, different date" split is specific to AY2026-27 and should be re-checked each year, not hardcoded.

A belated return is still possible after the applicable due date above, up to 31 December 2026, but it comes with a late fee under Section 234F and forfeits the right to carry forward most losses — see Section 12.

## 11. Gaps this pass filled in (explicitly, so nothing gets silently dropped)

Beyond what this session's actual workbook covered (equity capital gains classification, dividends, senior-citizen advice, STT/charges treatment), this spec adds, because a general-purpose tool needs them even though the sample taxpayer's specific case didn't require all of them yet:

- NRE vs NRO as a structural distinction, not a footnote (Section 9.1)
- NRI TDS-at-source mechanics and Form 13 (Section 9.2–9.3) — fundamentally different from how residents experience capital gains tax
- DTAA form pairing, exemption vs credit method (Section 9.4)
- Repatriation limits and the mid-transition form renaming (Section 9.5)
- HUF Section 64(2) — clubbing on transfers into the HUF without consideration, distinct from the minor-child clubbing already covered for single parents
- HUF's own ITR form restriction (no ITR-1/4)
- A complete ITR form selection table across all profiles, including the NRI and clubbing-provision cases
- Schedule SPI as the specific place clubbed income gets reported — the single-parent reference material from this session established the clubbing rule but not where it goes on the actual return
- The free-tier ChatGPT constraints that make "spreadsheet as engine" a requirement, not a preference — this wasn't discussed before but determines almost everything about how the tool has to be built for it to actually work for a non-technical, non-paying user
- A full "what's at stake" layer (Section 12) — the entire spec up to this point was about computing correctly, with no equivalent coverage of what happens when someone doesn't: defective-return notices, AIS/26AS mismatches, HRA without a landlord PAN, EPF withdrawal TDS, late-filing penalties, and the underreporting/misreporting penalty tiers. Prompted directly by a shared news source ([NDTV — ITR filing mistakes](https://www.ndtv.com/business-news/filing-income-tax-return-mistakes-penalty-tds-hra-epf-taxpayers-loan-capital-gain-investment-11401988); NDTV itself wasn't directly fetchable, so this was corroborated against equivalent reporting — see Section 12's sources)
- The ITR-1/ITR-2 vs ITR-3/ITR-4 due-date split for AY2026-27 (31 July vs 31 August) — the earlier draft of this spec, and this session's actual sample workbook, both assumed a single 31 July deadline for everyone. That's wrong this year for anyone filing ITR-3, the sample taxpayer included, since the speculative income puts them there. Corrected in Section 10.
- Three intake questions the "Getting Started" prompt was missing — job changes/multiple employers, HRA/rent claims, EPF withdrawals — added directly because of the trigger review in Section 12

## 12. Risk triggers — what's at stake

Everything so far is about computing correctly. This section is about the other half: surfacing, loudly, what happens when something's wrong — because that's what actually motivates a non-technical user to slow down and check. Sourced against current reporting on common filing mistakes ([NewsX — 6 Income Tax Penalties](https://www.newsx.com/business/itr-filing-2026-are-you-making-these-tax-filing-mistakes-6-income-tax-penalties-every-taxpayer-should-know-239214/), [Upstox — 5 less-talked-about ITR mistakes AY2026-27](https://upstox.com/news/personal-finance/tax/5-biggest-yet-less-talked-about-itr-filing-mistakes-taxpayers-may-make-in-ay-2026-27/article-195901/), [ClearTax — Section 234F](https://cleartax.in/s/late-tax-return)).

These should not just sit in a document — they should be active checks. The `Detailed Summary` tab and the Prompt Pack should both surface a trigger the moment its condition is met, not wait for the user to read a rules file end to end.

| Trigger condition                                                                                      | What's at stake                                                                                                                                                                                                                                 | Section                               |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Wrong ITR form used (e.g. ITR-1 filed with LTCG over ₹1.25L, or with any STCG)                         | Return marked defective under Section 139(9) — 15 days to refile in the correct form or it's treated as never filed                                                                                                                             | 139(9)                                |
| Income/TDS doesn't match AIS, Form 26AS, or Form 16                                                    | Automated mismatch notice — the department's tools flag this without a human reviewing first                                                                                                                                                    | —                                     |
| Multiple employers in one year, TDS not reconciled                                                     | Each employer deducts TDS independently without knowing about the other salary — under-withholding surfaces as a shortfall the taxpayer has to make up, often as a surprise                                                                     | —                                     |
| HRA claimed without landlord's PAN (where annual rent exceeds ₹1 lakh)                                 | Claim rejected on scrutiny even if genuine, for a documentation gap not a substance one                                                                                                                                                         | —                                     |
| Capital gains or other income pushes tax liability past ₹10,000 after TDS, and advance tax wasn't paid | Interest under Sections 234B/234C, quarter by quarter — this is exactly why dividends and gains need to be dated, not just totalled (see Section 6.1, Dividends tab)                                                                            | 234B/234C                             |
| EPF withdrawn before 5 years of continuous service, over ₹50,000                                       | TDS at 10% (with PAN) or ~34.6% (without) applies at withdrawal — easy to forget this counts as taxable income for the year, not a tax-free corpus                                                                                              | 192A (Section 392(7) from 1-Apr-2026) |
| Deductions claimed (80C, 80D, HRA, etc.) without retaining proof                                       | Department's automated cross-checks flag unsupported claims for scrutiny even years later                                                                                                                                                       | —                                     |
| Filed after the applicable due date (see Section 10 — it's not always 31 July)                         | Section 234F penalty: ₹1,000 if total income ≤ ₹5L, up to ₹5,000 otherwise. Also forfeits the right to carry forward most losses (the exact carry-forward mechanism built in Section 6.1) and loses interest on any refund for the delay period | 234F                                  |
| Income underreported (missed a source, wrong figure)                                                   | Penalty of 50% of the tax on the underreported amount                                                                                                                                                                                           | 270A                                  |
| Income misreported (false claims, fabricated documentation, concealment)                               | Penalty of 200% of the tax on the misreported amount — this is a different, much harsher tier than an honest mistake                                                                                                                            | 270A                                  |

Design implication: the `Getting Started` prompt (Section 7 of the Prompt Pack) needs to ask about job changes mid-year, HRA/rent claims, and EPF withdrawals — none of which were in the original v1 prompt draft. Fixed below (Section 7 has been updated to reflect this). This is a direct example of the gap this trigger review caught: the intake conversation was building toward "what income do you have" without asking "did anything change or get withdrawn this year," which is where several of the highest-consequence mistakes above actually originate.

## 13. Repo structure (proposed)

> Superseded by `docs/BUILD_PLAN.md` Section 6 and the repo as it actually
> exists — the product was renamed from "IndiaTaxAssistant" to "Unravel Tax"
> and the prompt pack shipped as `00-master-guide.md` /
> `01-extract-statement.md` / `02-explain-my-results.md` (Section 7 above).
> Left below only as the earliest draft of the idea.

```
unravel-tax/
  README.md                  <- setup steps from Section 5
  LICENSE                    <- MIT or Apache 2.0 recommended for max reuse
  templates/
    master-template.gsheet-link.md   <- link + instructions to copy
    excel-export/
      IndiaTaxAssistant-Template.xlsx
  prompts/
    01-getting-started.md
    02-extract-statement.md
    03-ask-a-rule.md
  rules/
    (files listed in Section 8, one per topic per FY)
  CONTRIBUTING.md             <- how to submit a rule update after a Budget
  CHANGELOG.md                <- dated log of rule changes, mirrors Budget/Finance Act timing
```

## 14. Phasing

> Historical: all four phases/milestones described here and in
> `docs/BUILD_PLAN.md` Section 12 have since shipped (webapp included — see
> the README "Status" section for what's fully calculated vs. partial per
> profile). Kept for the original prioritization reasoning.

**Phase 1 (MVP):** General resident + Senior Citizen profiles only, since that's what's been built and validated this session. Equity capital gains, dividends, carry-forward register, CA Summary/Detailed Summary split, prompt pack v1.

**Phase 2:** NRI profile in full (Section 9), HUF profile in full (Section 6.2/64(2)), Mutual Fund tab (equity vs debt distinction under Section 50AA).

**Phase 3:** Single-parent clubbing tooling, old-vs-new regime comparison calculator tab, ITR form auto-guide logic wired into the spreadsheet itself (not just a reference table).

**Phase 4 (maybe):** A lightweight companion script (Python, run locally, optional — not required for the core tool to work) for people who outgrow the copy-paste flow and want to batch-process many years or many family members at once. This should remain optional; the core promise of the tool is that it never requires this.

## 15. Implementation stack

Recommendation: a static, client-side-only web app. No backend, no database, no accounts, ever. This is a deliberate constraint, not a starting-cheap-and-upgrading-later plan — see 15.2 for why the constraint should stay permanent.

### 15.1 Why not the two obvious alternatives

- **Excel/VBA embedding.** Excel-only, triggers macro security warnings that scare exactly the non-technical users this tool is for, and VBA is a shrinking skill pool for an open source project hoping for contributors. Office Scripts (the modern equivalent) needs a Microsoft 365 subscription — reintroduces the "not everyone's paid for this" problem already solved for by not requiring ChatGPT Plus.
- **A "proper" webapp with a backend and database.** Buys persistence and multi-device sync, at the cost of becoming a custodian of strangers' PAN numbers, income, and capital gains on a server. For a volunteer-maintained open source project, that's a real liability (a breach is a when, not an if) and a real recurring cost, for a benefit — remembering the user between sessions — that the exported file already provides for free.

### 15.2 Recommended stack (static web app)

| Layer             | Choice                                                                                                                                                        | Why                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI framework      | Vite + React + TypeScript                                                                                                                                     | Common enough for contributors to onboard to; still fully static-exportable                                                                                    |
| Excel read/write  | A browser-based spreadsheet library (e.g. the open source `xlsx`/SheetJS package, or an equivalent — any actively maintained one that runs client-side works) | Generates both export flavours entirely in-browser, no server round-trip                                                                                       |
| CSV               | A standard CSV parsing library (any well-maintained one for the chosen framework — this is a solved problem, not worth hand-rolling)                          | Import/export, same in-browser constraint                                                                                                                      |
| Rules engine      | `rules/*.json`, one per topic/FY, paired with the human-readable `rules/*.md` from Section 8                                                                  | Updating a rate after a Budget becomes a JSON edit + PR, not an application-logic change — keeps annual maintenance approachable for a non-programmer reviewer |
| State/persistence | Browser `localStorage` only, as a convenience for resuming a half-finished session                                                                            | Not the system of record — see 15.3                                                                                                                            |
| Hosting           | GitHub Pages (or Netlify/Vercel free tier)                                                                                                                    | Zero recurring cost, versioned alongside the code                                                                                                              |
| Auth              | None                                                                                                                                                          | Removes the biggest trust and liability surface entirely                                                                                                       |

Where LLM Options fit: parsing a messy broker/PMS PDF is an LLM extraction job, because the reports are not standardised enough for reliable native table reconstruction. The web app can use in-browser Llama, OpenRouter with the user's API key, or a copy-paste prompt in the user's AI chat of choice. Everything downstream — classification, gain formulas, tax estimate, the Section 12 risk-trigger checks — runs deterministically in the app's own code, inspectable by anyone, never passed through an LLM for calculation. Any API-key route must stay optional — a required key would reintroduce the exact cost barrier this whole design avoids.

### 15.3 Export spec — the two output flavours

This is the actual deliverable a user walks away with, matching what was built for the sample taxpayer this session:

- **CA Summary (.xlsx and .csv)** — figures only, category totals (Equity/MF/Dividends/Interest/Charges/Carry-forward), no rule commentary, no colour-coded warnings. Built to be handed to a professional without extra explanation needed.
- **Full Workbook (.xlsx only, CSV doesn't preserve the structure)** — everything: raw data tabs, working tabs with classification/formula columns, Detailed Summary with tax estimate and rule flags, Carry Forward Losses register. This is the "for keeps" file — the one worth keeping in a personal archive year over year, since it's also the audit trail if a notice ever arrives asking how a number was arrived at.

Both exports are generated client-side, in the browser, at the point the user clicks "Export" — nothing is rendered or stored server-side at any point.

### 15.4 Repo structure update

```
unravel-tax/
  webapp/
    src/
      rules/           <- mirrors top-level rules/, JSON versions
      lib/              <- classification, gain-calc, tax-estimate logic (pure functions, unit-testable)
      components/
    package.json
  rules/                <- unchanged, Section 8 markdown files remain the human-readable source
  notebooks/
    build-workbook.ipynb   <- Colab-ready port of this session's Python scripts
  templates/              <- Excel template exists; Google Sheets link pending
  prompts/                <- unchanged
```

### 15.5 Sequencing

> Historical/current split: this sequencing records the original build logic,
> but the webapp is now the primary path (see README.md "Start here"). The
> prompt pack, Excel template, notebook, rules-as-data layer, and static webapp
> have shipped; the Google Sheets master copy link remains unpublished.

1. Manual template path + Prompt Pack (Sections 5–7) — the Excel template and
   prompts ship with no app build step; the Google Sheets master copy is still
   pending.
2. Google Colab notebook porting this session's actual Python/openpyxl scripts — near-zero additional work since the code already exists and is proven against a real filing, zero install for the user.
3. The static web app (this section) — build once there's evidence the first two are actually being used, not before.

## 16. Standing disclaimer

This tool helps organize data and applies well-established, sourced rules mechanically. It does not replace professional judgment on ambiguous situations, does not constitute legal or tax advice, and every output should carry a visible reminder to have a qualified CA review before filing, especially for NRI, HUF, and any year involving a rate change or a genuinely ambiguous transaction (e.g., whether a specific charge is already netted into a broker's reported figures — the exact kind of open question flagged in this session's sample workbook).
