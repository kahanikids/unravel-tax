I'm organizing my own data to file an Indian income-tax return. I'm sharing
one document — it could be a PDF, an Excel file, a CSV, a saved webpage, or
pasted text. It might be any kind of statement: a broker or mutual-fund
capital-gains statement, a profit-and-loss statement, a PMS annual report, a
bank statement, a dividend or interest statement, an insurance statement, a
loan interest certificate, an Annual Information Statement (AIS), or a
consolidated account statement.

A separate tool does all the tax maths deterministically. Your job is only to
READ this document and hand back what it actually says, in ONE fixed JSON
format, so the tool can classify and total it the same way every time. Do NOT
decide whether a gain is short-term or long-term, and do NOT calculate any gain
or tax yourself — that logic lives in the tool. The tool works out the holding
period (and so the short-term/long-term split) from the purchase and sell
dates, which is why per-transaction detail matters.

== What to output ==

Output ONLY a single JSON object matching the schema below. No prose before or
after it — put any commentary inside the "notes" field so the whole reply is
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
    "deductibleCharges": null
  },
  "netRealisedCapitalGainNoDetail": null,
  "confidence": "high, medium, or low",
  "notes": "free text: what you read, any holdings-only warning, any missing per-transaction detail, anything I should double-check"
}
```

== Rules ==

- capitalGainsTransactions: one object per individual buy-and-sell transaction.
  Only include an item if you have its actual per-trade details. Use
  DD-MMM-YYYY for dates. Give amounts as plain numbers — no ₹ sign, no commas
  (write 1234.5, not "₹1,234.50"). If the source has several tables (common in
  saved broker webpages), use the one with real transaction rows, not a summary
  or disclaimer table, and say which in "notes". Drop subtotal/summary rows. If
  a transaction is missing a purchase or sell date, leave that date out and
  mention it in "notes" rather than guessing.
- NEVER invent transaction rows. If the only capital-gains figure available is
  a net or aggregate realised gain WITHOUT per-transaction buy/sell dates, leave
  capitalGainsTransactions empty, put that number in
  "netRealisedCapitalGainNoDetail", and say in "notes" that the detailed
  per-transaction capital-gains statement is still needed to classify the gains
  as short-term vs long-term.
- HOLDINGS ARE NOT SALES. If the document only lists securities held as on a
  date (quantity and value, no sale), do NOT put them in
  capitalGainsTransactions. Note in "notes" that this is a holdings statement,
  not a capital-gains realisation statement.
- annualFigures: fill any annual totals the document gives (dividend income,
  interest income, TDS already deducted, deductible charges such as brokerage /
  PMS fees / STT / custodian or admin charges). Leave anything not stated as
  null. Plain numbers, no ₹ or commas.
- confidence: your honest read of how complete and clear the document was.
- notes: a short line summarizing what you read and anything worth
  double-checking.

Output the single JSON object now, and nothing else.
