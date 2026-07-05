import type { NriRepatriationRule } from "../rules";

export type NriRepatriationFigures = {
  /** Cumulative NRO repatriation this financial year, in USD. */
  amountUsd: number;
  /** The same cumulative repatriation in rupees, for the CA-certificate threshold. */
  amountInr: number;
};

export type NriRepatriationCheck = {
  amountUsd: number;
  annualLimitUsd: number;
  overLimitUsd: boolean;
  amountInr: number;
  ceilingCertificateThresholdInr: number;
  requiresCaCertificate: boolean;
  /** ["Form 145 (formerly Form 15CA)", "Form 146 (formerly Form 15CB)"], read from the rule so a future renaming never needs a code change. */
  formNames: string[];
};

/**
 * A planning-only check against the USD 1 million/year NRO repatriation cap
 * and the ₹5 lakh threshold above which a CA certificate is required. Two
 * separate figures are asked for (USD for the cap, INR for the
 * rupee-denominated threshold) rather than converting one into the other,
 * since this tool has no live exchange-rate source and a wrong assumed rate
 * would be worse than asking twice. Neither figure changes any tax number
 * elsewhere - this is a banking/FEMA compliance check, not part of the
 * return. See rules/nri-repatriation.md.
 */
export function computeNriRepatriationCheck(
  figures: NriRepatriationFigures,
  rule: NriRepatriationRule
): NriRepatriationCheck {
  const amountUsd = Math.max(0, figures.amountUsd);
  const amountInr = Math.max(0, figures.amountInr);
  return {
    amountUsd,
    annualLimitUsd: rule.values.nro_annual_limit_usd,
    overLimitUsd: amountUsd > rule.values.nro_annual_limit_usd,
    amountInr,
    ceilingCertificateThresholdInr: rule.values.nro_threshold_requiring_ca_certificate_inr,
    requiresCaCertificate: amountInr > rule.values.nro_threshold_requiring_ca_certificate_inr,
    formNames: rule.values.new_forms.map(
      (form, index) => `Form ${form} (formerly Form ${rule.values.old_forms[index]})`
    )
  };
}
