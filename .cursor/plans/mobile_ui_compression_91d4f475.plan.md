---
name: Mobile UI Compression
overview: "Plan a mobile-first pass that keeps the existing Organic visual language while making the app faster to scan on phones: less explanatory text, smaller cards, stronger visual status cues, and collapsed dense sections by default."
todos:
  - id: mobile-density-system
    content: "Add mobile compression CSS: smaller spacing, type, cards, headers, footer, and no oversized shadows."
    status: completed
  - id: mobile-shell-nav
    content: Plan/implement mobile bottom step bar using existing SideNav state model.
    status: completed
  - id: mobile-welcome
    content: Compress welcome screen copy and cards for phone-first scanning.
    status: completed
  - id: mobile-orientation
    content: Make orientation questions more visual and thumb-friendly on mobile.
    status: completed
  - id: mobile-checklist
    content: Turn checklist/sidebar content into compact status plus collapsed row details on mobile.
    status: completed
  - id: mobile-upload
    content: Compact upload action and make parsed review usable without horizontal scrolling.
    status: completed
  - id: mobile-results
    content: Make results answer-first on mobile and collapse refinement/confidence/export detail.
    status: completed
  - id: mobile-modals
    content: Tune help, capabilities, tour, and confirm modals for mobile bottom-sheet/full-width behavior.
    status: completed
  - id: mobile-validation
    content: Run build, guided UI validation, lints, and manual viewport checks after the pass.
    status: completed
isProject: false
---

# Mobile UI Compression Plan

## Direction

**Context:** The app is a document-heavy tax organiser used by non-technical filers on small screens. Mobile should show one obvious action, one clear state, and only the explanation needed at that moment.

**Anchor:** Organic. Keep the current warm surface, green accent, rounded cards, and soft panels. Do not introduce a new theme, icon library, or decorative illustration system.

**Differentiator:** A compact mobile "task stack": each screen becomes a short header, a visual status strip, then one primary card. Explanations collapse behind plain-language toggles.

**Ponytail constraint:** CSS-first, then tiny component changes only where CSS cannot remove text or reorder meaning safely. No new dependencies.

## Phase 1 — Mobile Density System

Files:
- [`webapp/src/styles.css`](webapp/src/styles.css)

Add a dedicated mobile compression layer at `max-width: 620px` and a tighter layer at `max-width: 420px`:

- Reduce app chrome: smaller `stage-single`, `stage-with-sidebar`, `app-header`, `app-footer`, and card padding.
- Add mobile-only spacing tokens using CSS custom properties, e.g. `--mobile-card-pad`, `--mobile-gap`, `--mobile-radius`.
- Gradually reduce type sizes: `h1`, `h2`, `.step-card h2`, `.orientation-prompt`, summary numbers, pills, helper copy.
- Remove large shadows on phone width; use border and surface contrast instead.
- Make primary buttons full-width only when they are the next action; keep tertiary links compact.

Verification:
- `npm run build`
- Visual check at 390px and 360px: no horizontal scroll, no card feels oversized.

## Phase 2 — Mobile Shell And Navigation

Files:
- [`webapp/src/styles.css`](webapp/src/styles.css)
- [`webapp/src/components/SideNav.tsx`](webapp/src/components/SideNav.tsx)

Plan:
- Convert the left rail into a bottom step bar on mobile. Left rails are expensive on narrow screens because they permanently steal 64px.
- Keep the same `SideNav` model: current, done, upcoming, no skip-ahead.
- On mobile, show icon + 1-word labels: `About`, `List`, `Docs`, `Files` or similar. Keep the full desktop labels unchanged.
- Add `padding-bottom` to `.app-shell` on mobile so the fixed bottom nav never covers export buttons.

Verification:
- `npm run validate:guided-ui`
- Manual 360px check: all four steps visible; content width increases after moving nav to bottom.

## Phase 3 — Welcome Screen: Visual Choice, Less Copy

