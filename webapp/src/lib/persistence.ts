import type { NormalizedTransaction } from "../ingest";
import type { AisReportedFigures, AppStep, OrientationAnswers, SupplementalFigures } from "../state/types";
import type { InsurancePolicy } from "./insurance";
import type { PastFiling } from "./pastFilings";
import type { TdsRow } from "./reconciliation";
import type { RawSheet } from "./workbookExport";

/**
 * BUILD_PLAN.md Section 9: browser localStorage only, used solely as a
 * resume-a-session convenience - never the system of record. Nothing here
 * is uploaded anywhere; clearing it (clearSession) always fully resets the
 * app, same as never having saved anything.
 */
export type PersistedDocument = {
  fileName: string;
  rowCount: number;
  transactions: NormalizedTransaction[];
  /** Present for raw reference uploads (bank/dividend/MF statements) kept as-is. */
  rawSheet?: RawSheet;
};

/** Bumped 1 → 2 when the dashboard's past-filing history was added. Version 1
 * sessions (saved before it existed) are still accepted and migrated forward
 * by treating their absent `pastFilings` as an empty list - see parseSession. */
export type SessionVersion = 1 | 2;

export type PersistedSession = {
  version: SessionVersion;
  savedAt: string;
  step: AppStep;
  /** Highest step index reached this filing - lets the step nav re-offer
   * every step the user already visited after a resume, not just the one
   * they were last on. Optional for compatibility with sessions saved
   * before this field existed. */
  furthestStepIndex?: number;
  orientation: OrientationAnswers;
  documents: PersistedDocument[];
  supplementalFigures: SupplementalFigures;
  acknowledgedTriggerIds: string[];
  /** Optional for compatibility with sessions saved before AIS/26AS/Form 16
   * reconciliation existed. */
  aisFigures?: AisReportedFigures;
  tdsRows?: TdsRow[];
  /** Year-over-year filing history shown on the dashboard. Added in version 2;
   * optional so version-1 sessions load cleanly with no history. */
  pastFilings?: PastFiling[];
  /** Detailed per-policy Section 10(10D) input, optional for compatibility with sessions saved before it existed. */
  insurancePolicies?: InsurancePolicy[];
};

const STORAGE_KEY = "unravel-tax-session";

/** File written into the user's chosen folder, so the folder is a full,
 * disk-durable backup that survives a browser-storage wipe (unlike
 * localStorage/IndexedDB, both cleared together by "clear browsing data"). */
export const SESSION_BACKUP_FILENAME = "unravel-tax-session.json";

export type SessionInput = Omit<PersistedSession, "version" | "savedAt">;

export function serializeSession(session: SessionInput): string {
  const payload: PersistedSession = { version: 2, savedAt: new Date().toISOString(), ...session };
  return JSON.stringify(payload);
}

/** Parses and validates a stored/backed-up session, from either source. */
export function parseSession(raw: string | null): PersistedSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || (parsed.version !== 1 && parsed.version !== 2)) {
      return null;
    }
    // Normally a pristine welcome screen isn't worth resuming - but a session
    // that carries dashboard history (past filings) is, so that year-over-year
    // history survives a reload even before this year's filing is started.
    const hasPastFilings = Array.isArray(parsed.pastFilings) && parsed.pastFilings.length > 0;
    if (parsed.step === "welcome" && !hasPastFilings) {
      return null;
    }
    // The standalone "checklist" step was folded into the persistent
    // "Things to gather" panel, so a session saved on it resumes on the
    // documents step (its old immediate next step) instead of a step that
    // no longer renders.
    if (parsed.step === "checklist") {
      parsed.step = "documents";
    }
    return parsed as PersistedSession;
  } catch {
    return null;
  }
}

export function saveSession(session: SessionInput): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, serializeSession(session));
  } catch {
    // Storage full or unavailable (e.g. private browsing) - caching is a
    // convenience, not a requirement, so fail silently rather than block the user.
  }
}

export function loadSession(): PersistedSession | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return parseSession(localStorage.getItem(STORAGE_KEY));
}

export function clearSession(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
