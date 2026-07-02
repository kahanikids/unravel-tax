I'm sharing one document — it could be a PDF, an Excel file, a CSV, a
saved webpage, or pasted text. Read it and output ONLY a table with these
exact columns, one row per transaction:

Scrip/Fund Name | Purchase Date | Sell Date | Units | Buy Value | Sell
Value | Buy Price | Sell Price

Rules:
- If the source has more than one table (common in saved broker
  webpages), use the one that actually contains transaction rows, not a
  summary or disclaimer table — tell me which one you used.
- If the file has subtotal or summary rows mixed in with transaction
  rows, drop the subtotal rows — I only want individual transaction
  lines.
- Use DD-MMM-YYYY date format.
- Do not classify long-term/short-term yourself, and do not calculate
  gains yourself — that logic lives elsewhere and runs the same way every
  time, which matters more than doing it here.
- If any transaction is missing a purchase date or sell date, flag it in
  a separate line after the table instead of guessing.
- Output the table in a format I can copy straight into a spreadsheet
  (tab-separated or markdown table, your choice, just tell me which).
- End with one line summarizing what you read and how confident you are,
  so I can decide whether to double-check before using this.
