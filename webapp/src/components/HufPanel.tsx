import {
  BLANK_HUF_MEMBER,
  BLANK_HUF_TRANSFER,
  hufClubbingSectionLabel,
  newHufMemberId,
  newHufTransferId,
  summarizeHufAssetTransfers,
  type HufAssetTransfer,
  type HufMember
} from "../lib/hufClubbing";
import type { HufClubbingRule } from "../rules";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

/**
 * HUF-only, both parts optional: a member/coparcener list (reference for
 * the CA only, never used in any calculation - see hufClubbing.ts), and an
 * asset-transfer list that flags Section 64(2) clubbing whenever a transfer
 * lacked adequate consideration. The clubbing note never removes income
 * from the HUF's own CA Summary total - this tool computes the HUF's
 * return, not each member's. Partition is deliberately not covered here;
 * see rules/huf-clubbing.md and docs/DESIGN-remaining-gaps.md.
 */
export function HufPanel({
  members,
  onChangeMembers,
  transfers,
  onChangeTransfers,
  rule
}: {
  members: HufMember[];
  onChangeMembers: (members: HufMember[]) => void;
  transfers: HufAssetTransfer[];
  onChangeTransfers: (transfers: HufAssetTransfer[]) => void;
  rule: HufClubbingRule;
}) {
  const summary = summarizeHufAssetTransfers(transfers);

  function updateMember(id: string, patch: Partial<HufMember>) {
    onChangeMembers(members.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }
  function removeMember(id: string) {
    onChangeMembers(members.filter((member) => member.id !== id));
  }
  function addMember() {
    onChangeMembers([...members, { ...BLANK_HUF_MEMBER, id: newHufMemberId() }]);
  }

  function updateTransfer(id: string, patch: Partial<HufAssetTransfer>) {
    onChangeTransfers(transfers.map((transfer) => (transfer.id === id ? { ...transfer, ...patch } : transfer)));
  }
  function removeTransfer(id: string) {
    onChangeTransfers(transfers.filter((transfer) => transfer.id !== id));
  }
  function addTransfer() {
    onChangeTransfers([...transfers, { ...BLANK_HUF_TRANSFER, id: newHufTransferId() }]);
  }

  return (
    <section className="supplemental-form">
      <h4>Members and coparceners</h4>
      <p className="step-lede">
        For your CA's reference only - this list doesn't feed any calculation, since coparcener status can turn on
        family-specific facts this tool can't verify.
      </p>
      {members.length === 0 ? (
        <p className="checklist-empty">No members added yet.</p>
      ) : (
        members.map((member) => (
          <div className="insurance-policy-card" key={member.id}>
            <div className="supplemental-grid">
              <label className="supplemental-field">
                Name
                <input
                  type="text"
                  value={member.name}
                  placeholder="e.g. Karta's name"
                  onChange={(event) => updateMember(member.id, { name: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                <input
                  type="checkbox"
                  checked={member.isCoparcener}
                  onChange={(event) => updateMember(member.id, { isCoparcener: event.target.checked })}
                />{" "}
                Coparcener (by birth, or a daughter under the 2005 amendment)
              </label>
            </div>
            <button type="button" className="text-button" onClick={() => removeMember(member.id)}>
              Remove This Member
            </button>
          </div>
        ))
      )}
      <button type="button" className="text-button" onClick={addMember}>
        + Add A Member
      </button>

      <h4>Asset transfers into the HUF</h4>
      <p className="step-lede">
        {hufClubbingSectionLabel(rule)}: if the HUF didn't pay a fair price for an asset a member transferred in, that
        asset's income stays taxed on the transferring member's own return, not the HUF's, for as long as the HUF
        holds it. <RuleSourceLink refs={rule.source_refs} />
      </p>
      {transfers.length === 0 ? (
        <p className="checklist-empty">No transfers added yet.</p>
      ) : (
        summary.notes.map(({ transfer, clubbed }) => (
          <div className="insurance-policy-card" key={transfer.id}>
            <div className="supplemental-grid">
              <label className="supplemental-field">
                Transferring member's name
                <input
                  type="text"
                  value={transfer.transferringMemberName}
                  onChange={(event) => updateTransfer(transfer.id, { transferringMemberName: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Asset description
                <input
                  type="text"
                  value={transfer.assetDescription}
                  placeholder="e.g. Flat in Pune, TCS shares"
                  onChange={(event) => updateTransfer(transfer.id, { assetDescription: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Transfer date
                <input
                  type="date"
                  value={transfer.transferDate}
                  onChange={(event) => updateTransfer(transfer.id, { transferDate: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                <input
                  type="checkbox"
                  checked={transfer.adequateConsideration}
                  onChange={(event) => updateTransfer(transfer.id, { adequateConsideration: event.target.checked })}
                />{" "}
                The HUF paid a fair price for this asset (adequate consideration)
              </label>
              <label className="supplemental-field">
                This year's income from the asset
                <input
                  type="number"
                  min={0}
                  value={transfer.annualIncomeFromAsset}
                  placeholder="₹0"
                  onChange={(event) => updateTransfer(transfer.id, { annualIncomeFromAsset: Number(event.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="regime-result">
              <p className="regime-verdict">
                {clubbed
                  ? `₹${formatAmount(transfer.annualIncomeFromAsset)} of this year's income belongs on ${
                      transfer.transferringMemberName ? `${transfer.transferringMemberName}'s` : "the transferring member's"
                    } own return, not the HUF's - it's still included in the HUF figures above since this tool only computes the HUF's return.`
                  : "No adequate-consideration issue - income from this asset stays with the HUF."}
              </p>
            </div>
            <button type="button" className="text-button" onClick={() => removeTransfer(transfer.id)}>
              Remove This Transfer
            </button>
          </div>
        ))
      )}
      <button type="button" className="text-button" onClick={addTransfer}>
        + Add A Transfer
      </button>

      {summary.totalClubbedToMembers > 0 ? (
        <p className="step-lede">
          Total clubbed to members' own returns: <strong>₹{formatAmount(summary.totalClubbedToMembers)}</strong>. Not
          subtracted from the HUF figures above - bring this to a CA to place it on the right member's return.
        </p>
      ) : null}
    </section>
  );
}
