#!/usr/bin/env node
/**
 * Score extraction JSON against fixtures/sample-broker-statement.csv ground truth.
 * Usage: node spike/score-extraction.mjs spike/fixtures/gemma.json spike/fixtures/llama.json
 * Or pipe: echo '{...}' | node spike/score-extraction.mjs -
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePdfText = readFileSync(
  resolve(repoRoot, "fixtures", "sample-pdf-extracted-text.txt"),
  "utf8"
);

function postProcessExtractionRaw(rawText, sourceText) {
  const jsonText = extractJsonBlock(rawText);
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return jsonText;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return jsonText;
  }

  const DATE_TOKEN =
    /\b(\d{1,2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/](\d{4})\b/gi;
  const MONTHS = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11
  };

  const normalizeDateToken = (day, month, year) => {
    const monthKey = month.slice(0, 3).toLowerCase();
    const monthIndex = MONTHS[monthKey];
    const monthFormatted =
      monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
    return `${String(Number(day)).padStart(2, "0")}-${monthFormatted}-${year}`;
  };

  const parseExtractionDate = (value) => {
    const match = String(value).trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!match) return 0;
    const month = MONTHS[match[2].toLowerCase()];
    if (month === undefined) return 0;
    return new Date(Number(match[3]), month, Number(match[1])).getTime();
  };

  const collectDatesInText = (text) => {
    const normalized = text.replace(/(\d{1,2}-[A-Za-z]{3}-)\s+(\d{4})/g, "$1$2");
    const found = [];
    for (const match of normalized.matchAll(DATE_TOKEN)) {
      found.push(normalizeDateToken(match[1], match[2], match[3]));
    }
    return found;
  };

  const windowHasToken = (window, value) => new RegExp(`\\b${value}\\b`).test(window);

  const findDatesNearTransaction = (sourceText, units, buyValue, sellValue) => {
    const lines = sourceText.split(/\r?\n/);
    let best;

    for (let start = 0; start < lines.length; start += 1) {
      for (let end = start; end < Math.min(start + 4, lines.length); end += 1) {
        const window = lines.slice(start, end + 1).join(" ");
        if (
          !windowHasToken(window, units) ||
          !windowHasToken(window, buyValue) ||
          !windowHasToken(window, sellValue)
        ) {
          continue;
        }
        const dates = [...new Set(collectDatesInText(window))];
        const span = end - start + 1;
        if (
          !best ||
          dates.length > best.dates.length ||
          (dates.length === best.dates.length && span < best.span)
        ) {
          best = { span, dates };
        }
      }
    }

    return best?.dates ?? [];
  };

  const assignPurchaseAndSellDates = (dates) => {
    const unique = [...new Set(dates.filter(Boolean))];
    if (unique.length === 0) return {};
    const sorted = unique.sort((a, b) => parseExtractionDate(a) - parseExtractionDate(b));
    if (sorted.length === 1) return { purchaseDate: sorted[0] };
    return { purchaseDate: sorted[0], sellDate: sorted[sorted.length - 1] };
  };

  const coerceNumber = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value !== "string") return undefined;
    const cleaned = value.replace(/[₹,\s]/g, "").replace(/[^0-9.-]/g, "");
    if (!cleaned) return undefined;
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : undefined;
  };

  const isNullishString = (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value !== "string") return false;
    const trimmed = value.trim().toLowerCase();
    return trimmed === "" || trimmed === "null" || trimmed === "undefined" || trimmed === "n/a";
  };

  const sanitizeField = (value) => (isNullishString(value) ? null : value);

  const repairTransactionDates = (transaction, sourceText) => {
    const units = coerceNumber(transaction.units);
    const buyValue = coerceNumber(transaction.buyValue);
    const sellValue = coerceNumber(transaction.sellValue);
    if (units === undefined || buyValue === undefined || sellValue === undefined) {
      return transaction;
    }
    const nearbyDates = findDatesNearTransaction(sourceText, units, buyValue, sellValue);
    if (nearbyDates.length === 0) return transaction;
    const assigned = assignPurchaseAndSellDates(nearbyDates);
    let nextPurchase = isNullishString(transaction.purchaseDate)
      ? ""
      : String(transaction.purchaseDate).trim();
    let nextSell = isNullishString(transaction.sellDate)
      ? ""
      : String(transaction.sellDate).trim();
    const normalizeCanonical = (value) => {
      const match = value.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      return match ? normalizeDateToken(match[1], match[2], match[3]) : value;
    };
    const canonicalPurchase = nextPurchase ? normalizeCanonical(nextPurchase) : "";
    if (
      !nextSell &&
      canonicalPurchase &&
      nearbyDates.length === 2 &&
      nearbyDates.includes(canonicalPurchase)
    ) {
      const otherDate = nearbyDates.find((date) => date !== canonicalPurchase);
      if (otherDate) {
        return {
          ...transaction,
          purchaseDate: otherDate,
          sellDate: canonicalPurchase
        };
      }
    }
    if (nearbyDates.length >= 2 && !nextSell) {
      return {
        ...transaction,
        purchaseDate: assigned.purchaseDate ?? (nextPurchase || null),
        sellDate: assigned.sellDate ?? null
      };
    }
    if (
      nextPurchase &&
      nextSell &&
      parseExtractionDate(nextPurchase) > parseExtractionDate(nextSell)
    ) {
      [nextPurchase, nextSell] = [nextSell, nextPurchase];
    }
    if (!nextPurchase && assigned.purchaseDate) nextPurchase = assigned.purchaseDate;
    if (!nextSell && assigned.sellDate) nextSell = assigned.sellDate;
    return {
      ...transaction,
      purchaseDate: nextPurchase || null,
      sellDate: nextSell || null
    };
  };

  const rawTransactions = Array.isArray(data.capitalGainsTransactions)
    ? data.capitalGainsTransactions
    : [];
  data.capitalGainsTransactions = rawTransactions.map((item) => {
    if (typeof item !== "object" || item === null) return item;
    const sanitized = {
      ...item,
      scripName: sanitizeField(item.scripName),
      purchaseDate: sanitizeField(item.purchaseDate),
      sellDate: sanitizeField(item.sellDate),
      buyPrice: sanitizeField(item.buyPrice),
      sellPrice: sanitizeField(item.sellPrice),
      instrumentType: sanitizeField(item.instrumentType)
    };
    return sourceText ? repairTransactionDates(sanitized, sourceText) : sanitized;
  });

  if (typeof data.notes === "string" && data.notes.length > 200) {
    data.notes = `${data.notes.slice(0, 199).trim()}…`;
  }

  return JSON.stringify(data);
}

const EXPECTED = [
  { scrip: "acme industries", purchaseDate: "01-Apr-2025", sellDate: "15-Apr-2025", units: 100, buyValue: 50000, sellValue: 51000 },
  { scrip: "acme industries", purchaseDate: "10-Jan-2024", sellDate: "20-May-2025", units: 50, buyValue: 25000, sellValue: 27500 },
  { scrip: "sample metals ltd", purchaseDate: "05-Jun-2025", sellDate: "05-Jun-2025", units: 200, buyValue: 40000, sellValue: 40800 },
  { scrip: "sample metals ltd", purchaseDate: "12-Feb-2023", sellDate: "18-Jun-2025", units: 75, buyValue: 30000, sellValue: 33000 },
  { scrip: "test pharma co", purchaseDate: "01-Aug-2025", sellDate: "30-Aug-2025", units: 150, buyValue: 45000, sellValue: 43500 },
];

const normScrip = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const num = (v) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/[₹,\s]/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

function extractJsonBlock(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function parseExtractionJson(text, sourceText, applyPostProcess = true) {
  try {
    const normalized = applyPostProcess && sourceText
      ? postProcessExtractionRaw(text, sourceText)
      : extractJsonBlock(text);
    const data = JSON.parse(extractJsonBlock(normalized));
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return { ok: false, error: "Root must be object", transactions: [] };
    }
    const raw = Array.isArray(data.capitalGainsTransactions) ? data.capitalGainsTransactions : [];
    const transactions = raw
      .map((t) => ({
        scripName: t?.scripName ?? "",
        purchaseDate: t?.purchaseDate ?? "",
        sellDate: t?.sellDate ?? "",
        units: num(t?.units),
        buyValue: num(t?.buyValue),
        sellValue: num(t?.sellValue),
      }))
      .filter((t) => String(t.scripName).trim());
    return { ok: true, transactions, notes: data.notes };
  } catch (e) {
    return { ok: false, error: String(e.message), transactions: [] };
  }
}

export function scoreExtraction(rawText, sourceText = fixturePdfText, applyPostProcess = true) {
  const parsed = parseExtractionJson(rawText, sourceText, applyPostProcess);
  if (!parsed.ok) return { label: "?", score: 0, summary: parsed.error, ...parsed };

  const rows = parsed.transactions;
  const used = new Set();
  let matched = 0;
  let dateIssues = 0;

  for (const exp of EXPECTED) {
    const idx = rows.findIndex((r, i) => {
      if (used.has(i)) return false;
      const scrip = normScrip(r.scripName);
      return scrip.includes(exp.scrip.split(" ")[0]) && num(r.units) === exp.units && num(r.buyValue) === exp.buyValue && num(r.sellValue) === exp.sellValue;
    });
    if (idx >= 0) {
      used.add(idx);
      matched++;
      const r = rows[idx];
      if (String(r.purchaseDate).trim() !== exp.purchaseDate) dateIssues++;
      if (String(r.sellDate).trim() !== exp.sellDate) dateIssues++;
    }
  }

  const hallucinated = Math.max(0, rows.length - matched);
  const score = 20 + matched * 14 + (matched === EXPECTED.length ? 10 : 0) - hallucinated * 12 - dateIssues * 3;

  return {
    ok: true,
    score,
    matched,
    rowCount: rows.length,
    hallucinated,
    dateIssues,
    summary: `rows=${rows.length} matched=${matched}/${EXPECTED.length} hallucinated=${hallucinated} dateMismatches=${dateIssues} score=${score}`,
    transactions: rows,
  };
}

function load(path) {
  if (path === "-") return readFileSync(0, "utf8");
  return readFileSync(path, "utf8");
}

const args = process.argv.slice(2);
const comparePostProcess = args.includes("--compare-post-process");
const fileArgs = args.filter((a) => !a.startsWith("--"));

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  if (fileArgs.length === 0) {
    console.log(
      "Usage: node spike/score-extraction.mjs [--compare-post-process] <file.txt> [file2 ...]"
    );
    process.exit(1);
  }

  for (const p of fileArgs) {
    const raw = load(p);
    if (comparePostProcess) {
      const rawScore = scoreExtraction(raw, fixturePdfText, false);
      const postScore = scoreExtraction(raw, fixturePdfText, true);
      console.log(`\n${p}:`);
      console.log(`  RAW:          ${rawScore.summary}`);
      console.log(`  POST-PROCESS: ${postScore.summary}`);
      if (rawScore.notes) console.log("  notes:", rawScore.notes);
    } else {
      const r = { label: p, ...scoreExtraction(raw) };
      console.log(`\n${r.label}: ${r.summary}`);
      if (r.notes) console.log("  notes:", r.notes);
    }
  }

  if (fileArgs.length === 2 && !comparePostProcess) {
    const results = fileArgs.map((p) => ({ label: p, ...scoreExtraction(load(p)) }));
    if (results.every((r) => r.ok)) {
      const [a, b] = results;
      const winner = a.score > b.score ? a.label : b.score > a.score ? b.label : "tie";
      console.log(`\nVerdict: ${winner} (${a.score} vs ${b.score})`);
    }
  }
}
