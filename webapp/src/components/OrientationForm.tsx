import { useEffect, useState } from "react";
import type {
  CapitalGainsAssetType,
  HousePropertyCount,
  IncomeSource,
  NriCountry,
  OrientationAnswers
} from "../state/types";

type QuestionBase = {
  id: string;
  prompt: string;
  /** Shown instead of `prompt` when residency is NRI. */
  promptNri?: string;
  helper?: string;
  helperNri?: string;
  mobileHelper?: string;
  visible: (answers: OrientationAnswers) => boolean;
  /** Safe to leave unanswered: deriveProfileFlags() treats a skipped
   * (null) answer the same as "No", a conservative default that never
   * breaks a calculation. Residency and income sources aren't skippable:
   * they decide which checklist/rules branch applies at all. */
  skippable?: boolean;
};

type YesNoQuestion = QuestionBase & {
  kind: "yes-no";
  value: (answers: OrientationAnswers) => boolean | null;
  set: (answers: OrientationAnswers, value: boolean) => OrientationAnswers;
};

type ChoiceQuestion = QuestionBase & {
  kind: "choice";
  options: { label: string; value: string }[];
  value: (answers: OrientationAnswers) => string | null;
  set: (answers: OrientationAnswers, value: string) => OrientationAnswers;
};

type MultiQuestion = QuestionBase & {
  kind: "multi";
  options: { label: string; value: IncomeSource }[];
  /** When set, shown instead of `options` for the NRI profile. */
  optionsNri?: { label: string; value: IncomeSource }[];
  value: (answers: OrientationAnswers) => IncomeSource[];
  set: (answers: OrientationAnswers, values: IncomeSource[]) => OrientationAnswers;
};

type NumberQuestion = QuestionBase & {
  kind: "number";
  unit?: string;
  value: (answers: OrientationAnswers) => number | null;
  set: (answers: OrientationAnswers, value: number | null) => OrientationAnswers;
};

type CapitalGainsMultiQuestion = QuestionBase & {
  kind: "cg-multi";
  options: { label: string; value: CapitalGainsAssetType }[];
  value: (answers: OrientationAnswers) => CapitalGainsAssetType[];
  set: (answers: OrientationAnswers, values: CapitalGainsAssetType[]) => OrientationAnswers;
};

type Question = YesNoQuestion | ChoiceQuestion | MultiQuestion | NumberQuestion | CapitalGainsMultiQuestion;

const CAPITAL_GAINS_ASSET_OPTIONS: { label: string; value: CapitalGainsAssetType }[] = [
  { label: "Property or land", value: "property" },
  { label: "Crypto or virtual digital assets", value: "crypto_vda" },
  { label: "Unlisted shares", value: "unlisted_shares" },
  { label: "Foreign shares outside India", value: "foreign_shares" },
  { label: "Debt mutual funds", value: "debt_mf" }
];

const INCOME_OPTIONS: { label: string; value: IncomeSource }[] = [
  { label: "Salary or pension", value: "salary_pension" },
  { label: "Bank interest", value: "bank_interest" },
  { label: "Shares or mutual funds you sold this year", value: "capital_gains" },
  { label: "Dividends", value: "dividends" },
  { label: "Rent", value: "rent" },
  { label: "Something else", value: "other" }
];

const INCOME_OPTIONS_NRI: { label: string; value: IncomeSource }[] = [
  { label: "Salary for work done in India", value: "salary_pension" },
  { label: "Interest on NRO or other Indian accounts, not NRE", value: "bank_interest" },
  { label: "Mutual funds or shares you sold in India", value: "capital_gains" },
  { label: "Dividends from Indian companies", value: "dividends" },
  { label: "Rent from property in India", value: "rent" },
  { label: "Something else", value: "other" }
];

const NRI_COUNTRY_OPTIONS: { label: string; value: string }[] = [
  { label: "Singapore", value: "Singapore" },
  { label: "United Arab Emirates", value: "United Arab Emirates" },
  { label: "United States", value: "United States" },
  { label: "United Kingdom", value: "United Kingdom" },
  { label: "Canada", value: "Canada" },
  { label: "Australia", value: "Australia" },
  { label: "Saudi Arabia", value: "Saudi Arabia" },
  { label: "Germany", value: "Germany" },
  { label: "Malaysia", value: "Malaysia" },
  { label: "Kuwait", value: "Kuwait" },
  { label: "Oman", value: "Oman" },
  { label: "Qatar", value: "Qatar" },
  { label: "Italy", value: "Italy" },
  { label: "Nepal", value: "Nepal" },
  { label: "Philippines", value: "Philippines" },
  { label: "Hong Kong", value: "Hong Kong" },
  { label: "Another country", value: "Other" }
];

