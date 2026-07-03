# Production QA Audit Report

Audit date: 2026-07-04. Method: static code review + automated validators (no live browser).

## Verdict summary

| # | Dimension | Verdict | Severity | Fix status |
|---|-----------|---------|----------|------------|
| A | Lightweight | Minor gaps | P2 | Fixed: PDF lazy-load in Dashboard |
| B | Data leakage | Strong | — | No fix needed |
| C | Error logging | Was gap | P1 | Fixed: ErrorBoundary + dev-only console |
| D | Stuck-user recovery | Mostly good | P1 | Fixed via ErrorBoundary; flow already solid |
| E | Open-source feel | Strong | P3 | Fixed: LICENSE copyright aligned |
| F | Legality | Strong | P2 | Fixed: Stage-1 dismissible banner |
| G | UI / premium feel | Good (static) | P2 | Partial: focus ring; visual checklist below |

---

## A — Lightweight

**Findings**
- Dependencies are lean (React + 4 small libs). No UI framework bloat.
- Production build: main JS ~570 KB minified (~182 KB gzip) before fix; pdfjs ~365 KB + 1.38 MB worker.
- **Issue:** [`Dashboard.tsx`](webapp/src/components/Dashboard.tsx) statically imported `pdfExtract`, pulling pdfjs into the initial load even when the user never opens the dashboard or uploads a PDF.

**Fix:** Dynamic `import("../ingest/pdfExtract")` only when an ITR-V PDF is uploaded on the dashboard.

**Verify:** `npm run build` — main chunk should no longer include pdfjs; separate `pdf-*.js` chunk loads on demand.

---

## B — Data leakage (local + GitHub Pages)

**Findings**
- Only runtime network call: same-origin `fetch(extraction-prompt.txt)` in UploadStep (static asset bundled with the app).
- No analytics, telemetry, Sentry, PostHog, or external CDN scripts in [`index.html`](webapp/index.html).
- No external fonts or CSS `@import` URLs.
- pdfjs worker bundled locally, not from a CDN.
- Persistence: localStorage + optional user-chosen folder only.
- GitHub URLs in copy/rules are links for humans to click, not runtime requests.

**Verdict:** No client-side data exfiltration. User-pasted AI extraction is the only out-of-app path and is disclosed in legal copy.

---

## C — Error logging

**Findings (before fix)**
- No React ErrorBoundary — uncaught render errors white-screened the app.
- No logging strategy (appropriate for no-backend; dev-only `console.error` added in boundary).

**Fix:** [`ErrorBoundary.tsx`](webapp/src/components/ErrorBoundary.tsx) wraps `<App />` in [`main.tsx`](webapp/src/main.tsx). Recovery screen: reload, report issue, view source.

**User-facing ingest errors:** Already strong (parse_error, invalid-number warnings, graceful PDF/JSON fallbacks).

---

## D — Stuck-user recovery

**Findings**
- Single-next-action design per BUILD_PLAN §1: welcome cards, one orientation question at a time, upload continue/skip, results recommendation + exports.
- Empty states guide next step (`upload-empty-hint`, summary-only auto-navigate to results).
- Form-changing triggers use blocking modal with acknowledge.
- **Gap (fixed):** Runtime crash left user with no recovery path.

**Note:** GitHub Pages SPA has no client-side router — refresh returns to app root (acceptable for this static app).

---

## E — Open-source feel

**Present:** MIT LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG, ROADMAP, issue templates, PR template, README badges, inspectable `rules/*.json` + `.md` pairs, GitHub links in footer and welcome.

**Nit fixed:** LICENSE copyright updated from "India Tax Assistant" to "Unravel Tax contributors" to match product name.

---

## F — Legality

**Findings**
- Comprehensive in-app legal: [`copy.ts`](webapp/src/lib/copy.ts) `LEGAL_INTRO` + `LEGAL_SECTIONS` (not-advice, no affiliation, AI use, privacy, terms, jurisdiction, OSS license, contact).
- [`DISCLAIMER.md`](DISCLAIMER.md) exists; README references it.
- FY 2025-26 / AY 2026-27 scope consistent across footer, legal sections, exports, validators.

**Gap (fixed):** BUILD_PLAN §1.4 requires a Stage-1 dismissible banner remembered afterward. Was only in collapsible legal block at page bottom.

**Fix:** [`WELCOME_DISCLAIMER_BANNER`](webapp/src/lib/copy.ts) + dismissible banner on welcome screen (`localStorage` key `unravel-tax-welcome-disclaimer-dismissed`). Dismissal read in `useEffect` so SSR/validators see the banner on first paint.

---

## G — UI / workflow (static assessment)

**Strengths**
- CSS design tokens in `:root` (colours, radii, shadow, font stack).
- Simple-by-default enforced (results + dashboard; advanced behind explicit toggle).
- Responsive breakpoints at 620px and 860px.
- Focus-visible rings on key interactive elements (side nav, cards, footer links; primary button added).

**Limitations (need live visual pass)**
- Spacing rhythm, hover polish, and mobile overflow can only be fully judged in a browser.
- See [`docs/QA_VISUAL_CHECKLIST.md`](QA_VISUAL_CHECKLIST.md).

**Static nit:** `--font-body` lists Inter first but no webfont is loaded — falls back to system UI (good for privacy/weight; intentional).

---

## Residual risks (not fixed in this pass)

| Item | Severity | Notes |
|------|----------|-------|
| Bundle still ~180 KB gzip without PDF | P3 | Acceptable for a tax tool with Excel export |
| No `npm audit` run | P3 | Recommend periodic dependency scan |
| Prefill banners not persisted on resume | P3 | Documented product choice |
| TDS auto-fill vs reconciliation double-count | P2 | Needs design if both used |
| Visual premium feel | P2 | User visual pass required |

---

## Validation commands

```bash
python scripts/validate-rule-pairs.py
cd webapp && npm run lint && npm run validate:all && npm run build
```
