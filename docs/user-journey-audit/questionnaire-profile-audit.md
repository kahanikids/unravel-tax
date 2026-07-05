# Questionnaire and user-profile journey audit

Date: 2026-07-05  
Product surface: Unravel Tax webapp, FY 2025-26 / AY 2026-27  
Evidence folder: `docs/user-journey-audit/`

## Evidence captured

1. `01-welcome.png` - first screen and entry-path choice.
2. `02-orientation-start-residency.png` - first questionnaire screen.
3. `03-resident-income-sources.png` - resident income-source multi-select.
4. `04-resident-simple-checklist-documents.png` - simple resident checklist and document handoff.
5. `08-nri-summary.png` - NRI summary screen after answering NRI-oriented questions.
6. `09-nri-checklist-documents.png` - attempted NRI handoff; this exposed a repeat-run/profile-state confusion and duplicated the resident checklist.
7. `10-returning-home-after-profile.png` - home screen after completing a profile.

Limits: screenshots verify the visible journey and handoff behavior. Tax completeness was also checked against source code, `FEATURE_COVERAGE.md`, `rules/itr-form-selection.*`, and the Income Tax Department AY 2026-27 downloads page. This is not tax advice.

## Official form anchor

The Income Tax Department downloads page for AY 2026-27 currently says:

- ITR-1: resident individuals, total income up to Rs 50 lakh, salary, two house properties, other sources, Section 112A LTCG up to Rs 1.25 lakh, agricultural income up to Rs 5,000.
- ITR-2: individuals and HUFs not having business/profession income.
- ITR-3: individuals and HUFs having business/profession income.
- ITR-4: resident individuals/HUFs/firms under presumptive sections 44AD/44ADA/44AE, total income up to Rs 50 lakh, and Section 112A LTCG up to Rs 1.25 lakh.

Source: https://www.incometax.gov.in/iec/foportal/downloads/income-tax-returns

## Step health

1. Welcome / entry choice - Healthy, with one issue.
   The three entry paths are understandable. However, after one completed profile, starting "Checklist" again did not present an obvious "start fresh or update existing answers?" decision in my capture.

2. Residency question - Needs improvement.
   The language asks where the user is "living", not their tax residential status. It misses RNOR and ROR explicitly, which matters for Schedule FA and ITR-1 eligibility.

3. Profile modifiers - Mostly healthy.
   HUF, senior/super-senior, single-parent, loans, insurance payout, and foreign assets are plain-language. But some are under-scoped: single-parent is too narrow for minor-income clubbing, and senior benefits need resident-status nuance.

4. Income-source selection - Needs improvement.
   The options are friendly but too coarse. "Something else" does not safely distinguish business/profession, F&O, intraday, crypto/VDA, property capital gains, lottery/racehorse income, agricultural income, or foreign income.

5. Document checklist handoff - Healthy for simple resident.
   The resident salary + bank-interest case produces a sensible four-item checklist: PAN/Aadhaar, Form 16, bank interest certificates, and AIS/26AS.

6. NRI path - Mixed.
   The NRI-specific country/days/income prompts make sense and the copy correctly separates NRE from NRO. The repeat-run capture showed state confusion, so this needs a regression test before trusting multi-profile testing.

7. Results-stage deeper inputs - Healthy but discoverability risk.
   A lot of high-value detail lives after documents under "A few more numbers" rather than in the questionnaire. That is fine for progressive disclosure, but only if orientation asks enough form-selection questions first.

## Profile-by-profile cases

### Simple resident salaried user

Case: resident, salary/pension + bank interest, no special flags.  
Current path: works. The checklist is short and not scary.  
Missing: income above Rs 50 lakh is only known later if the user enters salary. If the user never reaches results or never enters salary, ITR-1 suitability can be overstated.

Recommended questionnaire additions:

- "Is your total income likely above Rs 50 lakh?"
- "Did you have agricultural income above Rs 5,000?"
- "Any lottery, racehorse, gambling, or similar winnings?"
- "Was tax deducted under Section 194N for large cash withdrawals?"
- "Do you have deferred ESOP tax from an eligible startup?"