const isNri = (answers: OrientationAnswers) => answers.residency === "nri";
const isRnor = (answers: OrientationAnswers) => answers.residency === "rnor";
const isRor = (answers: OrientationAnswers) => answers.residency === "resident";
/** Resident or RNOR — Indian tax resident, not NRI. */
const isTaxResident = (answers: OrientationAnswers) =>
  answers.residency === "resident" || answers.residency === "rnor";
const hasSalaryIncome = (answers: OrientationAnswers) =>
  answers.incomeSources.includes("salary_pension");
const hasRentIncome = (answers: OrientationAnswers) => answers.incomeSources.includes("rent");

const hasCapitalGainsIncome = (answers: OrientationAnswers) =>
  answers.incomeSources.includes("capital_gains");

function clearForeignAssetFollowUps(answers: OrientationAnswers): OrientationAnswers {
  return {
    ...answers,
    foreignSigningAuthority: null,
    foreignProperty: null,
    foreignTrust: null,
    foreignCashValueInsurance: null
  };
}

function clearResidentOnlyAnswers(answers: OrientationAnswers): OrientationAnswers {
  return clearForeignAssetFollowUps({
    ...answers,
    multipleEmployers: null,
    businessIncome: null,
    presumptiveTaxation: null,
    incomeLikelyAbove50L: null,
    housePropertyCount: null,
    capitalGainsAssetTypes: [],
    hraClaimed: null,
    hraAboveThreshold: null,
    hasLandlordPan: null,
    epfWithdrawal: null,
    epfBeforeFiveYears: null,
    foreignAssets: null
  });
}

function clearNriOnlyAnswers(answers: OrientationAnswers): OrientationAnswers {
  return {
    ...answers,
    nriCountry: null,
    nriDaysInIndia: null,
    nriTdsDeducted: null,
    nriHasTrcAndForm10F: null,
    nriNeedsForm13: null,
    nriTenantTdsForm16A: null
  };
}

