/**
 * Past-filing history for the dashboard: a small, deterministic record of
 * each year the user has already filed, so a repeat filer can see their
 * trend year over year.
 *
 * Two ways in, matching BUILD_PLAN.md Section 3's format rules:
 *  - The income-tax portal's ITR JSON (structured, parsed client-side, no
 *    AI) via `parseItrJson` - tolerant, pulls whatever fields it can find.
 *  - Manual entry of the same handful of figures, as the always-works
 *    fallback so the dashboard is useful even without a JSON file.
 *
 * There is deliberately NO PDF parser here (CLAUDE.md): an ITR-V/PDF
 * acknowledgement routes through the offline AI-extraction loop, not a
 * bespoke client-side table parser.
 */

export type FilingRegime = "old" | "new" | "unknown";

export type FilingSource = "itr-json" | "manual";

/** One past year's filing summary - only fields deterministically derivable
 * from an ITR JSON or trivially entered by hand. */
export type PastFiling = {
  id: string;
  /** e.g. "2024-25". Normalized on the way in. */
  assessmentYear: string;
  /** e.g. "ITR-2". Blank if unknown. */
  itrForm: string;
  regime: FilingRegime;
  grossTotalIncome: number;
  /** Total taxes paid for the year (TDS + advance + self-assessment). */
  totalTaxPaid: number;
  /** Positive = refund due, negative = balance payable. */
  refundOrPayable: number;
  source: FilingSource;
};

/** The editable fields, shared by the JSON prefill and the manual form. */
export type PastFilingFields = Omit<PastFiling, "id" | "source">;

export const BLANK_PAST_FILING_FIELDS: PastFilingFields = {
  assessmentYear: "",
  itrForm: "",
  regime: "unknown",
  grossTotalIncome: 0,
  totalTaxPaid: 0,
  refundOrPayable: 0
};

export type ParsedItrFiling = {
  ok: boolean;
  fields: PastFilingFields;
  /** Which fields were actually read from the JSON (vs left at the blank
   * default for the user to fill in) - drives the "auto-read" labelling. */
  readFields: (keyof PastFilingFields)[];
  message: string;
};

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[₹,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
    const parsed = Number(cleaned);
    if (!Number.isNaN(parsed) && cleaned.trim() !== "") {
      return parsed;
    }
  }
  return null;
}

/**
 * Depth-first search for the first value under any key whose name matches
 * one of `keys` (case-insensitive, ignoring non-alphanumerics). Tolerant by
 * design: ITR JSON nests these fields differently across forms and schema
 * versions, so we look everywhere rather than assuming one fixed path.
 */
function findByKey(root: unknown, keys: string[]): unknown {
  const wanted = keys.map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const seen = new Set<unknown>();
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") {
      continue;
    }
    if (seen.has(node)) {
      continue;
    }
    seen.add(node);
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (wanted.includes(normalizedKey) && value !== null && typeof value !== "object") {
        return value;
      }
    }
    // Push children after the key scan above, so a shallow match wins over a
    // deeper same-named one.
    for (const value of Object.values(node as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }
  return undefined;
}

/** Which ITR the JSON is, inferred from the top-level form container key. */
function detectItrForm(root: unknown): string {
  if (root && typeof root === "object") {
    const container = ((root as Record<string, unknown>).ITR ?? root) as Record<string, unknown>;
    for (const key of Object.keys(container)) {
      const match = key.match(/^ITR[-_ ]?([1-4])$/i);
      if (match) {
        return `ITR-${match[1]}`;
      }
    }
  }
  const formName = findByKey(root, ["FormName", "Form_Name"]);
  if (typeof formName === "string") {
    const match = formName.match(/ITR[-_ ]?([1-4])/i);
    if (match) {
      return `ITR-${match[1]}`;
    }
  }
  return "";
}

/**
 * Normalizes an assessment year to "YYYY-YY". Accepts "2025", "2025-26",
 * "2025-2026", or "AY2025-26". Returns "" if it can't tell.
 */
export function normalizeAssessmentYear(raw: unknown): string {
  const text = String(raw ?? "").replace(/ay/i, "").trim();
  const full = text.match(/^(\d{4})\s*[-/]\s*(\d{2,4})$/);
  if (full) {
    const start = Number(full[1]);
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }
  const single = text.match(/^(\d{4})$/);
  if (single) {
    const start = Number(single[1]);
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }
  return "";
}

function detectRegime(root: unknown): FilingRegime {
  // New regime (115BAC) is the default; the return records whether the
  // filer opted OUT of it. Different schema versions name this differently.
  const optOut = findByKey(root, [
    "OptOutNewTaxRegime",
    "OptingOutNewTaxRegime",
    "NewTaxRegime"
  ]);
  if (typeof optOut === "string") {
    const value = optOut.trim().toUpperCase();
    if (value === "Y" || value === "YES") {
      return "old";
    }
    if (value === "N" || value === "NO") {
      return "new";
    }
  }
  return "unknown";
}

