---
name: Design Fixes All 25
overview: "Fix all 25 design audit findings across 4 sequential batches. Anchor: Organic (existing tokens hold — warm bg, green accent, 24px radius, Inter). Differentiator: summary-first reveal on Results — the user gets their answer before any form appears. Batches are ordered by risk; each medium/hard batch has a defined test gate before moving on."
todos:
  - id: batch1
    content: "Batch 1: text, labels, copy, styles — WelcomeScreen, OrientationForm, ChecklistPanel, ResultsStep, styles.css. Test all 5 screens."
    status: completed
  - id: batch2a
    content: "Batch 2a: ConfirmModal.tsx (new) + App.tsx startFresh wiring. Test: no browser dialog."
    status: completed
  - id: batch2b
    content: "Batch 2b: UploadStep loading state (parsing boolean + hint). Test: 'Reading file...' appears."
    status: completed
  - id: batch2c
    content: "Batch 2c: UploadStep — disable Continue when 0 docs + empty state hint. Test: button greyed."
    status: completed
  - id: batch2d
    content: "Batch 2d: UploadStep — inline AI extraction prompt in paste panel. Test: file path reference gone."
    status: completed
  - id: batch3a
    content: "Batch 3a: ResultsStep reorder — summary first, supplemental/regime/reconciliation inside <details>. Test: summary visible above forms."
    status: completed
  - id: batch3b
    content: "Batch 3b: ResultsStep export hierarchy — XLSX primary, full workbook secondary, CSV text. Test: visual hierarchy correct."
    status: completed
  - id: batch3c
    content: "Batch 3c: UploadStep — real drag-and-drop + isDragOver visual state. Test: drag activates green border, drop parses file."
    status: completed
  - id: batch3d
    content: "Batch 3d: styles.css — hide 3 upload table columns on mobile. UploadStep table: add col-* classNames. Test: 375px, 6 columns, no h-scroll."
    status: completed
  - id: batch4
    content: "Batch 4: mobile side nav labels, checklist toggle chevron, supplemental field plain labels, export success state. Test at 375px viewport."
    status: completed
isProject: false
---

# Design Fixes — All 25 Findings

## Anchor & differentiator

**Anchor: Organic** — existing tokens already live in this range (`--bg: #f4f5f1`, `--accent: #1c9a5b`, `--radius-lg: 24px`, Inter). No token drift. All new UI elements (confirm modal, loading state, success badge) use the same set.

**Differentiator:** Summary-first progressive reveal on Results. CA recommendation + key numbers appear at the top; supplemental forms and reconciliation panels move below a "Refine these numbers" heading. The page answers the question first, then offers depth.

---

## Batch 1 — Text, labels, copy, styles (low effort — fix all together, one test pass at end)

All changes are pure text/className/CSS. No logic, no new components.