const QUESTIONS: Question[] = [
  {
    id: "residency",
    kind: "choice",
    prompt: "What was your tax residential status for FY 2025-26 (Apr 2025 to Mar 2026)?",
    helper:
      "This is your tax status, not just where you live day-to-day. Resident (ROR), RNOR (recently returned or partly abroad), and non-resident (NRI) change which form you file and what you must disclose.",
    mobileHelper: "Resident, RNOR, or non-resident (NRI)?",
    options: [
      { label: "Resident in India (ROR)", value: "resident" },
      { label: "RNOR (recently returned or partly abroad)", value: "rnor" },
      { label: "Non-resident (NRI)", value: "nri" }
    ],
    visible: () => true,
    value: (a) => a.residency,
    set: (a, value) => {
      const residency = value as NonNullable<OrientationAnswers["residency"]>;
      if (residency === "nri") {
        return clearResidentOnlyAnswers({ ...a, residency });
      }
      if (residency === "rnor") {
        return clearNriOnlyAnswers(clearResidentOnlyAnswers({ ...a, residency }));
      }
      return clearNriOnlyAnswers(clearResidentOnlyAnswers({ ...a, residency }));
    }
  },
  {
    id: "nriCountry",
    kind: "choice",
    prompt: "Which country are you a tax resident of?",
    helper:
      "Where you live and pay tax, not your passport. This decides which India treaty (DTAA) applies. For some countries, mutual fund gains may be exempt in India after a 2025 tribunal ruling.",
    mobileHelper: "Where you pay tax, not your passport.",
    options: NRI_COUNTRY_OPTIONS,
    visible: isNri,
    value: (a) => a.nriCountry,
    set: (a, value) => ({ ...a, nriCountry: value as NriCountry })
  },
  {
    id: "nriDaysInIndia",
    kind: "number",
    prompt: "How many days were you physically in India this financial year?",
    helper:
      "The return asks for this to confirm your non-resident status (under 182 days usually keeps you an NRI). Don't have the exact count handy? Skip it and come back later.",
    mobileHelper: "Don't know yet? Skip and come back later.",
    unit: "days",
    visible: (a) => isNri(a) || isRnor(a),
    skippable: true,
    value: (a) => a.nriDaysInIndia,
    set: (a, value) => ({ ...a, nriDaysInIndia: value })
  },
  {
    id: "huf",
    kind: "yes-no",
    prompt:
      "Is any of this income or investment held through a family (HUF) rather than just you personally?",
    helper: "Skip this if that term is unfamiliar. It almost certainly doesn't apply to you.",
    mobileHelper: "Not sure? Skip it.",
    visible: () => true,
    skippable: true,
    value: (a) => a.huf,
    set: (a, value) =>
      value
        ? { ...a, huf: value }
        : { ...a, huf: value, hufReturnScope: null }
  },
  {
    id: "hufReturnScope",
    kind: "choice",
    prompt: "Are you preparing your personal return or the HUF's return?",
    helper:
      "Personal = your own ITR even if some investments sit in the HUF's name. HUF's return = filing as the HUF assessee with the HUF's PAN.",
    mobileHelper: "Your return or the HUF's?",
    options: [
      { label: "My personal return", value: "personal" },
      { label: "The HUF's return", value: "huf_return" }
    ],
    visible: (a) => a.huf === true,
    skippable: true,
    value: (a) => a.hufReturnScope,
    set: (a, value) => ({ ...a, hufReturnScope: value as "personal" | "huf_return" })
  },
  {
    id: "seniorCitizen",
    kind: "yes-no",
    prompt: "Are you 60 or older?",
    helper:
      "As of 31 March 2026. Senior-citizen slab benefits apply to resident individuals, but they may not fully apply if you are NRI or RNOR.",
    mobileHelper: "60+ as of 31 March 2026?",
    visible: () => true,
    skippable: true,
    value: (a) => a.seniorCitizen,
    set: (a, value) =>
      value
        ? { ...a, seniorCitizen: value }
        : { ...a, seniorCitizen: value, superSeniorCitizen: null }
  },
  {
    id: "superSeniorCitizen",
    kind: "yes-no",
    prompt: "Are you 80 or older?",
    helper: "The old regime has a higher tax-free threshold past 80. Skip if you're not sure yet.",
    mobileHelper: "Not sure? Skip it.",
    visible: (a) => a.seniorCitizen === true,
    skippable: true,
    value: (a) => a.superSeniorCitizen,
    set: (a, value) => ({ ...a, superSeniorCitizen: value })
  },
  {
    id: "singleParent",
    kind: "yes-no",
    prompt: "Does any minor child have income or investments in their own name?",
    helper:
      "If yes, the higher-earning parent usually clubs it on their return, not only single parents. Answer No if no minor has separate income.",
    mobileHelper: "Minor with their own income? Say Yes.",
    visible: () => true,
    skippable: true,
    value: (a) => a.singleParent,
    set: (a, value) => ({ ...a, singleParent: value })
  },
  {
    id: "incomeSources",
    kind: "multi",
    prompt: "What kinds of income do you have?",
    promptNri: "What kinds of income do you have from India?",
    helper: "Pick everything that applies.",
    helperNri:
      "Pick everything that applies. NRE account interest is tax-free and doesn't go here. You'll enter it separately later if needed.",
    options: INCOME_OPTIONS,
    optionsNri: INCOME_OPTIONS_NRI,
    visible: () => true,
    value: (a) => a.incomeSources,
    set: (a, values) => ({
      ...a,
      incomeSources: values,
      housePropertyCount: values.includes("rent") ? a.housePropertyCount : null,
      capitalGainsAssetTypes: values.includes("capital_gains") ? a.capitalGainsAssetTypes : [],
      nriTenantTdsForm16A:
        values.includes("rent") && isNri(a) ? a.nriTenantTdsForm16A : null,
      multipleEmployers:
        values.includes("salary_pension") && isTaxResident(a) ? a.multipleEmployers : null
    })
  },
  {
    id: "capitalGainsAssetTypes",
    kind: "cg-multi",
    prompt:
      "Did you sell anything other than listed shares or equity mutual funds?",
    helper:
      "Listed equity and equity MF are already covered. Pick any other types. Each one usually means ITR-2, not ITR-1. Pick none if you only sold listed shares/equity MF.",
    mobileHelper: "Property, crypto, unlisted, foreign, or debt MF?",
    options: CAPITAL_GAINS_ASSET_OPTIONS,
    visible: (a) => isTaxResident(a) && hasCapitalGainsIncome(a),
    skippable: true,
    value: (a) => a.capitalGainsAssetTypes,
    set: (a, values) => ({ ...a, capitalGainsAssetTypes: values })
  },
  {
    id: "nriTdsDeducted",
    kind: "yes-no",
    prompt:
      "Did any broker, AMC, bank, or tenant deduct TDS on your NRI income (capital gains, NRO interest, dividends, or rent)?",
    helper: "TDS on NRI income is common at default rates. You'll reconcile certificates when you file.",
    mobileHelper: "TDS deducted on NRI income?",
    visible: isNri,
    skippable: true,
    value: (a) => a.nriTdsDeducted,
    set: (a, value) => ({ ...a, nriTdsDeducted: value })
  },
  {
    id: "nriHasTrcAndForm10F",
    kind: "yes-no",
    prompt: "Do you have a Tax Residency Certificate (TRC) and have you filed Form 10F for treaty relief?",
    helper:
      "Needed to claim DTAA benefits on NRO interest, dividends, or mutual fund gains taxed in India.",
    mobileHelper: "Have TRC and Form 10F?",
    visible: isNri,
    skippable: true,
    value: (a) => a.nriHasTrcAndForm10F,
    set: (a, value) => ({ ...a, nriHasTrcAndForm10F: value })
  },
  {
    id: "nriNeedsForm13",
    kind: "yes-no",
    prompt: "Did you apply for, or do you need, a Form 13 lower/nil TDS certificate?",
    helper:
      "Form 13 (Section 197) lets an NRI get tax deducted at a lower rate or nil before income is paid.",
    mobileHelper: "Need Form 13 lower/nil TDS?",
    visible: isNri,
    skippable: true,
    value: (a) => a.nriNeedsForm13,
    set: (a, value) => ({ ...a, nriNeedsForm13: value })
  },
  {
    id: "nriTenantTdsForm16A",
    kind: "yes-no",
    prompt: "For Indian rental income, did your tenant deduct TDS and give you Form 16A?",
    helper: "Tenants paying rent to an NRI usually deduct TDS at 30% and issue Form 16A.",
    mobileHelper: "Tenant gave Form 16A?",
    visible: (a) => isNri(a) && hasRentIncome(a),
    skippable: true,
    value: (a) => a.nriTenantTdsForm16A,
    set: (a, value) => ({ ...a, nriTenantTdsForm16A: value })
  },
  {
    id: "businessIncome",
    kind: "yes-no",
    prompt:
      "Did you have business, freelance, professional, F&O, intraday, or speculative trading income?",
    helper:
      "This changes your ITR form (usually ITR-3), due date, and whether books may need audit. Answer No if you only had salary, interest, dividends, or long-term investing.",
    mobileHelper: "Freelance, F&O, or intraday? Say Yes.",
    visible: isTaxResident,
    skippable: true,
    value: (a) => a.businessIncome,
    set: (a, value) => ({ ...a, businessIncome: value, presumptiveTaxation: value ? a.presumptiveTaxation : null })
  },
  {
    id: "presumptiveTaxation",
    kind: "yes-no",
    prompt:
      "Are you using presumptive taxation under Section 44AD, 44ADA, or 44AE?",
    helper:
      "If yes, you may file ITR-4 (Sugam) instead of ITR-3, as long as total income stays within ₹50 lakh and you are not on intraday/F&O trading. Skip if you are not sure yet.",
    mobileHelper: "On 44AD/44ADA/44AE? Say Yes.",
    visible: (a) => isTaxResident(a) && a.businessIncome === true,
    skippable: true,
    value: (a) => a.presumptiveTaxation,
    set: (a, value) => ({ ...a, presumptiveTaxation: value })
  },
  {
    id: "incomeLikelyAbove50L",
    kind: "yes-no",
    prompt: "Is your total income likely above ₹50 lakh this year?",
    helper:
      "ITR-1 is only for resident individuals up to ₹50 lakh. If you're not sure yet, skip. We'll check again once you enter salary and other figures.",
    mobileHelper: "Total income above ₹50 lakh?",
    visible: isTaxResident,
    skippable: true,
    value: (a) => a.incomeLikelyAbove50L,
    set: (a, value) => ({ ...a, incomeLikelyAbove50L: value })
  },
  {
    id: "housePropertyCount",
    kind: "choice",
    prompt: "How many house properties did you own or report income/loss from?",
    helper: "ITR-1 allows up to two house properties. More than two needs ITR-2.",
    options: [
      { label: "One", value: "one" },
      { label: "Two", value: "two" },
      { label: "More than two", value: "more_than_two" }
    ],
    visible: (a) => isTaxResident(a) && hasRentIncome(a),
    value: (a) => a.housePropertyCount,
    set: (a, value) => ({ ...a, housePropertyCount: value as HousePropertyCount })
  },
  {
    id: "multipleEmployers",
    kind: "yes-no",
    prompt: "Did you change jobs this year, or have income from more than one employer in India?",
    visible: (a) => isTaxResident(a) && hasSalaryIncome(a),
    skippable: true,
    value: (a) => a.multipleEmployers,
    set: (a, value) => ({ ...a, multipleEmployers: value })
  },
  {
    id: "hraClaimed",
    kind: "yes-no",
    prompt: "Do you pay rent and claim it against your salary (HRA)?",
    visible: isTaxResident,
    skippable: true,
    value: (a) => a.hraClaimed,
    set: (a, value) => ({
      ...a,
      hraClaimed: value,
      hraAboveThreshold: value ? a.hraAboveThreshold : null,
      hasLandlordPan: value ? a.hasLandlordPan : null
    })
  },
  {
    id: "hraAboveThreshold",
    kind: "yes-no",
    prompt: "Is your annual rent over roughly ₹1 lakh (about ₹8,300/month)?",
    visible: (a) => isTaxResident(a) && a.hraClaimed === true,
    skippable: true,
    value: (a) => a.hraAboveThreshold,
    set: (a, value) => ({
      ...a,
      hraAboveThreshold: value,
      hasLandlordPan: value ? a.hasLandlordPan : null
    })
  },
  {
    id: "hasLandlordPan",
    kind: "yes-no",
    prompt: "Do you have your landlord's PAN?",
    helper: "Above that rent threshold, the HRA claim needs it on file.",
    visible: (a) => isTaxResident(a) && a.hraClaimed === true && a.hraAboveThreshold === true,
    skippable: true,
    value: (a) => a.hasLandlordPan,
    set: (a, value) => ({ ...a, hasLandlordPan: value })
  },
  {
    id: "epfWithdrawal",
    kind: "yes-no",
    prompt: "Did you take money out of your provident fund this year?",
    visible: isTaxResident,
    skippable: true,
    value: (a) => a.epfWithdrawal,
    set: (a, value) => ({
      ...a,
      epfWithdrawal: value,
      epfBeforeFiveYears: value ? a.epfBeforeFiveYears : null
    })
  },
  {
    id: "epfBeforeFiveYears",
    kind: "yes-no",
    prompt: "Was that before completing 5 years of continuous service?",
    visible: (a) => isTaxResident(a) && a.epfWithdrawal === true,
    skippable: true,
    value: (a) => a.epfBeforeFiveYears,
    set: (a, value) => ({ ...a, epfBeforeFiveYears: value })
  },
  {
    id: "loansRepaid",
    kind: "yes-no",
    prompt: "Are you repaying any loans this year (home, education, or electric vehicle)?",
    helper:
      "The interest you pay on these can lower your tax, mostly under the old regime. Answer No for a personal or car loan, which usually gives no deduction.",
    mobileHelper: "Home, education, or EV loan? Say Yes.",
    visible: (a) => isTaxResident(a) || hasRentIncome(a),
    skippable: true,
    value: (a) => a.loansRepaid,
    set: (a, value) => ({ ...a, loansRepaid: value })
  },
  {
    id: "insurancePayout",
    kind: "yes-no",
    prompt: "Did you receive a life-insurance maturity or survival payout this year?",
    helper:
      "Not a death benefit (always tax-free): a policy that matured or paid out to you. Usually tax-free, but high-premium policies aren't, so we'll flag it. Answer No if you only paid premiums.",
    mobileHelper: "Policy matured and paid you? Say Yes.",
    visible: () => true,
    skippable: true,
    value: (a) => a.insurancePayout,
    set: (a, value) => ({ ...a, insurancePayout: value })
  },
  {
    id: "foreignAssets",
    kind: "yes-no",
    prompt:
      "Do you hold any assets outside India (foreign shares, US RSUs/ESPP, overseas accounts or property)?",
    helper:
      "Residents must report every foreign holding in Schedule FA, even a dormant account, with no minimum value. Getting this wrong risks a ₹10 lakh penalty, so it changes which form you file.",
    mobileHelper: "Foreign shares, RSUs, or accounts? Say Yes.",
    visible: isRor,
    skippable: true,
    value: (a) => a.foreignAssets,
    set: (a, value) =>
      value ? { ...a, foreignAssets: value } : clearForeignAssetFollowUps({ ...a, foreignAssets: value })
  },
  {
    id: "foreignSigningAuthority",
    kind: "yes-no",
    prompt:
      "At any time in calendar year 2025, did you have signing authority over a foreign bank, brokerage, or custodial account (not already covered above)?",
    helper: "Signing authority alone can trigger Schedule FA disclosure, even without owning the account.",
    mobileHelper: "Signing authority abroad?",
    visible: (a) => isRor(a) && a.foreignAssets === true,
    skippable: true,
    value: (a) => a.foreignSigningAuthority,
    set: (a, value) => ({ ...a, foreignSigningAuthority: value })
  },
  {
    id: "foreignProperty",
    kind: "yes-no",
    prompt: "Did you hold any foreign immovable property (house, land, apartment abroad)?",
    visible: (a) => isRor(a) && a.foreignAssets === true,
    skippable: true,
    value: (a) => a.foreignProperty,
    set: (a, value) => ({ ...a, foreignProperty: value })
  },
  {
    id: "foreignTrust",
    kind: "yes-no",
    prompt: "Were you a beneficiary or settlor of a foreign trust?",
    visible: (a) => isRor(a) && a.foreignAssets === true,
    skippable: true,
    value: (a) => a.foreignTrust,
    set: (a, value) => ({ ...a, foreignTrust: value })
  },
  {
    id: "foreignCashValueInsurance",
    kind: "yes-no",
    prompt: "Did you hold any foreign life insurance with cash surrender value?",
    visible: (a) => isRor(a) && a.foreignAssets === true,
    skippable: true,
    value: (a) => a.foreignCashValueInsurance,
    set: (a, value) => ({ ...a, foreignCashValueInsurance: value })
  }
];