### Resident investor

Case: resident with shares/mutual funds, dividends, broker statements.  
Current path: asks about shares/MFs sold and routes conservatively toward ITR-2 when capital-gains documents exist.  
Missing: official AY 2026-27 ITR-1/ITR-4 now allow Section 112A LTCG up to Rs 1.25 lakh in limited cases. The app's conservative route is defensible, but it should say "we route to ITR-2 because uploaded broker statements can include STCG/loss/disqualifying details."

Recommended additions:

- "Did you sell anything other than listed shares/equity mutual funds: property, gold, bonds, crypto/VDA, unlisted shares, foreign shares?"
- "Do you have brought-forward or carry-forward losses?"
- "Were you a director in any company?"
- "Did you hold unlisted equity shares at any time during the year?"

### Resident with house property / rent

Case: salary + rent or owned homes.  
Current path: "Rent" exists as income source, and loan details later can compute let-out house property.  
Missing: ITR form selection needs count/type of house properties. The app rule still says ITR-1 has `house_properties_max: 1`, while the official AY 2026-27 downloads page says ITR-1 covers two house properties. This needs rule/copy review.

Recommended additions:

- "How many house properties did you own or report income/loss from?"
- "Any house-property loss brought forward or carried forward?"
- "Any pre-construction interest being claimed?"
- "Any more than one let-out property?"

### NRI

Case: outside India, Indian NRO interest/dividends/capital gains/rent.  
Current path: country, days in India, India-source income choices, NRE/NRO copy, TRC/Form 10F checklist are good.  
Missing: "living outside India" is not enough for tax residential status. RNOR/returning-to-India users are not handled. NRI capital-gains TDS and Form 13 are not asked early.

Recommended additions:

- "Are you Non-Resident, RNOR, or Resident and Ordinarily Resident for this FY?"
- If unsure: ask days in India this FY and relevant prior-year/4-year day counts, then label as estimated.
- "Did any broker/AMC/bank deduct TDS on NRI capital gains, NRO interest, dividends, or rent?"
- "Do you have a TRC and filed Form 10F for treaty relief?"
- "Did you apply for or need Form 13 lower/nil deduction?"
- "Do you have Indian rental income, and did the tenant deduct TDS / issue Form 16A?"

### HUF

Case: filing through a Hindu Undivided Family.  
Current path: asks whether income/investment is held through HUF, routes to HUF caveats, and has later HUF member/transfer panels.  
Missing: it does not distinguish "I personally have an HUF investment" from "this return is for the HUF as a separate assessee."

Recommended additions:

- "Are you preparing your personal return or the HUF's return?"
- "Does the HUF have its own PAN?"
- "Did any member transfer assets to the HUF without adequate consideration?"
- "Does the HUF have business/profession income?"
- "Has there been a claimed partition, and is there an Assessing Officer order under Section 171?"

### Senior / super-senior

Case: individual 60+ or 80+.  
Current path: simple and understandable.  
Missing: senior/super-senior benefits are resident-individual oriented; asking age without clarifying resident status can create false expectations for NRIs/RNORs.

Recommended additions:

- Capture date of birth or age band with an "as of 31 March 2026" note.
- If NRI/RNOR, state which senior benefits may not apply before the regime comparison.

### Parent / guardian with minor's income

Case: minor child has bank interest/investments.  
Current path: asks only "single parent or guardian with children under 18."  
Missing: minor-income clubbing can matter even when the user is married. The higher-income parent generally needs to club the income; narrowing this to single parents misses a real filing case.

Recommended replacement:

- Ask: "Does any minor child have income or investments in their own name?"
- Then ask: "Are you the parent whose income is higher / the parent who should club it?"
- Ask exception flags: minor's own work, own skill/talent, or Section 80U disability.

### Business, profession, F&O, intraday

