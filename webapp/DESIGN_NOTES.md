# Design notes

Reference material for visual/UX decisions in `webapp/`. Not part of the
build - nothing here is auto-loaded by the app. This exists so a reference
image only has to be described/pasted once.

## Reference: "Quixotic" dashboard template (added 2026-07-03)

Shru shared a screenshot of an unrelated fintech dashboard template
("Quixotic" - a wallet/payments admin UI, not part of this repo or project)
as visual inspiration, specifically for navigation. Explicitly a reference
to improvise from, not to follow exactly.

**What it shows:**
- Light gray page background, white rounded card as the app shell.
- Top bar: logo top-left; a horizontal row of section tabs centered
  (Dashboard/Reports/Documents/History/Contacts, one shown active as a
  filled pill); search/notification/avatar icons top-right.
- A narrow icon-only rail down the left edge (dashboard/tags/briefcase/
  contacts icons grouped, then wallet/mail/power, then settings/logout at
  the bottom) - a persistent nav so any section is one click away without
  returning to a home/dashboard screen first.
- Card-based main content: goal/balance cards, a bar chart, a payment
  history table, credit summary, grouped-avatar "mandatory payments" card.
- Green accent on white cards / light gray background, rounded pills for
  buttons and toggles, small circular avatar/icon badges.

**What actually carried over into Unravel Tax, and why:**
- The *pattern* worth borrowing was "persistent, always-visible nav so
  users don't have to return to a home screen to reach another section" -
  not the specific top-tab-bar + icon-rail combo. Unravel Tax doesn't have
  unrelated top-level sections (Reports/Contacts/etc.) the way that
  template does; it has one guided sequence (About You → Checklist →
  Documents → Results) that BUILD_PLAN.md deliberately keeps linear and
  free of landing-page-style menus (Section 1.3).
- So the improvisation: the step indicator that already appears in the
  header on every screen (`ProgressSteps`, present at every breakpoint per
  the responsive work already done) became the nav - each already-visited
  step is now a real, clickable button, not just a progress dot. That
  satisfies "jump to another section without going through the home
  screen every time" without introducing a second nav pattern or
  reopening the "no menu on first contact" rule, since it only ever
  reveals steps the user has *already reached*, never a way to skip ahead.
- The color palette needed no change - Quixotic's green-on-white already
  matches `--accent`/`--surface` in `styles.css`.
- Not carried over: the top tab bar, card/table visual style, avatar
  badges - those belong to a different kind of app (multi-section
  dashboard) and would work against BUILD_PLAN.md's single-path guided
  flow if copied literally.

**Update (same day): the icon-rail came back after all, for a concrete
reason the header-stepper version didn't cover.** `ProgressSteps` only
showed real progress once you were past the welcome screen - on a fresh
mount landing back on welcome (reload, crash, closing the tab), the
header stepper had no saved-session state to draw on until "Resume" was
actually clicked, so a filing in progress still looked like step zero
until then. The fix wasn't a new nav pattern, just hydrating
`furthestStepIndex` from `loadSession()` at mount time instead of only
after an explicit resume - so `SideNav` (replacing `ProgressSteps`
outright, same current-step/furthest-step state, same "never a way to
skip ahead" rule) can show and link to real progress on welcome too.
Kept as a persistent vertical rail rather than reverting to the
horizontal header version because it reads better next to the header once
it's carrying that responsibility on every screen, not just once a
filing is under way.