function isUnanswered(question: Question, answers: OrientationAnswers): boolean {
  if (question.kind === "multi" || question.kind === "cg-multi") {
    return question.value(answers).length === 0;
  }
  return question.value(answers) === null;
}

/** Short, plain-language labels for the saved-answers summary card, so a
 * returning user sees a scannable recap rather than the full question text. */
const SUMMARY_LABELS: Record<string, string> = {
  residency: "Tax residential status",
  nriCountry: "Country of tax residence",
  nriDaysInIndia: "Days in India this year",
  huf: "Income held through a family (HUF)",
  hufReturnScope: "Personal or HUF return",
  seniorCitizen: "60 or older",
  superSeniorCitizen: "80 or older",
  singleParent: "Minor child with own income",
  incomeSources: "Kinds of income",
  capitalGainsAssetTypes: "Other capital-gains types sold",
  nriTdsDeducted: "TDS deducted on NRI income",
  nriHasTrcAndForm10F: "TRC and Form 10F for treaty relief",
  nriNeedsForm13: "Form 13 lower/nil TDS needed",
  nriTenantTdsForm16A: "Tenant TDS / Form 16A on rent",
  businessIncome: "Business, F&O, or intraday income",
  presumptiveTaxation: "Presumptive taxation (44AD/44ADA/44AE)",
  incomeLikelyAbove50L: "Total income likely above ₹50 lakh",
  housePropertyCount: "House properties reported",
  multipleEmployers: "More than one Indian employer this year",
  hraClaimed: "Claim rent against salary (HRA)",
  hraAboveThreshold: "Annual rent over ~₹1 lakh",
  hasLandlordPan: "Have landlord's PAN",
  epfWithdrawal: "Took money out of provident fund",
  epfBeforeFiveYears: "Withdrawal before 5 years of service",
  loansRepaid: "Repaying a home, education, or EV loan",
  insurancePayout: "Received a life-insurance payout",
  foreignAssets: "Holds assets outside India",
  foreignSigningAuthority: "Signing authority over foreign account",
  foreignProperty: "Foreign immovable property",
  foreignTrust: "Beneficiary/settlor of foreign trust",
  foreignCashValueInsurance: "Foreign cash-value life insurance"
};

