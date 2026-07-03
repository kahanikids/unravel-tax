# Visual QA Checklist

Run on **local dev** (`cd webapp && npm run dev`) and **GitHub Pages** after deploy. Use synthetic fixtures only.

## Welcome and first impression

- [ ] Stage-1 disclaimer banner shows on first visit; "Got it" dismisses and stays dismissed on reload
- [ ] Three entry cards are equal weight; no clutter or dev jargon
- [ ] Legal collapsible opens; GitHub + report-issue links work
- [ ] Mobile (≤620px): title, badges, and cards fit without horizontal scroll

## Guided flow

- [ ] Orientation: one question at a time; back/edit works from recap
- [ ] NRI path: country question; resident-only questions hidden
- [ ] Upload: drop zone, file list, review modal blocks until confirmed
- [ ] Summary-only JSON paste: auto-fill + navigate to results
- [ ] Skip upload path works when no capital gains

## Results and exports

- [ ] Simple view is default; "Show full detail" reveals advanced
- [ ] "A few more numbers" opens when prefilled or net-gain-only gap
- [ ] CA Summary CSV and full workbook download
- [ ] Recommendation banner (CA vs self-file) is plain language

## Recovery and errors

- [ ] Trigger a bad paste: plain-language error, not a dead end
- [ ] (Optional) DevTools: force a render error — ErrorBoundary recovery screen appears

## Dashboard

- [ ] Opens from side nav; widgets readable in simple mode
- [ ] ITR-V PDF upload only loads PDF library when used (Network tab: no pdf chunk on welcome)

## Footer and trust

- [ ] FY 2025-26 scope line visible on every screen
- [ ] Footer disclaimer readable on desktop; collapsible on mobile
- [ ] No third-party network requests except same-origin assets (check Network tab)

## Premium feel (subjective)

- [ ] Consistent green accent, rounded cards, adequate whitespace
- [ ] Buttons have visible focus ring when tabbing
- [ ] No raw HTML tables or unstyled modals breaking the visual system
- [ ] Countdown banner + help button align on mobile header
