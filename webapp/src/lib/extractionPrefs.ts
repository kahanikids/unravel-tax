export type ExtractionMethod = "frontier" | "browser" | "openrouter";

export const EXTRACTION_METHOD_KEY = "unravel-tax-extraction-method";
export const OPENROUTER_API_KEY = "unravel-tax-openrouter-api-key";

export function getStoredExtractionMethod(): ExtractionMethod | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  const value = localStorage.getItem(EXTRACTION_METHOD_KEY);
  if (value === "frontier" || value === "browser" || value === "openrouter") {
    return value;
  }
  return null;
}

export function setStoredExtractionMethod(method: ExtractionMethod): void {
  localStorage.setItem(EXTRACTION_METHOD_KEY, method);
}

export function getStoredOpenRouterApiKey(): string {
  return typeof localStorage !== "undefined"
    ? (localStorage.getItem(OPENROUTER_API_KEY) ?? "")
    : "";
}

export function setStoredOpenRouterApiKey(key: string): void {
  localStorage.setItem(OPENROUTER_API_KEY, key);
}
