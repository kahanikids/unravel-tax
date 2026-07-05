/**
 * Section 90/91 (Rule 128) foreign tax credit: capped at the LOWER of the
 * foreign tax actually paid and the Indian tax on that SAME income - never
 * more than either figure. Two computation methods depending on whether the
 * income has a flat Indian rate or is taxed at slab:
 *
 * - Flat-rate income (e.g. long-term capital gains on foreign shares, taxed
 *   at a known flat rate): the Indian tax on that income is exact, so the
 *   credit is exact too, subject to this tool's own scope (see the caveat
 *   every estimate ships with).
 * - Slab-rate income (dividends, interest, short-term foreign-share gains,
 *   RSU/ESPP perquisite): Rule 128 computes the credit using the AVERAGE
 *   rate of Indian tax on total income (total tax / total income), applied
 *   to the doubly-taxed income - not the marginal rate. This tool already
 *   computes that average rate as part of the old-vs-new regime comparison
 *   (oldRegimeTax / oldRegimeSlabIncome), so the same figure is reused here
 *   rather than inventing a second one.
 *
 * This is an ESTIMATE for planning, not a Form 67 number: real Schedule
 * FSI/TR filing computes credit separately per country and per income type,
 * which this tool doesn't itemize by country. See rules/foreign-investments.md.
 */
export type ForeignTaxCreditEstimate = {
  foreignIncomeInr: number;
  foreignTaxPaidInr: number;
  indianTaxOnThisIncomeInr: number;
  creditInr: number;
};

export function computeForeignTaxCreditFlatRate(
  foreignIncomeInr: number,
  flatRate: number,
  foreignTaxPaidInr: number
): ForeignTaxCreditEstimate {
  const income = Math.max(0, foreignIncomeInr);
  const indianTax = income * flatRate;
  const foreignTaxPaid = Math.max(0, foreignTaxPaidInr);
  return {
    foreignIncomeInr: income,
    foreignTaxPaidInr: foreignTaxPaid,
    indianTaxOnThisIncomeInr: indianTax,
    creditInr: Math.min(foreignTaxPaid, indianTax)
  };
}

export function computeForeignTaxCreditAverageRate(
  foreignIncomeInr: number,
  foreignTaxPaidInr: number,
  regimeTax: number,
  regimeSlabIncome: number
): ForeignTaxCreditEstimate {
  const income = Math.max(0, foreignIncomeInr);
  const averageRate = regimeSlabIncome > 0 ? regimeTax / regimeSlabIncome : 0;
  const indianTax = income * averageRate;
  const foreignTaxPaid = Math.max(0, foreignTaxPaidInr);
  return {
    foreignIncomeInr: income,
    foreignTaxPaidInr: foreignTaxPaid,
    indianTaxOnThisIncomeInr: indianTax,
    creditInr: Math.min(foreignTaxPaid, indianTax)
  };
}
