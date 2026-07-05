import {
  BLANK_FOREIGN_ACCOUNT,
  newForeignAccountId,
  summarizeForeignAccounts,
  type ForeignAccount,
  type ForeignAccountType
} from "../lib/scheduleFa";
import type { ForeignInvestmentsRule } from "../rules";
import { RuleSourceLink } from "./RuleSourceLink";

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

const ACCOUNT_TYPE_LABELS: Record<ForeignAccountType, string> = {
  depository: "Bank account (Schedule FA table A1)",
  custodial: "Brokerage/custodial account (Schedule FA table A2)"
};

/**
 * Phase 1 of the Schedule FA builder: foreign bank and brokerage accounts
 * only (tables A1/A2 combined - RSUs, foreign property, and trusts aren't
 * covered here). Disclosure rows only, no tax computed - see
 * rules/foreign-investments.md and docs/DESIGN-remaining-gaps.md for why
 * the rest of the schedule is out of scope for now. Entirely skippable.
 */
export function ScheduleFaPanel({
  accounts,
  onChangeAccounts,
  rule
}: {
  accounts: ForeignAccount[];
  onChangeAccounts: (accounts: ForeignAccount[]) => void;
  rule: ForeignInvestmentsRule;
}) {
  const summary = summarizeForeignAccounts(accounts, rule);

  function updateAccount(id: string, patch: Partial<ForeignAccount>) {
    onChangeAccounts(accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)));
  }
  function removeAccount(id: string) {
    onChangeAccounts(accounts.filter((account) => account.id !== id));
  }
  function addAccount() {
    onChangeAccounts([...accounts, { ...BLANK_FOREIGN_ACCOUNT, id: newForeignAccountId() }]);
  }

  return (
    <section className="supplemental-form">
      <p className="step-lede">
        Schedule FA uses the <strong>calendar year</strong>, not the financial year: for this filing, that&apos;s
        January-December {summary.disclosureCalendarYear}, not April {summary.disclosureCalendarYear}-March{" "}
        {summary.disclosureCalendarYear + 1}. Enter every foreign bank or brokerage account held at any point in that
        calendar year, even a dormant one - there is no minimum value. Amounts should already be converted to rupees
        using the SBI TT buying rate; this tool has no live exchange-rate source, so it doesn&apos;t convert for you.{" "}
        <RuleSourceLink refs={rule.source_refs} />
      </p>
      <p className="step-lede">
        This produces the disclosure rows only, for your CA to place into Schedule FA - it doesn&apos;t compute Indian
        tax on this interest (that&apos;s a separate schedule, Schedule FSI/OS) and doesn&apos;t decide whether you
        must file Schedule FA at all (see the foreign-assets checklist item and caveat for that).
      </p>

      {accounts.length === 0 ? (
        <p className="checklist-empty">No foreign accounts added yet.</p>
      ) : (
        accounts.map((account) => (
          <div className="insurance-policy-card" key={account.id}>
            <div className="supplemental-grid">
              <label className="supplemental-field">
                Account type
                <select
                  value={account.accountType}
                  onChange={(event) => updateAccount(account.id, { accountType: event.target.value as ForeignAccountType })}
                >
                  <option value="depository">{ACCOUNT_TYPE_LABELS.depository}</option>
                  <option value="custodial">{ACCOUNT_TYPE_LABELS.custodial}</option>
                </select>
              </label>
              <label className="supplemental-field">
                Country
                <input
                  type="text"
                  value={account.country}
                  placeholder="e.g. United States"
                  onChange={(event) => updateAccount(account.id, { country: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Institution name
                <input
                  type="text"
                  value={account.institutionName}
                  onChange={(event) => updateAccount(account.id, { institutionName: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Account number
                <input
                  type="text"
                  value={account.accountNumber}
                  onChange={(event) => updateAccount(account.id, { accountNumber: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Account opening date (leave blank if opened before this calendar year)
                <input
                  type="date"
                  value={account.openingDate}
                  onChange={(event) => updateAccount(account.id, { openingDate: event.target.value })}
                />
              </label>
              <label className="supplemental-field">
                Peak balance during the calendar year (₹)
                <input
                  type="number"
                  min={0}
                  value={account.peakBalanceInr}
                  placeholder="₹0"
                  onChange={(event) => updateAccount(account.id, { peakBalanceInr: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="supplemental-field">
                Closing balance on 31 December (₹)
                <input
                  type="number"
                  min={0}
                  value={account.closingBalanceInr}
                  placeholder="₹0"
                  onChange={(event) => updateAccount(account.id, { closingBalanceInr: Number(event.target.value) || 0 })}
                />
              </label>
              <label className="supplemental-field">
                Gross interest/income this calendar year (₹)
                <input
                  type="number"
                  min={0}
                  value={account.grossInterestInr}
                  placeholder="₹0"
                  onChange={(event) => updateAccount(account.id, { grossInterestInr: Number(event.target.value) || 0 })}
                />
              </label>
            </div>
            <button type="button" className="text-button" onClick={() => removeAccount(account.id)}>
              Remove This Account
            </button>
          </div>
        ))
      )}
      <button type="button" className="text-button" onClick={addAccount}>
        + Add A Foreign Account
      </button>

      {accounts.length > 0 ? (
        <div className="regime-result">
          <div className="regime-result-row">
            <span>Total peak balance</span>
            <strong>₹{formatAmount(summary.totalPeakBalanceInr)}</strong>
          </div>
          <div className="regime-result-row">
            <span>Total closing balance</span>
            <strong>₹{formatAmount(summary.totalClosingBalanceInr)}</strong>
          </div>
          <div className="regime-result-row">
            <span>Total gross interest/income</span>
            <strong>₹{formatAmount(summary.totalGrossInterestInr)}</strong>
          </div>
          {summary.totalGrossInterestInr > 0 ? (
            <p className="regime-verdict">
              This interest is taxable at slab rate under income from other sources - add it to "Bank interest &amp;
              other income" in "A few more numbers" yourself if you want it reflected in the figures on this page;
              this section doesn&apos;t add it automatically.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
