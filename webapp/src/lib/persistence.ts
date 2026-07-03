import type { NormalizedTransaction } from "../ingest";
import type { AppStep, OrientationAnswers, SupplementalFigures } from "../state/types";

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
};

export type PersistedSession = {
  version: 1;
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
};

const STORAGE_KEY = "unravel-tax-session";

export function saveSession(session: Omit<PersistedSession, "version" | "savedAt">): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  const payload: PersistedSession = { version: 1, savedAt: new Date().toISOString(), ...session };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable (e.g. private browsing) - caching is a
    // convenience, not a requirement, so fail silently rather than block the user.
  }
}

export function loadSession(): PersistedSession | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || parsed.step === "welcome") {
      return null;
    }
    return parsed as PersistedSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}
