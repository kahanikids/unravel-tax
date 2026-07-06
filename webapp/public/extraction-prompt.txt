I'm organizing my own data to file an Indian income-tax return. I'm sharing
one document. It could be a PDF, an Excel file, a CSV, a saved webpage, or
pasted text. It might be any kind of statement: a broker or mutual-fund
capital-gains statement, a profit-and-loss statement, a PMS annual report, a
bank statement, a dividend or interest statement, an insurance statement, a
loan interest certificate, an Annual Information Statement (AIS), or a
consolidated account statement.

A separate tool does all the tax maths deterministically. Your job is only to
READ this document and hand back what it actually says, in ONE fixed JSON
format, so the tool can classify and total it the same way every time. Do NOT
decide whether a gain is short-term or long-term, and do NOT calculate any gain
or tax yourself. That logic lives in the tool. The tool works out the holding
period (and so the short-term/long-term split) from the purchase and sell
dates, which is why per-transaction detail matters.

== What to output ==

Output ONLY a single JSON object matching the schema below. No prose before or
after it. Put any commentary inside the "notes" field so the whole reply is
one JSON block I can copy and paste back. Fill in the fields you can find from
the document and OMIT or set to null anything the document doesn't give.

```
{
  "documentType": "short description of what this statement is, e.g. 'PMS annual report', 'broker capital gains statement', 'bank interest certificate'",
  "capitalGainsTransactions": [
    {
      "scripName": "name of the share or fund",
      "purchaseDate": "DD-MMM-YYYY",
      "sellDate": "DD-MMM-YYYY",
      "units": 0,
      "buyValue": 0,
      "sellValue": 0,
      "buyPrice": 0,
      "sellPrice": 0,
      "instrumentType": "equity or debt_mutual_fund (optional; leave out if unsure)"
    }
  ],
  "annualFigures": {
    "dividendIncome": null,
    "interestIncome": null,
    "tdsDeducted": null,
    "deductibleCharges": null,
    "speculativeGain": null,
    "shortTermCapitalGains": null,
    "longTermCapitalGains": null,
    "debtOrSpecifiedMutualFundGains": null,
    "totalCapitalGains": null
  },
  "netRealisedCapitalGainNoDetail": null,
  "confidence": "high, medium, or low",
  "notes": "free text: what you read, any holdings-only warning, any missing per-transaction detail, anything I should double-check"
}
```

== Rules ==

- capitalGainsTransactions: one object per individual buy-and-sell transaction.
  Only include an item if you have its actual per-trade details. Use
  DD-MMM-YYYY for dates. Give amounts as plain numbers, with no ₹ sign and no commas
  (write 1234.5, not "₹1,234.50"). If the source has several tables (common in
  saved broker webpages), use the one with real transaction rows, not a summary
  or disclaimer table, and say which in "notes". Drop subtotal/summary rows. If
  a transaction is missing a purchase or sell date, leave that date out and
  mention it in "notes" rather than guessing.
- NEVER invent transaction rows. If the document gives summary totals such as
  SPEC GAIN, ST GAIN, LT GAIN, Total Gain, short-term gain, long-term gain,
  equity short term, equity long term, debt/specifed mutual fund gain, or similar
  labels, put those exact totals in annualFigures even when there are no
  per-transaction rows. Do not force them into transaction rows.
- If the only capital-gains figure available is one unsplit net or aggregate
  realised gain WITHOUT per-transaction buy/sell dates and WITHOUT a stated
  short-term/long-term split, leave capitalGainsTransactions empty, put that
  number in "netRealisedCapitalGainNoDetail", and say in "notes" that the
  detailed per-transaction capital-gains statement is still needed.
- HOLDINGS ARE NOT SALES. If the document only lists securities held as on a
  date (quantity and value, no sale), do NOT put them in
  capitalGainsTransactions. Note in "notes" that this is a holdings statement,
  not a capital-gains realisation statement.
- annualFigures: Extract any annual or period totals for non-capital-gains items (dividend income, interest income, TDS already deducted, deductible charges such as brokerage / PMS fees / STT / custodian or admin charges) as well as capital-gains summary splits.
  - If the document lists multiple individual dividend entries, interest credits, or TDS rows instead of a single total, sum them up yourself and put the total in the respective "annualFigures" field. For example, sum all "Dividend Paid" / "Div Amt" / "Dividend" entries into "dividendIncome", all "Interest Paid" / "Int Credited" into "interestIncome", and all TDS/tax deducted entries into "tdsDeducted".
  - Be flexible with labels:
    - Dividend / Dividend payout / Dividend received / Div -> dividendIncome
    - Interest / Saving Interest / FD Interest / Int. Recd / Int -> interestIncome
    - Tax Deducted at Source / TDS / WH Tax / WhTax -> tdsDeducted
    - Brokerage / STT / Custody fee / PMS Fee / Management fee / AMC Fees -> deductibleCharges
    - ST Gain / Short Term / Short-Term Capital Gain -> shortTermCapitalGains
    - LT Gain / Long Term / Long-Term Capital Gain -> longTermCapitalGains
    - Spec Gain / Speculative / Intraday -> speculativeGain
    - Total Gain / Net Gain -> totalCapitalGains
  - Leave anything not stated as null. Use plain numbers, with no ₹ or commas.
- confidence: your honest read of how complete and clear the document was.
- notes: one short sentence only (under 200 characters). Do not repeat yourself or
  list every row.
- Broken-line PDF text: a single transaction row often spans several lines. Scrip
  name on one line, purchase and sell dates on the next lines, units and values on
  another. Dates on following lines still belong to the SAME transaction. Match
  dates to the units and buy/sell values that appear on the same row or within the
  next few lines. When two dates belong to one transaction, the earlier date is the
  purchase date and the later date is the sell date.
- JSON hygiene: use JSON null for absent values. NEVER write the string "null".
  Output valid JSON only. No markdown code fences around the JSON.

Output the single JSON object now, and nothing else.
