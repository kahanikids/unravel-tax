import type { ForeignInvestmentsRule } from "../rules";

/** A1 (foreign bank/depository) and A2 (foreign brokerage/custodial) are combined into one record type - structurally similar sub-tables. Phase 1 of the Schedule FA builder; see docs/DESIGN-remaining-gaps.md. */
export type ForeignAccountType = "depository" | "custodial";

export type ForeignAccount = {
  id: string;
  accountType: ForeignAccountType;
  country: string;
  institutionName: string;
  accountNumber: string;
  /** ISO yyyy-mm-dd. Leave blank if the account was already open before this calendar year. */
  openingDate: string;
  /**
   * Already converted to rupees using the SBI TT buying rate as on the peak
   * date - this tool has no live exchange-rate source, so it doesn't attempt
   * the conversion itself (see rules/foreign-investments.md).
   */
  peakBalanceInr: number;
  /** Rupees, converted as on 31 December of the disclosure calendar year. */
  closingBalanceInr: number;
  /** Rupees, this calendar year's gross interest or other income from the account. */
  grossInterestInr: number;
};

export function newForeignAccountId(): string {
  return `fa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const BLANK_FOREIGN_ACCOUNT: Omit<ForeignAccount, "id"> = {
  accountType: "depository",
  country: "",
  institutionName: "",
  accountNumber: "",
  openingDate: "",
  peakBalanceInr: 0,
  closingBalanceInr: 0,
  grossInterestInr: 0
};

export type ForeignAccountsSummary = {
  accounts: ForeignAccount[];
  totalPeakBalanceInr: number;
  totalClosingBalanceInr: number;
  /**
   * This calendar year's gross interest/other income across every account -
   * disclosure only. Not folded into any tax figure elsewhere: Schedule FA
   * reports the holding, Schedule FSI/OS taxes the income, and this tool
   * doesn't build that second schedule yet (see rules/foreign-investments.md).
   */
  totalGrossInterestInr: number;
  /** Schedule FA uses the calendar year, not the financial year - the year that STARTS during this filing's financial year (e.g. FY 2025-26 discloses calendar year 2025, Jan-Dec). */
  disclosureCalendarYear: number;
};

/**
 * Phase 1 of the Schedule FA builder (see docs/DESIGN-remaining-gaps.md):
 * produces the A1/A2 disclosure rows only - country, institution, account
 * number, opening date, peak/closing balance, gross interest - all in
 * rupees, entered by the user rather than converted by this tool. It does
 * NOT compute Indian tax on the underlying foreign income (that's Schedule
 * FSI/OS, a separate gap) and does NOT decide who must file Schedule FA -
 * that's the resident-and-ordinarily-resident check already surfaced as a
 * checklist item and scope caveat.
 */
export function summarizeForeignAccounts(
  accounts: ForeignAccount[],
  rule: ForeignInvestmentsRule
): ForeignAccountsSummary {
  const disclosureCalendarYear = Number.parseInt(rule.financial_year.split("-")[0], 10);
  return {
    accounts,
    totalPeakBalanceInr: accounts.reduce((sum, account) => sum + Math.max(0, account.peakBalanceInr), 0),
    totalClosingBalanceInr: accounts.reduce((sum, account) => sum + Math.max(0, account.closingBalanceInr), 0),
    totalGrossInterestInr: accounts.reduce((sum, account) => sum + Math.max(0, account.grossInterestInr), 0),
    disclosureCalendarYear
  };
}