Case: consultant, freelancer, F&O trader, intraday trader, business owner.  
Current path: not directly asked. Intraday can be detected from uploaded transactions, but a user can skip documents or upload summaries.  
Missing: this is one of the biggest form-selection gaps because it changes ITR-3/ITR-4, due date, audit questions, books, and CA recommendation.

Recommended additions:

- "Did you have business, freelance, professional, F&O, intraday, or speculative trading income?"
- "Are you using presumptive taxation under 44AD/44ADA/44AE?"
- "Do your books need audit / is turnover above the relevant threshold?"

### Insurance payout

Case: life-insurance maturity/survival payout.  
Current path: asks and later has per-policy computation.  
Missing: Keyman insurance and payout type are not separated early. The helper says death benefit is always tax-free, but Keyman is an exception in the rules.

Recommended additions:

- "Was this a death benefit, maturity/survival benefit, ULIP, traditional policy, or Keyman policy?"
- "Was any TDS under Section 194DA deducted?"

### Foreign assets / foreign income

Case: resident with US RSUs/ESPP, foreign brokerage, bank account, property, trust, signing authority.  
Current path: strong warning for residents; later panels cover foreign accounts and foreign shares/RSU/ESPP.  
Missing: ROR vs RNOR is not asked. Foreign signing authority, foreign property, trusts, and cash-value insurance are not fully captured. Calendar-year Schedule FA timing should be asked, not only explained.

Recommended additions:

- "Were you Resident and Ordinarily Resident for FY 2025-26?"
- "At any time during calendar year 2025, did you hold or have signing authority over a foreign bank, brokerage, custodial, retirement, property, trust, life-insurance, RSU/ESPP, or stock account?"
- "Did you receive foreign dividends/interest/salary/RSU vesting income and pay foreign tax?"

## Cross-cutting UX findings

1. Skipping equals No, but users may not understand the consequence.
   This is a good low-friction design, but high-risk questions should say "Skip = treat as No for now" in the summary.

2. The first residency question should ask tax status, not location.
   Use plain language, but include "resident / RNOR / non-resident" somewhere. This is foundational.

3. "Something else" is not safe enough.
   For tax, the "other" bucket hides the exact things that change forms: business/profession, F&O, crypto, lottery, agricultural income, unlisted shares, directorship, and carry-forward losses.

4. The summary Continue button can fall below the viewport.
   On the NRI summary capture, the button sat below the visible 720px viewport. It is reachable by scroll, but a sticky footer action or tighter summary card would help.

5. Repeat journey needs a clearer reset/update choice.
   After completing one profile and returning home, the user sees "Checklist" again, not an explicit "start new filing" vs "update current answers." That can make profile testing and real second attempts confusing.

## Prioritized backlog

P0 - Filing-form correctness:

- Add RNOR/ROR residential-status branch.
- Add a compact ITR-1 disqualifier screen for resident-simple users.
- Add business/profession/F&O/intraday/presumptive/audit questions.
- Add house-property count/loss question and review AY 2026-27 ITR-1 two-house-property change.
- Replace single-parent-only clubbing with a broader minor-income question.

P1 - Profile precision:

- Add NRI TDS/Form 13/TRC/Form 10F prompts.
- Split capital gains by asset class: listed equity/MF, debt MF, property, crypto/VDA, unlisted shares, foreign shares.
- Add foreign signing authority/property/trust/cash-value insurance prompts.
- Add HUF return-vs-personal-return distinction.

P2 - UX polish:

- Show "Skip means treated as No for now" in the answer summary.
- Add "Start a new filing" / "Update current answers" on the welcome screen after a profile exists.
- Keep summary Continue visible without requiring a long scroll.
- Add "I don't know" for tax-status questions and route to CA review rather than defaulting silently.

## Bottom line

The current questionnaire is excellent as an orientation layer for a simple resident and a useful first pass for NRI/HUF/senior/single-parent situations. It is not yet sufficient as a form-selection gate. The highest-risk omissions are not obscure edge cases: RNOR/ROR, business/F&O, house-property count, unlisted/director/carry-forward-loss disqualifiers, and minor-income clubbing for non-single-parent households.
