import type { NriDtaaRule, NriTdsAndRefundsRule } from "../rules";
import type { NriCountry } from "../state/types";

export type NriDividendTax = {
  dividends: number;
  /** Section 115A flat rate on a non-resident's dividends, before any treaty relief. */
  domesticRate: number;
  /** This country's DTAA dividend rate, when this tool has one - null means no corroborated figure, so only the domestic rate applies. */
  treatyRate: number | null;
  /** The rate actually used: the lower of domesticRate and treatyRate. */
  effectiveRate: number;
  tax: number;
  /** True only when the treaty rate is genuinely lower than 20% - some treaties' individual/portfolio rate (US, Canada, Italy: 25%) is actually higher, in which case the domestic rate wins and this stays false. */
  treatyApplied: boolean;
};

/**
 * Section 115A dividend tax for a non-resident: a flat rate, never slab-taxed,
 * and always the LOWER of the 20% domestic rate and the country's DTAA rate -
 * never the higher one, even where a treaty's individual/portfolio rate
 * happens to exceed 20%. Every rate is read from rules/nri-tds-and-refunds.json
 * (domestic default) and rules/nri-dtaa.json (treaty), never hardcoded here.
 * See rules/nri-dtaa.md.
 */
export function computeNriDividendTax(
  dividends: number,
  nriCountry: NriCountry,
  dtaaRule: NriDtaaRule,
  tdsRule: NriTdsAndRefundsRule
): NriDividendTax {
  const amount = Math.max(0, dividends);
  const domesticRate = tdsRule.values.nro_dividend_tds_rate;
  const treatyRate =
    (nriCountry && dtaaRule.values.nro_withholding_rates.countries[nriCountry]?.dividend_rate) ??
    null;
  const effectiveRate = treatyRate !== null ? Math.min(domesticRate, treatyRate) : domesticRate;
  return {
    dividends: amount,
    domesticRate,
    treatyRate,
    effectiveRate,
    tax: Math.round(amount * effectiveRate),
    treatyApplied: treatyRate !== null && treatyRate < domesticRate
  };
}

export type NroTdsCheck = {
  label: string;
  amount: number;
  domesticRate: number;
  treatyRate: number | null;
  expectedAtDomesticRate: number;
  expectedAtTreatyRate: number | null;
  actualWithheld: number;
  /** actualWithheld minus the treaty-rate expectation, floored at 0 - a possible refund if a TRC/Form 10F was on file with the payer. Zero when no treaty rate is known. */
  recoverableIfTreatyApplies: number;
};

function checkOneNroTds(
  label: string,
  amount: number,
  actualWithheld: number,
  domesticRate: number,
  treatyRate: number | null
): NroTdsCheck {
  const clampedAmount = Math.max(0, amount);
  const clampedWithheld = Math.max(0, actualWithheld);
  const expectedAtTreatyRate = treatyRate !== null ? Math.round(clampedAmount * treatyRate) : null;
  return {
    label,
    amount: clampedAmount,
    domesticRate,
    treatyRate,
    expectedAtDomesticRate: Math.round(clampedAmount * domesticRate),
    expectedAtTreatyRate,
    actualWithheld: clampedWithheld,
    recoverableIfTreatyApplies:
      expectedAtTreatyRate !== null ? Math.max(0, clampedWithheld - expectedAtTreatyRate) : 0
  };
}

export type NroTdsReconciliation = {
  interest: NroTdsCheck;
  dividends: NroTdsCheck;
  totalRecoverable: number;
};

/**
 * Compares NRO interest/dividend TDS actually withheld against what the
 * treaty rate would allow (when this tool knows one for the country), to
 * surface a possible recoverable refund - the same reconciliation philosophy
 * as the AIS/TDS panel elsewhere, scoped to the NRI treaty question. Interest
 * still uses the domestic Section 195 default (30%) as its baseline since NRO
 * interest is genuinely slab-taxed, not flat, so the treaty only actually
 * helps once slab tax would otherwise exceed the treaty cap - see
 * rules/nri-tds-and-refunds.md.
 */
export function computeNroTdsReconciliation(
  inputs: {
    nroInterest: number;
    dividends: number;
    interestTdsWithheld: number;
    dividendTdsWithheld: number;
    nriCountry: NriCountry;
  },
  dtaaRule: NriDtaaRule,
  tdsRule: NriTdsAndRefundsRule
): NroTdsReconciliation {
  const countryRates = inputs.nriCountry
    ? dtaaRule.values.nro_withholding_rates.countries[inputs.nriCountry]
    : undefined;
  const interest = checkOneNroTds(
    "NRO interest",
    inputs.nroInterest,
    inputs.interestTdsWithheld,
    tdsRule.values.nro_interest_tds_rate,
    countryRates?.interest_rate ?? null
  );
  const dividends = checkOneNroTds(
    "Dividends",
    inputs.dividends,
    inputs.dividendTdsWithheld,
    tdsRule.values.nro_dividend_tds_rate,
    countryRates?.dividend_rate ?? null
  );
  return {
    interest,
    dividends,
    totalRecoverable: interest.recoverableIfTreatyApplies + dividends.recoverableIfTreatyApplies
  };
}