### Files touched
- [`webapp/src/components/WelcomeScreen.tsx`](webapp/src/components/WelcomeScreen.tsx)
- [`webapp/src/components/OrientationForm.tsx`](webapp/src/components/OrientationForm.tsx)
- [`webapp/src/components/ChecklistPanel.tsx`](webapp/src/components/ChecklistPanel.tsx)
- [`webapp/src/components/ResultsStep.tsx`](webapp/src/components/ResultsStep.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

### Changes

**WelcomeScreen.tsx**
- Rename "Start with Computation" → "Add documents" (sub-label: "Skip the questions. Upload and see your numbers.")
- Badge: `"Most File Formats"` → `"CSV, Excel, HTML — PDF needs one extra step"`
- Add below badges: `<p className="welcome-time-estimate">Most people finish in 15–20 minutes.</p>`
- `"What can this do?"` text-button → secondary outlined button (new class `.secondary-button` in styles.css)

**OrientationForm.tsx**
- Move reassurance note `"Answers only shape what's asked next..."` from the nav row to just below the progress counter (above the prompt h2)
- HUF helper text: change `orientation-helper` class to use `--ink` color (not `--muted`) so it reads at the same weight as the prompt
- `"Start over"` button: replace `primary-button` with new `danger-button` class; move to the far left of nav row (swap positions with Back)

**ChecklistPanel.tsx**
- `"Known limits for your profile"` → `"Heads up — this tool has limits"`
- `"Worth a closer look"` → `"Check these before filing"`
- `"Still missing"` → `"Still needed"`

**ResultsStep.tsx**
- Move `<p className="closing-note">` block above the `<div className="export-actions">` — it answers "which file do I need?" before the buttons that force that choice
- Add a plain-English line above the export buttons: `"Give the CA Summary to your CA. Keep the full workbook for your own records."`

**styles.css**
- `.danger-button`: `border: 1.5px solid var(--flag); background: transparent; color: var(--flag); border-radius: var(--radius-pill); padding: 9px 18px; font-weight: 700;` with hover darkening
- `.secondary-button`: outlined variant of primary (border + accent color, white bg)
- `.welcome-time-estimate`: `color: var(--muted); font-size: 0.9rem;`
- `.orientation-helper`: change `color` from `var(--muted)` to `var(--ink)`; keep font-size
- `.app-footer`: add `border-top: 2px solid var(--line)` and increase `font-size` of `.footer-scope-note` to `0.88rem` with `color: var(--ink)` (not muted) to distinguish legal scope from closing copy

### Test gate (Batch 1)
Run dev server, visually verify all 5 screens. Confirm: no muted helper on HUF, danger-style Start over, correct category names in sidebar, closing note above export buttons, secondary button on welcome.

---

## Batch 2 — Small interaction changes (medium effort — test each fix before moving to next)

### Files touched
- New: [`webapp/src/components/ConfirmModal.tsx`](webapp/src/components/ConfirmModal.tsx)
- [`webapp/src/App.tsx`](webapp/src/App.tsx)
- [`webapp/src/components/UploadStep.tsx`](webapp/src/components/UploadStep.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

### Fix 2a — Replace `window.confirm` with in-app modal
New `ConfirmModal.tsx`: minimal, reuses `.modal-backdrop` + `.modal-card` + `.modal-actions` classes already in styles.css. Props: `{ message, onConfirm, onCancel }`. Danger button for confirm, text-button for cancel.

In `App.tsx`, `startFresh()` sets a `showConfirmClear` boolean state; renders `<ConfirmModal>` when true.

**Test:** Click "Start over" mid-flow → in-app modal appears (not browser dialog). Confirm clears state. Cancel dismisses.

### Fix 2b — Loading state in UploadStep
Add `const [parsing, setParsing] = useState(false)` to UploadStep. Set true before `parseFile(file)`, false after (in both success and catch paths). While `parsing`, show a `<p className="upload-parsing-hint">Reading file...</p>` in place of the dropzone area. Add `.upload-parsing-hint` to styles.css (muted italic, centered).

**Test:** Upload a large CSV → "Reading file..." appears, then modal shows.

### Fix 2c — Disable "Continue" when 0 documents
In UploadStep, add `disabled={documents.length === 0}` to the Continue button. When disabled, show below it: `<p className="upload-empty-hint">Add at least one document to continue.</p>` (small muted text). Style via `.upload-empty-hint` in styles.css.

**Test:** 0 docs → button greyed and hint visible. Add 1 doc → button active, hint gone.

### Fix 2d — Inline AI extraction prompt in paste panel
Replace the `<li>Copy the prompt from <code>prompts/01-extract-statement.md</code>.</li>` instruction. Instead, add a `<details>` block labelled "Show the extraction prompt" that contains the actual prompt text inline (or at minimum a direct anchor link to the raw file on GitHub, not a local path). The prompt text is short enough to inline in a `<pre>` inside the details block.

**Test:** Upload a PDF → paste panel appears → "Show the extraction prompt" expands to reveal copyable prompt text. File path reference is gone.

---

## Batch 3 — Layout and interaction (hard effort — test each fix before moving to next)

### Files touched
- [`webapp/src/components/ResultsStep.tsx`](webapp/src/components/ResultsStep.tsx)
- [`webapp/src/components/UploadStep.tsx`](webapp/src/components/UploadStep.tsx)
- [`webapp/src/styles.css`](webapp/src/styles.css)

### Fix 3a — Results page reorder (summary-first)
Reorder sections in `ResultsStep.tsx`:

**Before:** CA banner → supplemental form → regime comparison → reconciliation → summary → confidence → export

**After:** CA banner → summary rows → `<details>` "Refine these numbers" (wrapping: supplemental form + regime comparison + reconciliation) → confidence → export

The summary rows are the answer. The supplemental forms are optional refinement. Wrapping them in a `<details>` element with `open` as default (so they start expanded) keeps the content accessible while making the visual hierarchy clear. The `<details>` label: "Add more numbers to refine (optional)" in a style similar to `.step-lede`.

**Test:** Load Results with sample data → CA recommendation visible, key numbers visible, forms below. Toggle `<details>` closed → forms hide, summary still visible.

### Fix 3b — Export button hierarchy
In `ResultsStep.tsx` export section, change button classes:
- "Download CA Summary XLSX" → `primary-button` (most people need this one)
- "Download full workbook" → `secondary-button` (keep, your own record)
- "Download CA Summary CSV" → `text-button` (advanced/fallback, de-emphasise)

Reorder to: XLSX (primary) → full workbook (secondary) → CSV (text link). The explanation note (from Batch 1) sits immediately above all three.

**Test:** Results page → XLSX button is green/filled, full workbook is outlined, CSV is a text link.

### Fix 3c — Real drag-and-drop on upload dropzone
In `UploadStep`, add `onDragOver` (preventDefault), `onDrop` (preventDefault, extract `event.dataTransfer.files`, call `handleFile`), and `onDragEnter`/`onDragLeave` to toggle an `isDragOver` boolean state. Add `className={isDragOver ? "upload-dropzone upload-dropzone-active" : "upload-dropzone"}`. Add `.upload-dropzone-active` to styles.css: `border-color: var(--accent); background: var(--accent-soft);`. Update the hint text to say "Drop a file here, or click to choose."

**Test:** Drag a CSV over the zone → border turns green. Drop → file parsed and modal appears.

### Fix 3d — Upload modal table: mobile responsive
In styles.css, at `max-width: 620px`:
```css
.preview-table-editable .col-units,
.preview-table-editable .col-buy,
.preview-table-editable .col-sell { display: none; }
```
Add corresponding `className` props to the `<th>` and `<td>` elements in the table in UploadStep.tsx. On mobile: Scrip / Purchase date / Sell date / Gain / Class / Remove — 6 columns instead of 9.

**Test:** Resize to 375px → 6 columns visible, no horizontal scroll, all rows legible.

---

## Batch 4 — Mobile nav and polish (medium effort — test at mobile viewport)

### Files touched
- [`webapp/src/styles.css`](webapp/src/styles.css)
- [`webapp/src/components/SideNav.tsx`](webapp/src/components/SideNav.tsx)
- [`webapp/src/components/RegimeComparisonPanel.tsx`](webapp/src/components/RegimeComparisonPanel.tsx)
- [`webapp/src/components/ChecklistPanel.tsx`](webapp/src/components/ChecklistPanel.tsx)

### Fix 4a — Mobile side nav labels
Remove `display: none` on `.side-nav-label` at 640px breakpoint. Instead reduce to `font-size: 0.5rem; letter-spacing: 0; line-height: 1.1;`. Also reduce `.side-nav` width from 56px to 64px at mobile to accommodate the tiny label below the icon.

**Test:** 375px viewport → all 4 step labels visible below their icons.

### Fix 4b — Checklist toggle more prominent on mobile
In `ChecklistPanel.tsx`, add a chevron SVG (↓/↑, inline, no library) to the toggle button. In styles.css, update `.checklist-toggle` padding to `6px 16px` and add `gap: 6px; display: inline-flex; align-items: center;`.

**Test:** 375px viewport → toggle button has chevron icon, collapses/expands correctly.

### Fix 4c — Supplemental field labels: plain English
In `ResultsStep.tsx`, update `SUPPLEMENTAL_FIELDS` labels:
- `"Eligible interest deduction (80TTA/80TTB)"` → `"Interest deduction (savings/FD — Section 80TTA/B)"`
- `"Carry-forward losses available"` → `"Losses you're carrying forward from a previous year"`
- `"Deductible transaction charges"` → `"Brokerage/STT charges you can deduct"`

Add `placeholder="₹0"` to all supplemental and regime inputs that don't already have one.

**Test:** Results page supplemental section — labels read plainly, ₹ placeholder visible in empty inputs.

### Fix 4d — Export success state
In `ResultsStep.tsx`, expose a new `lastExport` prop (or lift the exportMessage logic slightly). After any export, prefix `exportMessage` with a visual signal. Change the `<p className="export-message">` to conditionally add `export-message-success` class when the message doesn't start with "Exports are generated". In styles.css: `.export-message-success { color: var(--good); font-weight: 600; }`. Prepend "✓ " to the message string in each of the three export handler functions in `App.tsx`.

**Test:** Click any download → message turns green with checkmark.

---

## Test strategy

| Batch | Effort | Gate |
|-------|--------|------|
| 1 | Low | Visual pass all 5 screens in browser |
| 2a | Medium | Confirm modal replaces browser dialog |
| 2b | Medium | Loading state visible on file select |
| 2c | Medium | Continue disabled with 0 docs |
| 2d | Medium | PDF paste panel shows inline prompt |
| 3a | Hard | Results: summary visible above forms |
| 3b | Hard | Export button hierarchy correct |
| 3c | Hard | Drag-and-drop works, visual feedback |
| 3d | Hard | 375px modal: 6 columns, no h-scroll |
| 4 | Medium | All 4 fixes at 375px viewport |

**Skipped:** Dark mode (too large, separate milestone). `#21` from audit (no illustration/empty state art — would require asset creation outside scope).