function formatAnswer(question: Question, answers: OrientationAnswers): string {
  if (question.kind === "choice") {
    const value = question.value(answers);
    return question.options.find((option) => option.value === value)?.label ?? "Not answered";
  }
  if (question.kind === "multi") {
    const values = question.value(answers);
    if (values.length === 0) {
      return "None selected";
    }
    const options = isNri(answers) && question.optionsNri ? question.optionsNri : question.options;
    return options
      .filter((option) => values.includes(option.value))
      .map((option) => option.label)
      .join(", ");
  }
  if (question.kind === "cg-multi") {
    const values = question.value(answers);
    if (values.length === 0) {
      return "Listed shares/equity MF only";
    }
    return question.options
      .filter((option) => values.includes(option.value))
      .map((option) => option.label)
      .join(", ");
  }
  if (question.kind === "number") {
    const value = question.value(answers);
    return value === null ? "Skipped" : `${value}${question.unit ? ` ${question.unit}` : ""}`;
  }
  const value = question.value(answers);
  return value === null ? "Skipped" : value ? "Yes" : "No";
}

export function OrientationForm({
  answers,
  onChange,
  onComplete
}: {
  answers: OrientationAnswers;
  onChange: (answers: OrientationAnswers) => void;
  onComplete: () => void;
}) {
  const visible = QUESTIONS.filter((question) => question.visible(answers));
  const hasAnswers = QUESTIONS.some((question) => !isUnanswered(question, answers));
  // Coming back to "About you" with answers already saved shows a recap first
  // (not question 1 again), so the flow doesn't feel like starting over. A
  // fresh start (blank answers) goes straight into the questions.
  const [enteredWithAnswers] = useState(hasAnswers);
  const [mode, setMode] = useState<"summary" | "questions">(hasAnswers ? "summary" : "questions");
  const [index, setIndex] = useState(() => {
    const firstUnanswered = visible.findIndex((question) => isUnanswered(question, answers));
    return firstUnanswered === -1 ? Math.max(0, visible.length - 1) : firstUnanswered;
  });
  const current = visible[index];
  const progressPercent = ((index + 1) / visible.length) * 100;

  useEffect(() => {
    if (mode === "questions" && !current) {
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, mode]);

  if (mode === "summary") {
    return (
      <div className="orientation-card">
        <h2 className="orientation-prompt">Your answers</h2>
        <p className="orientation-note">
          Here's what you told us. These shape your checklist and recommendations. Skipped
          answers are treated as No for now.
        </p>
        <dl className="orientation-summary">
          {visible.map((question) => (
            <div key={question.id} className="orientation-summary-row">
              <dt>{SUMMARY_LABELS[question.id] ?? question.prompt}</dt>
              <dd>{formatAnswer(question, answers)}</dd>
            </div>
          ))}
        </dl>
        <div className="orientation-summary-actions">
          <button type="button" className="primary-button" onClick={onComplete}>
            Continue
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setIndex(0);
              setMode("questions");
            }}
          >
            Update Answers
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return null;
  }

  const answerAndAdvance = (next: OrientationAnswers) => {
    onChange(next);
    setIndex((value) => value + 1);
  };

  // Leaves the answer as-is (null) and moves on. deriveProfileFlags()
  // treats that the same as "No" everywhere it's read, so this is always a
  // safe default, never a broken one.
  const skip = () => setIndex((value) => value + 1);

  return (
    <div className="orientation-card">
      <p className="orientation-progress">{`Question ${index + 1} of ${visible.length}`}</p>
      <div className="orientation-progress-bar" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      {index === 0 ? (
        <p className="orientation-note">
          Answers only shape what's asked next. Nothing is submitted anywhere.
        </p>
      ) : null}
      <h2 className="orientation-prompt">
        {isNri(answers) && current.promptNri ? current.promptNri : current.prompt}
      </h2>
      {current.helper || (isNri(answers) && current.helperNri) ? (
        <p className="orientation-helper">
          <span className="orientation-helper-desktop">
            {isNri(answers) && current.helperNri ? current.helperNri : current.helper}
          </span>
          <span className="orientation-helper-mobile">
            {current.mobileHelper ??
              (isNri(answers) && current.helperNri ? current.helperNri : current.helper)}
          </span>
        </p>
      ) : null}

      {current.kind === "yes-no" ? (
        <div className="orientation-options">
          <button
            type="button"
            className="option-button"
            onClick={() => answerAndAdvance(current.set(answers, true))}
          >
            Yes
          </button>
          <button
            type="button"
            className="option-button"
            onClick={() => answerAndAdvance(current.set(answers, false))}
          >
            No
          </button>
        </div>
      ) : null}

      {current.kind === "choice" ? (
        <div className="orientation-options">
          {current.options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className="option-button"
              onClick={() => answerAndAdvance(current.set(answers, option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {current.kind === "multi" ? (
        <MultiSelectQuestion
          question={current}
          answers={answers}
          onChange={onChange}
          onContinue={() => setIndex((value) => value + 1)}
        />
      ) : null}

      {current.kind === "cg-multi" ? (
        <CapitalGainsMultiSelectQuestion
          question={current}
          answers={answers}
          onChange={onChange}
          onContinue={() => setIndex((value) => value + 1)}
          onSkip={skip}
          skippable={current.skippable}
        />
      ) : null}

      {current.kind === "number" ? (
        <NumberQuestionInput question={current} answers={answers} onCommit={answerAndAdvance} />
      ) : null}

      {current.skippable && current.kind !== "cg-multi" ? (
        <button type="button" className="text-button orientation-skip" onClick={skip}>
          Skip
        </button>
      ) : null}

      <div className="orientation-nav">
        {index > 0 ? (
          <button
            type="button"
            className="text-button"
            onClick={() => setIndex((value) => Math.max(0, value - 1))}
          >
            ← Back
          </button>
        ) : enteredWithAnswers ? (
          <button type="button" className="text-button" onClick={() => setMode("summary")}>
            ← Back To My Answers
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function NumberQuestionInput({
  question,
  answers,
  onCommit
}: {
  question: NumberQuestion;
  answers: OrientationAnswers;
  onCommit: (answers: OrientationAnswers) => void;
}) {
  const [draft, setDraft] = useState(() => {
    const current = question.value(answers);
    return current === null ? "" : String(current);
  });

  const commit = () => {
    const trimmed = draft.trim();
    const parsed = trimmed === "" ? null : Math.max(0, Math.floor(Number(trimmed)));
    onCommit(question.set(answers, parsed !== null && Number.isFinite(parsed) ? parsed : null));
  };

  return (
    <div className="orientation-number">
      <input
        type="number"
        min={0}
        max={366}
        inputMode="numeric"
        value={draft}
        placeholder={question.unit ?? ""}
        onChange={(event) => setDraft(event.target.value)}
      />
      <button
        type="button"
        className="primary-button"
        onClick={commit}
        disabled={draft.trim() === ""}
      >
        Continue
      </button>
    </div>
  );
}

function CapitalGainsMultiSelectQuestion({
  question,
  answers,
  onChange,
  onContinue,
  onSkip,
  skippable
}: {
  question: CapitalGainsMultiQuestion;
  answers: OrientationAnswers;
  onChange: (answers: OrientationAnswers) => void;
  onContinue: () => void;
  onSkip: () => void;
  skippable?: boolean;
}) {
  const selected = question.value(answers);

  const toggle = (value: CapitalGainsAssetType) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(question.set(answers, next));
  };

  return (
    <div className="orientation-multi">
      <div className="orientation-checkboxes">
        {question.options.map((option) => (
          <label key={option.value} className="checkbox-row">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <button type="button" className="primary-button" onClick={onContinue}>
        Continue
      </button>
      {skippable ? (
        <button type="button" className="text-button orientation-skip" onClick={onSkip}>
          Skip (listed shares/equity MF only)
        </button>
      ) : null}
    </div>
  );
}

function MultiSelectQuestion({
  question,
  answers,
  onChange,
  onContinue
}: {
  question: MultiQuestion;
  answers: OrientationAnswers;
  onChange: (answers: OrientationAnswers) => void;
  onContinue: () => void;
}) {
  const selected = question.value(answers);
  const options = isNri(answers) && question.optionsNri ? question.optionsNri : question.options;

  const toggle = (value: IncomeSource) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(question.set(answers, next));
  };

  return (
    <div className="orientation-multi">
      <div className="orientation-checkboxes">
        {options.map((option) => (
          <label key={option.value} className="checkbox-row">
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      <button
        type="button"
        className="primary-button"
        disabled={selected.length === 0}
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
}
