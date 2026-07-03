# NRI — NRE vs NRO accounts

**Applies to:** NRI profile
**Last verified:** 2026-07-03, against the Income Tax Department's own
exempt-income page (see `source_refs` in the paired JSON).

## What this covers

NRE and NRO are both rupee accounts an NRI can hold in an Indian bank,
but the tax treatment is completely different, and mixing them up is the
single most common NRI filing mistake this tool guards against.

**NRE (Non-Resident External)** holds money earned outside India and
remitted in. Interest on it is fully exempt from Indian income tax under
Section 10(4)(ii), and the bank deducts no TDS on it at all.

**NRO (Non-Resident Ordinary)** holds India-sourced income: rent,
dividends, pension, sale proceeds, and similar. Interest on it is fully
taxable in India at slab rates, and the bank withholds TDS under
Section 195, commonly at a high flat rate before any DTAA relief is
applied.

## What this tool calculates vs. what still needs a CA

The tool lets you enter NRE interest as its own line, shown as exempt and
kept out of your taxable "Interest & other income" total, so it's no
longer silently missing or wrongly taxed. It still doesn't apply DTAA
relief to reduce NRO TDS, track repatriation limits, or reconcile the
exact TDS rate the bank should have withheld. Bring your NRO TDS
certificates and any DTAA paperwork to a CA for those.
