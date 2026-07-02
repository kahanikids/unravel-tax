# Excel export template

Created: `UnravelTax-Template.xlsx`.

This is the Excel-native equivalent of the future Google Sheets master
template, for users who prefer Excel or work offline
(SYSTEM_SPEC.md Section 4). It is generated from
`scripts/build-template.mjs` and seeded only with synthetic fixture data.

Validation:

- `scripts/verify-template.mjs` checks required sheets and visible formula
  error markers.
- Key preview sheets were rendered during M1B: `CA Summary`,
  `Detailed Summary`, and `Working - Sample Broker`.
