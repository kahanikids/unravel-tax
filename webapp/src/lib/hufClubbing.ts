import type { HufClubbingRule } from "../rules";

export type HufMember = {
  id: string;
  name: string;
  /** By birth, or by the Hindu Succession (Amendment) Act, 2005 for a daughter. Reference only - never feeds a calculation, since coparcener status can turn on family-specific facts this tool can't verify. See docs/DESIGN-remaining-gaps.md. */
  isCoparcener: boolean;
};

export function newHufMemberId(): string {
  return `hm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const BLANK_HUF_MEMBER: Omit<HufMember, "id"> = {
  name: "",
  isCoparcener: true
};

export type HufAssetTransfer = {
  id: string;
  transferringMemberName: string;
  assetDescription: string;
  /** ISO yyyy-mm-dd. */
  transferDate: string;
  /** false triggers Section 64(2): the HUF didn't pay a fair price, so the asset's income stays taxed in the transferring member's own return. */
  adequateConsideration: boolean;
  /** This year's income from the transferred asset. */
  annualIncomeFromAsset: number;
};

export function newHufTransferId(): string {
  return `ht-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const BLANK_HUF_TRANSFER: Omit<HufAssetTransfer, "id"> = {
  transferringMemberName: "",
  assetDescription: "",
  transferDate: "",
  adequateConsideration: true,
  annualIncomeFromAsset: 0
};

export type HufTransferClubbingNote = {
  transfer: HufAssetTransfer;
  /** True when the HUF didn't pay adequate consideration and the asset earned income this year - Section 64(2) applies. */
  clubbed: boolean;
};

export type HufClubbingSummary = {
  notes: HufTransferClubbingNote[];
  /**
   * Sum of income Section 64(2) clubs to transferring members' own returns.
   * Informational only - this tool computes the HUF's return, not each
   * member's, so it is never subtracted from the HUF's own CA Summary total.
   */
  totalClubbedToMembers: number;
};

/**
 * Section 64(2): every transfer where the HUF didn't pay adequate
 * consideration keeps its income taxed on the transferring member's own
 * return, indefinitely, for as long as the HUF holds the asset - not a
 * one-year event. There's no rupee threshold or exemption, unlike the
 * single-parent minor's-income clubbing rule. See rules/huf-clubbing.md.
 */
export function summarizeHufAssetTransfers(transfers: HufAssetTransfer[]): HufClubbingSummary {
  const notes = transfers.map((transfer) => ({
    transfer,
    clubbed: !transfer.adequateConsideration && transfer.annualIncomeFromAsset > 0
  }));
  return {
    notes,
    totalClubbedToMembers: notes
      .filter((note) => note.clubbed)
      .reduce((sum, note) => sum + note.transfer.annualIncomeFromAsset, 0)
  };
}

/** Reference only, per rule.values.section - never hardcode the section number in UI copy. */
export function hufClubbingSectionLabel(rule: HufClubbingRule): string {
  return `Section ${rule.values.section}`;
}