/**
 * Reads the income-tax portal's ITR JSON. Tolerant: pulls the fields it can
 * find and reports which ones, leaving the rest for manual entry. Never
 * throws - a file it can't understand comes back with ok:false.
 */
export function parseItrJson(text: string): ParsedItrFiling {
  const fields: PastFilingFields = { ...BLANK_PAST_FILING_FIELDS };
  const readFields: (keyof PastFilingFields)[] = [];

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return {
      ok: false,
      fields,
      readFields,
      message: "This doesn't look like a valid ITR JSON file. You can still enter the figures by hand below."
    };
  }

  const assessmentYear = normalizeAssessmentYear(findByKey(root, ["AssessmentYear", "AsstYear", "AY"]));
  if (assessmentYear) {
    fields.assessmentYear = assessmentYear;
    readFields.push("assessmentYear");
  }

  const itrForm = detectItrForm(root);
  if (itrForm) {
    fields.itrForm = itrForm;
    readFields.push("itrForm");
  }

  const regime = detectRegime(root);
  if (regime !== "unknown") {
    fields.regime = regime;
    readFields.push("regime");
  }

  const gti = coerceNumber(findByKey(root, ["GrossTotalIncome", "GrossTotIncome"]));
  if (gti !== null) {
    fields.grossTotalIncome = gti;
    readFields.push("grossTotalIncome");
  }

  const taxPaid = coerceNumber(
    findByKey(root, ["TotalTaxesPaid", "TotTaxesPaid", "TaxPaid", "TotalTaxPaidAmt"])
  );
  if (taxPaid !== null) {
    fields.totalTaxPaid = taxPaid;
    readFields.push("totalTaxPaid");
  }

  const refund = coerceNumber(findByKey(root, ["RefundDue", "Refund"]));
  const payable = coerceNumber(findByKey(root, ["BalTaxPayable", "TaxPayable", "NetTaxPayable"]));
  if (refund !== null && refund > 0) {
    fields.refundOrPayable = refund;
    readFields.push("refundOrPayable");
  } else if (payable !== null && payable > 0) {
    fields.refundOrPayable = -payable;
    readFields.push("refundOrPayable");
  } else if (refund !== null || payable !== null) {
    // Both present and zero, or an explicit zero refund: record it as 0 so it
    // shows as auto-read rather than a blank the user must revisit.
    fields.refundOrPayable = 0;
    readFields.push("refundOrPayable");
  }

  if (readFields.length === 0) {
    return {
      ok: false,
      fields,
      readFields,
      message:
        "Read the file, but couldn't find the usual ITR fields in it. Enter the figures by hand below instead."
    };
  }

  return {
    ok: true,
    fields,
    readFields,
    message: `Read ${readFields.length} field${readFields.length === 1 ? "" : "s"} from the JSON. Check them and fill in anything left blank before adding.`
  };
}

export type EffectiveRatePoint = { assessmentYear: string; rate: number };

export type HistoryInsights = {
  /** Filings sorted oldest → newest by assessment year. */
  sorted: PastFiling[];
  yearsCount: number;
  /** Gross-total-income growth, latest vs the year before, as a percentage.
   * null when there aren't two years or the earlier income was zero. */
  incomeGrowthPct: number | null;
  /** totalTaxPaid / grossTotalIncome per year (0 when income is zero). */
  effectiveRates: EffectiveRatePoint[];
  latestEffectiveRate: number | null;
  /** True when more than one known regime appears across the years. */
  regimeSwitched: boolean;
  regimesUsed: FilingRegime[];
};

/** All the deterministically-derivable trends for a repeat filer. */
export function deriveHistoryInsights(filings: PastFiling[]): HistoryInsights {
  const sorted = [...filings].sort((a, b) => a.assessmentYear.localeCompare(b.assessmentYear));
  const effectiveRates: EffectiveRatePoint[] = sorted.map((filing) => ({
    assessmentYear: filing.assessmentYear,
    rate: filing.grossTotalIncome > 0 ? filing.totalTaxPaid / filing.grossTotalIncome : 0
  }));

  let incomeGrowthPct: number | null = null;
  if (sorted.length >= 2) {
    const previous = sorted[sorted.length - 2];
    const latest = sorted[sorted.length - 1];
    if (previous.grossTotalIncome > 0) {
      incomeGrowthPct = ((latest.grossTotalIncome - previous.grossTotalIncome) / previous.grossTotalIncome) * 100;
    }
  }

  const regimesUsed = Array.from(new Set(sorted.map((filing) => filing.regime).filter((regime) => regime !== "unknown")));

  return {
    sorted,
    yearsCount: sorted.length,
    incomeGrowthPct,
    effectiveRates,
    latestEffectiveRate: effectiveRates.length > 0 ? effectiveRates[effectiveRates.length - 1].rate : null,
    regimeSwitched: regimesUsed.length > 1,
    regimesUsed
  };
}

/** Stable-enough id for a client-only list; no crypto dependency needed. */
export function newFilingId(): string {
  return `pf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const REGIME_LABELS: Record<FilingRegime, string> = {
  old: "Old regime",
  new: "New regime",
  unknown: "Not recorded"
};