Files:
- [`webapp/src/components/WelcomeScreen.tsx`](webapp/src/components/WelcomeScreen.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

Plan:
- Shorten the mobile headline to a mobile-only version via a visually hidden/visible pair or CSS content strategy only if needed. Preferred text: `Tax documents, sorted.`
- Collapse the three badges into a compact trust row: `No signup`, `Browser-only`, `CSV/Excel/PDF`.
- Remove the `Pick how you'd like to begin` lede on mobile; the cards already communicate choice.
- Make entry cards denser: icon left, title, no subcopy by default. Keep subcopy available on desktop.
- Make `What can this do?` a small secondary chip below the trust row, not in the top-right header where it wraps awkwardly.

Verification:
- Welcome fits above the fold on a 390px viewport except for the final card if a saved-session banner is present.

## Phase 4 — Orientation: Thumb-Friendly Questions

Files:
- [`webapp/src/components/OrientationForm.tsx`](webapp/src/components/OrientationForm.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

Plan:
- Replace `Question X of Y` with a thin progress bar plus small text. Visual progress reads faster than a counter.
- Hide the reassurance note after the first question on mobile, or move it into a small lock/privacy chip.
- Shorten optional question helpers where possible. Example: HUF helper becomes `Not sure? Skip it.` on mobile.
- Reduce option button padding but keep 44px minimum tap height.
- Move `Start over` into a collapsed `More` area or keep it below Back as a danger text link. It should not compete with answering.

Verification:
- Orientation question, two answer buttons, Back, and Skip fit without excessive scroll at 390px.

## Phase 5 — Checklist: Status Cards, Collapsed Detail

Files:
- [`webapp/src/components/ChecklistPanel.tsx`](webapp/src/components/ChecklistPanel.tsx)
- [`webapp/src/components/DocumentSourceHint.tsx`](webapp/src/components/DocumentSourceHint.tsx)
- [`webapp/src/App.tsx`](webapp/src/App.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

Plan:
- On mobile, turn `Things to check` into a compact status strip: open count, most urgent item, and expand control.
- In the main checklist step, collapse each row's `whyNeeded` and `DocumentSourceHint` behind `Where to get this`.
- Remove repetitive subheaders on mobile: `Heads up`, `Check these`, `Still needed` can become visual groups with icon/pill markers, not headings.
- If a document is loaded/needed, use status pills and icons more prominently than explanatory paragraphs.

Verification:
- Checklist step first viewport shows: title, open count, first 2-3 document rows, and the continue action path.

## Phase 6 — Upload: One Big Action, Then Compact Review

Files:
- [`webapp/src/components/UploadStep.tsx`](webapp/src/styles.css)
- [`webapp/src/styles.css`](webapp/src/styles.css)

Plan:
- Shorten upload lede on mobile to one line: `Add one statement at a time. We'll show what we read before using it.`
- Make the dropzone a compact action card, not a tall dashed box.
- Hide folder-saving explanation behind `Save to a folder instead` unless already selected.
- For the PDF extraction prompt, show three visual steps as numbered chips and keep the full prompt collapsed.
- Replace the mobile preview table with row cards if CSS column hiding still leaves cramped editing. Each card: scrip, dates, gain/class, `Edit details` disclosure.

Verification:
- Upload empty state has one obvious action.
- Parsed preview at 360px is usable without horizontal scrolling.

## Phase 7 — Results: Answer First, Collapse The Rest

Files:
- [`webapp/src/components/ResultsStep.tsx`](webapp/src/components/ResultsStep.tsx)
- [`webapp/src/components/RegimeComparisonPanel.tsx`](webapp/src/components/RegimeComparisonPanel.tsx)
- [`webapp/src/components/AdvanceTaxPanel.tsx`](webapp/src/components/AdvanceTaxPanel.tsx)
- [`webapp/src/components/ReconciliationPanel.tsx`](webapp/src/components/ReconciliationPanel.tsx)
- [`webapp/src/components/ConfidenceReportPanel.tsx`](webapp/src/components/ConfidenceReportPanel.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

Plan:
- Make the CA/self-file recommendation a compact hero pill plus one sentence, not a banner block.
- Convert summary rows into mobile stat cards: label, amount, small `Why?` disclosure.
- Default `Add more numbers to refine` closed on mobile. Desktop can remain open.
- Inside refinement, split into closed accordions: `Income you type in`, `Old vs new regime`, `Advance tax`, `AIS/TDS check`.
- Collapse confidence report groups by default on mobile; show only counts and severity labels first.
- Export section becomes a sticky-ish final action block when in view: primary XLSX, secondary full workbook, CSV tucked under `Other format`.

Verification:
- First results viewport shows recommendation + at least 3 key summary rows.
- Export block remains readable at 360px.

## Phase 8 — Modals And Dense Panels

Files:
- [`webapp/src/components/HelpPanel.tsx`](webapp/src/components/HelpPanel.tsx)
- [`webapp/src/components/CapabilitiesPanel.tsx`](webapp/src/components/CapabilitiesPanel.tsx)
- [`webapp/src/components/ToolTour.tsx`](webapp/src/components/ToolTour.tsx)
- [`webapp/src/components/ConfirmModal.tsx`](webapp/src/components/ConfirmModal.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

Plan:
- On mobile, modals should behave like bottom sheets or full-width cards with tighter padding.
- Capabilities/help lists should show headings only first, with details collapsed.
- Tool tour slides should use short bullets and existing icons; avoid adding decorative assets.
- Confirm modal should keep destructive action below cancel on mobile to avoid accidental taps.

Verification:
- Each modal fits on a 390px screen with primary action visible without awkward nested scrolling.

## Phase 9 — Validation And Simplification

Run after each high-risk phase:
- `npm run build`
- `npm run validate:guided-ui`
- `ReadLints` on edited files

Manual mobile checks:
- 390x844 and 360x740 viewport
- Welcome, orientation, upload empty, upload preview, checklist, results simple, results export, help/capabilities modal

Simplification pass before final:
- Remove low-value mobile-only text if the visual state communicates it.
- Avoid duplicating mobile and desktop markup unless CSS cannot preserve accessibility.
- Keep existing component boundaries; add helper components only for repeated accordion/card patterns used at least twice.

## Explicit Non-Goals

- No new design system or icon dependency.
- No dark mode in this pass.
- No generated illustrations or new image assets.
- No tax logic changes.
- No backend/storage changes.