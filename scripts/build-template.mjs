import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repoRoot = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(repoRoot, "templates", "excel-export", "UnravelTax-Template.xlsx");
const fixturePath = path.join(repoRoot, "fixtures", "sample-broker-statement.csv");

const colors = {
  navy: "#25324A",
  teal: "#1F7A66",
  softTeal: "#E7F3EF",
  amber: "#FFF4D8",
  gray: "#F3F4F6",
  line: "#D6DEE6",
  text: "#1F2937",
  muted: "#52606D",
};

const moneyFormat = '"₹"#,##0';
const dateFormat = "dd-mmm-yyyy";

function csvRows(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => line.split(","));
}

function toDate(value) {
  const [day, mon, year] = value.split("-");
  const months = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11,
  };
  return new Date(Number(year), months[mon], Number(day));
}

function setTitle(sheet, title, subtitle, width = "A1:H1") {
  const titleRange = sheet.getRange(width);
  titleRange.merge();
  titleRange.values = [[title]];
  titleRange.format = {
    fill: colors.navy,
    font: { bold: true, color: "#FFFFFF", size: 16 },
    wrapText: true,
  };
  if (subtitle) {
    const sub = sheet.getRange(width.replaceAll("1", "2"));
    sub.merge();
    sub.values = [[subtitle]];
    sub.format = {
      fill: colors.softTeal,
      font: { color: colors.text, size: 10 },
      wrapText: true,
    };
  }
  sheet.showGridLines = false;
}

function styleHeader(range) {
  range.format = {
    fill: colors.teal,
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: colors.teal },
  };
}

function styleBody(range) {
  range.format = {
    borders: { preset: "all", style: "thin", color: colors.line },
    font: { color: colors.text },
  };
}

function setWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getCell(0, index).format.columnWidth = width;
  });
}

function addInputList(sheet, startRow, rows) {
  const endRow = startRow + rows.length;
  sheet.getRange(`A${startRow}:D${endRow}`).values = [
    ["Field", "Value", "Why it matters", "Status"],
    ...rows,
  ];
  styleHeader(sheet.getRange(`A${startRow}:D${startRow}`));
  styleBody(sheet.getRange(`A${startRow + 1}:D${endRow}`));
}

const fixtureText = await fs.readFile(fixturePath, "utf8");
const [fixtureHeader, ...fixtureRows] = csvRows(fixtureText);
const rawRows = fixtureRows.map((row) => [
  row[0],
  toDate(row[1]),
  toDate(row[2]),
  Number(row[3]),
  Number(row[4]),
  Number(row[5]),
  Number(row[6]),
  Number(row[7]),
]);

const workbook = Workbook.create();

const sheetNames = [
  "Profile",
  "Raw Data - Sample Broker",
  "Working - Sample Broker",
  "Dividends",
  "Interest & Other Income",
  "Transaction Charges",
  "Carry Forward Losses",
  "Checklist State",
  "CA Summary",
  "Detailed Summary",
  "ITR Form Guide",
  "NRE-NRO Tracker",
  "TDS Reconciliation",
  "DTAA & Residency",
  "Repatriation Log",
  "Coparceners & Members",
  "Transfers Without Consideration",
  "Partition Log",
  "Interest Deduction Tracker",
  "Regime & Advance Tax Flags",
  "Minor's Income (Clubbing)",
  "Alimony/Maintenance Log",
];

const sheets = Object.fromEntries(sheetNames.map((name) => [name, workbook.worksheets.add(name)]));

// Profile
{
  const sheet = sheets.Profile;
  setTitle(
    sheet,
    "Unravel Tax - Profile",
    "Synthetic template for FY2025-26 / AY2026-27. Replace sample values only in editable input cells.",
    "A1:D1",
  );
  addInputList(sheet, 4, [
    ["Person name", "Sample Taxpayer", "Used in exported summaries.", "Editable"],
    ["Financial year", "2025-26", "Rules and due dates depend on the year.", "Editable"],
    ["Assessment year", "2026-27", "Return filing year.", "Formula/input"],
    ["Residential status", "Resident", "Controls ITR form and optional NRI tabs.", "Editable"],
    ["Age group", "Under 60", "Controls senior citizen flags.", "Editable"],
    ["Has business/speculative income?", "Yes", "Intraday trading moves the return toward ITR-3.", "Editable"],
    ["Has HUF income/assets?", "No", "Controls HUF tabs.", "Editable"],
    ["Single parent/guardian clubbing?", "No", "Controls minor-income tab.", "Editable"],
  ]);
  sheet.getRange("B7").formulas = [["=RIGHT(B6,2)&\"-\"&TEXT(VALUE(RIGHT(B6,2))+1,\"00\")"]];
  setWidths(sheet, [28, 24, 54, 18]);
}

// Raw Data
{
  const sheet = sheets["Raw Data - Sample Broker"];
  setTitle(
    sheet,
    "Raw Data - Sample Broker",
    "Synthetic fixture rows copied from fixtures/sample-broker-statement.csv. Replace with extracted broker/AMC transaction rows.",
    "A1:H1",
  );
  sheet.getRange("A4:H4").values = [fixtureHeader];
  sheet.getRange(`A5:H${4 + rawRows.length}`).values = rawRows;
  styleHeader(sheet.getRange("A4:H4"));
  styleBody(sheet.getRange(`A5:H${4 + rawRows.length}`));
  sheet.getRange(`B5:C${4 + rawRows.length}`).format.numberFormat = dateFormat;
  sheet.getRange(`D5:H${4 + rawRows.length}`).format.numberFormat = "#,##0.00";
  sheet.freezePanes.freezeRows(4);
  setWidths(sheet, [24, 14, 14, 10, 14, 14, 12, 12]);
}

// Working broker sheet
{
  const sheet = sheets["Working - Sample Broker"];
  setTitle(
    sheet,
    "Working - Sample Broker",
    "Formula-driven classification and gain calculation. Do not overwrite formulas in columns I-L.",
    "A1:L1",
  );
  const headers = [
    ...fixtureHeader,
    "Hold Period (Days)",
    "Tax Class",
    "Gain/(Loss)",
    "Rule Note",
  ];
  sheet.getRange("A4:L4").values = [headers];
  sheet.getRange(`A5:H${4 + rawRows.length}`).formulas = rawRows.map((_, i) => {
    const row = i + 5;
    return [
      `='Raw Data - Sample Broker'!A${row}`,
      `='Raw Data - Sample Broker'!B${row}`,
      `='Raw Data - Sample Broker'!C${row}`,
      `='Raw Data - Sample Broker'!D${row}`,
      `='Raw Data - Sample Broker'!E${row}`,
      `='Raw Data - Sample Broker'!F${row}`,
      `='Raw Data - Sample Broker'!G${row}`,
      `='Raw Data - Sample Broker'!H${row}`,
    ];
  });
  sheet.getRange(`I5:L${4 + rawRows.length}`).formulas = rawRows.map((_, i) => {
    const row = i + 5;
    return [
      `=C${row}-B${row}`,
      `=IF(C${row}=B${row},"Intraday",IF(I${row}>365,"LT","ST"))`,
      `=F${row}-E${row}`,
      `=IF(J${row}="Intraday","Speculative/business income",IF(J${row}="LT","Long-term capital gains","Short-term capital gains"))`,
    ];
  });
  styleHeader(sheet.getRange("A4:L4"));
  styleBody(sheet.getRange(`A5:L${4 + rawRows.length}`));
  sheet.getRange(`B5:C${4 + rawRows.length}`).format.numberFormat = dateFormat;
  sheet.getRange(`E5:H${4 + rawRows.length}`).format.numberFormat = moneyFormat;
  sheet.getRange(`K5:K${4 + rawRows.length}`).format.numberFormat = moneyFormat;
  sheet.freezePanes.freezeRows(4);
  setWidths(sheet, [24, 14, 14, 10, 14, 14, 12, 12, 14, 12, 14, 30]);
}

// Dividends
{
  const sheet = sheets.Dividends;
  setTitle(sheet, "Dividends", "Quarter-wise reporting feeds Schedule OS and advance-tax checks.", "A1:G1");
  sheet.getRange("A4:G8").values = [
    ["Company/Fund", "Receipt Date", "Quarter", "Gross Dividend", "TDS", "Net Received", "Notes"],
    ["Sample Industries", new Date(2025, 6, 15), null, 2400, 0, null, "Synthetic example"],
    ["Sample Metals", new Date(2025, 9, 20), null, 1600, 0, null, "Synthetic example"],
    ["", null, null, null, null, null, ""],
    ["Total", null, null, null, null, null, ""],
  ];
  sheet.getRange("C5:C7").formulas = [["=ROUNDUP(MONTH(B5)/3,0)"], ["=ROUNDUP(MONTH(B6)/3,0)"], ["=IF(B7=\"\",\"\",ROUNDUP(MONTH(B7)/3,0))"]];
  sheet.getRange("F5:F7").formulas = [["=D5-E5"], ["=D6-E6"], ["=IF(D7=\"\",\"\",D7-E7)"]];
  sheet.getRange("D8:F8").formulas = [["=SUM(D5:D7)", "=SUM(E5:E7)", "=SUM(F5:F7)"]];
  styleHeader(sheet.getRange("A4:G4"));
  styleBody(sheet.getRange("A5:G8"));
  sheet.getRange("B5:B7").format.numberFormat = dateFormat;
  sheet.getRange("D5:F8").format.numberFormat = moneyFormat;
  setWidths(sheet, [24, 14, 10, 16, 12, 16, 30]);
}

// Interest & Other Income
{
  const sheet = sheets["Interest & Other Income"];
  setTitle(sheet, "Interest & Other Income", "Bank interest and other income used in the summary and regime comparison.", "A1:F1");
  sheet.getRange("A4:F8").values = [
    ["Source", "Income Type", "Taxable Amount", "TDS", "Eligible Deduction", "Notes"],
    ["Sample Bank", "Savings interest", 6000, 0, null, "May feed 80TTA/80TTB depending on profile"],
    ["Sample Bank FD", "Fixed deposit interest", 18000, 1800, null, "Synthetic example"],
    ["", "", null, null, null, ""],
    ["Total", "", null, null, null, ""],
  ];
  sheet.getRange("E5:E7").formulas = [["=IF(Profile!B9=\"60 or older\",MIN(C5,50000),0)"], ["=IF(Profile!B9=\"60 or older\",MIN(C6,50000),0)"], ["=IF(C7=\"\",\"\",0)"]];
  sheet.getRange("C8:E8").formulas = [["=SUM(C5:C7)", "=SUM(D5:D7)", "=SUM(E5:E7)"]];
  styleHeader(sheet.getRange("A4:F4"));
  styleBody(sheet.getRange("A5:F8"));
  sheet.getRange("C5:E8").format.numberFormat = moneyFormat;
  setWidths(sheet, [22, 22, 16, 12, 18, 36]);
}

// Transaction Charges
{
  const sheet = sheets["Transaction Charges"];
  setTitle(sheet, "Transaction Charges", "Split STT from other charges because deductibility differs by income type.", "A1:G1");
  sheet.getRange("A4:G8").values = [
    ["Source", "Charge Type", "Linked Income Type", "Amount", "Deductible?", "Deductible Amount", "Notes"],
    ["Sample Broker", "STT", "Capital gains", 250, "No", null, "STT is not deductible for capital gains"],
    ["Sample Broker", "Exchange/SEBI/stamp", "Capital gains", 120, "Yes", null, "Check whether broker values already net this"],
    ["Sample Broker", "STT", "Intraday/speculative", 40, "Yes", null, "Business-income treatment"],
    ["Total", "", "", null, "", null, ""],
  ];
  sheet.getRange("F5:F7").formulas = [["=IF(E5=\"Yes\",D5,0)"], ["=IF(E6=\"Yes\",D6,0)"], ["=IF(E7=\"Yes\",D7,0)"]];
  sheet.getRange("D8:F8").formulas = [["=SUM(D5:D7)", "", "=SUM(F5:F7)"]];
  styleHeader(sheet.getRange("A4:G4"));
  styleBody(sheet.getRange("A5:G8"));
  sheet.getRange("D5:F8").format.numberFormat = moneyFormat;
  setWidths(sheet, [18, 24, 22, 12, 12, 18, 36]);
}

// Carry Forward Losses
{
  const sheet = sheets["Carry Forward Losses"];
  setTitle(sheet, "Carry Forward Losses", "Register losses by assessment year. Late filing can forfeit carry-forward.", "A1:G1");
  sheet.getRange("A4:G9").values = [
    ["AY Loss Arose", "Type of Loss", "Section", "Original Amount", "Set Off Later", "Balance Available", "Expires After AY"],
    ["2026-27", "Short Term Capital Loss", "111A", null, 0, null, "2034-35"],
    ["2026-27", "Long Term Capital Loss", "112A", null, 0, null, "2034-35"],
    ["", "", "", null, null, null, ""],
    ["", "", "", null, null, null, ""],
    ["Total", "", "", null, null, null, ""],
  ];
  sheet.getRange("D5:D6").formulas = [
    ["=MAX(0,-SUMIF('Working - Sample Broker'!$J$5:$J$9,\"ST\",'Working - Sample Broker'!$K$5:$K$9))"],
    ["=MAX(0,-SUMIF('Working - Sample Broker'!$J$5:$J$9,\"LT\",'Working - Sample Broker'!$K$5:$K$9))"],
  ];
  sheet.getRange("F5:F8").formulas = [["=D5-E5"], ["=D6-E6"], ["=IF(D7=\"\",\"\",D7-E7)"], ["=IF(D8=\"\",\"\",D8-E8)"]];
  sheet.getRange("D9:F9").formulas = [["=SUM(D5:D8)", "=SUM(E5:E8)", "=SUM(F5:F8)"]];
  styleHeader(sheet.getRange("A4:G4"));
  styleBody(sheet.getRange("A5:G9"));
  sheet.getRange("D5:F9").format.numberFormat = moneyFormat;
  setWidths(sheet, [14, 26, 12, 16, 14, 18, 16]);
}

// Checklist State
{
  const sheet = sheets["Checklist State"];
  setTitle(sheet, "Checklist State", "Milestone 1 manual checklist state. M3 will turn this into tested reconciliation logic.", "A1:F1");
  sheet.getRange("A4:F12").values = [
    ["Document", "Needed?", "Status", "Why needed", "Source/Link", "Notes"],
    ["Form 16 or pension statement", "Yes", "Needed", "Salary/pension income", "", ""],
    ["AIS / Form 26AS", "Yes", "Needed", "TDS and reported transactions", "", ""],
    ["Bank interest certificates", "Yes", "Needed", "Other income and deductions", "", ""],
    ["Broker/AMC capital gains statement", "Yes", "Sample loaded", "Capital gains classification", "fixtures/sample-broker-statement.csv", ""],
    ["Dividend statement", "If applicable", "Sample loaded", "Quarter-wise Schedule OS", "", ""],
    ["Prior-year ITR / CFL", "If losses exist", "Needed", "Carry-forward continuity", "", ""],
    ["NRI documents", "Profile-dependent", "Not applicable", "TRC, 10F, NRE/NRO, TDS", "", ""],
    ["HUF documents", "Profile-dependent", "Not applicable", "Separate PAN and HUF income", "", ""],
  ];
  styleHeader(sheet.getRange("A4:F4"));
  styleBody(sheet.getRange("A5:F12"));
  setWidths(sheet, [30, 16, 16, 34, 28, 28]);
}

// Detailed Summary
{
  const sheet = sheets["Detailed Summary"];
  setTitle(
    sheet,
    "Detailed Summary",
    "Working view with formula-backed totals, risk flags, and notes. Advanced view source for exports.",
    "A1:F1",
  );
  sheet.getRange("A4:F18").values = [
    ["Section", "Income Head", "Rule", "Amount", "Tax Estimate", "Plain-language note"],
    ["Capital gains", "Speculative / Intraday", "Business income", null, null, "Taxed at slab rate; can move filer to ITR-3."],
    ["Capital gains", "Short-Term Capital Gains", "111A", null, null, "20% flat rate if net gain; losses may carry forward if filed on time."],
    ["Capital gains", "Long-Term Capital Gains", "112A", null, null, "12.5% above annual exemption if net gain; LTCL offsets LTCG only."],
    ["Dividends", "Dividend income", "Schedule OS", null, null, "Report quarter-wise, not only annually."],
    ["Other income", "Interest & other income", "Slab", null, null, "Check AIS/Form 26AS against certificates."],
    ["Deductions", "Eligible interest deduction", "80TTA/80TTB", null, null, "Profile-dependent; senior citizen treatment differs."],
    ["Charges", "Deductible transaction charges", "STT split", null, null, "Check whether broker values already include charges."],
    ["Loss register", "Carry-forward losses", "CFL", null, null, "Preserved only if return filed by applicable due date."],
    ["", "", "", null, null, ""],
    ["Risk flag", "ITR form", "", null, null, ""],
    ["Risk flag", "CA review recommendation", "", null, null, ""],
    ["Risk flag", "Missing checklist count", "", null, null, ""],
    ["", "", "", null, null, ""],
    ["Output", "CA Summary ready?", "", null, null, ""],
  ];
  sheet.getRange("D5:E13").formulas = [
    ["=SUMIF('Working - Sample Broker'!$J$5:$J$9,\"Intraday\",'Working - Sample Broker'!$K$5:$K$9)", "=MAX(0,D5)*0.30"],
    ["=SUMIF('Working - Sample Broker'!$J$5:$J$9,\"ST\",'Working - Sample Broker'!$K$5:$K$9)", "=MAX(0,D6)*0.20"],
    ["=SUMIF('Working - Sample Broker'!$J$5:$J$9,\"LT\",'Working - Sample Broker'!$K$5:$K$9)", "=MAX(0,D7-125000)*0.125"],
    ["=Dividends!D8", "=MAX(0,D8)*0.30"],
    ["='Interest & Other Income'!C8", "=MAX(0,D9-D10)*0.30"],
    ["='Interest & Other Income'!E8", ""],
    ["='Transaction Charges'!F8", ""],
    ["='Carry Forward Losses'!F9", ""],
    ["", ""],
  ];
  sheet.getRange("F14:F16").formulas = [
    ["=IF('ITR Form Guide'!B5=\"ITR-3\",\"ITR-3 due to business/speculative income\",'ITR Form Guide'!B5)"],
    ["=IF(OR('ITR Form Guide'!B5=\"ITR-3\",Profile!B8<>\"Resident\",Profile!B11=\"Yes\",Profile!B12=\"Yes\"),\"Get CA review before filing\",\"Self-file may be reasonable after checks\")"],
    ["=COUNTIF('Checklist State'!$C$5:$C$12,\"Needed\")"],
  ];
  sheet.getRange("F18").formulas = [["=IF(F16=0,\"Ready after review\",\"Not ready - checklist still has missing items\")"]];
  styleHeader(sheet.getRange("A4:F4"));
  styleBody(sheet.getRange("A5:F18"));
  sheet.getRange("D5:E13").format.numberFormat = moneyFormat;
  setWidths(sheet, [18, 28, 16, 16, 16, 62]);
}

// CA Summary
{
  const sheet = sheets["CA Summary"];
  setTitle(sheet, "CA Summary", "Clean figures only. This is the sheet intended for CA handover.", "A1:D1");
  sheet.getRange("A4:D14").values = [
    ["Head", "Rule/Section", "Amount", "Notes"],
    ["Speculative / Intraday income", "Business income", null, "From Detailed Summary"],
    ["Short-Term Capital Gains", "111A", null, "From Detailed Summary"],
    ["Long-Term Capital Gains", "112A", null, "From Detailed Summary"],
    ["Dividends", "Schedule OS", null, "Quarter-wise detail in Dividends tab"],
    ["Interest & other income", "Schedule OS", null, "From certificates/AIS"],
    ["Eligible interest deduction", "80TTA/80TTB", null, "Profile-dependent"],
    ["Deductible transaction charges", "Expense split", null, "Check source treatment"],
    ["Carry-forward losses available", "CFL", null, "From register"],
    ["Recommended ITR form", "", null, ""],
    ["CA review recommendation", "", null, ""],
  ];
  sheet.getRange("C5:C12").formulas = [
    ["='Detailed Summary'!D5"],
    ["='Detailed Summary'!D6"],
    ["='Detailed Summary'!D7"],
    ["='Detailed Summary'!D8"],
    ["='Detailed Summary'!D9"],
    ["='Detailed Summary'!D10"],
    ["='Detailed Summary'!D11"],
    ["='Detailed Summary'!D12"],
  ];
  sheet.getRange("C13:C14").formulas = [["='ITR Form Guide'!B5"], ["='Detailed Summary'!F15"]];
  styleHeader(sheet.getRange("A4:D4"));
  styleBody(sheet.getRange("A5:D14"));
  sheet.getRange("C5:C12").format.numberFormat = moneyFormat;
  setWidths(sheet, [32, 18, 18, 42]);
}

// ITR Form Guide
{
  const sheet = sheets["ITR Form Guide"];
  setTitle(sheet, "ITR Form Guide", "Auto-suggested return form from profile and income flags.", "A1:E1");
  sheet.getRange("A4:E9").values = [
    ["Question", "Answer", "Formula Source", "Impact", "Notes"],
    ["Suggested ITR form", null, "Formula", "Use in CA Summary", "Template logic only; confirm annually."],
    ["Due date", null, "Formula", "Used in risk notes", "AY2026-27 split: ITR-3 non-audit due later than ITR-1/2."],
    ["Why", null, "Formula", "Plain-language explanation", ""],
    ["NRI/HUF present?", null, "Formula", "Review trigger", ""],
    ["Business/speculative income present?", null, "Formula", "ITR-3 trigger", ""],
  ];
  sheet.getRange("B5:B9").formulas = [
    ["=IF(Profile!B10=\"Yes\",\"ITR-3\",IF(OR(Profile!B8<>\"Resident\",Profile!B11=\"Yes\",Profile!B12=\"Yes\"),\"ITR-2\",\"ITR-2\"))"],
    ["=IF(B5=\"ITR-3\",\"31-Aug-2026\",\"31-Jul-2026\")"],
    ["=IF(Profile!B10=\"Yes\",\"Business/speculative income is present.\",\"Capital gains or profile flags require review before choosing a simpler form.\")"],
    ["=IF(OR(Profile!B8<>\"Resident\",Profile!B11=\"Yes\"),\"Yes\",\"No\")"],
    ["=Profile!B10"],
  ];
  styleHeader(sheet.getRange("A4:E4"));
  styleBody(sheet.getRange("A5:E9"));
  setWidths(sheet, [34, 22, 20, 28, 50]);
}

function addSimpleSheet(name, title, subtitle, headers, rows) {
  const sheet = sheets[name];
  const endCol = String.fromCharCode(64 + headers.length);
  setTitle(sheet, title, subtitle, `A1:${endCol}1`);
  sheet.getRange(`A4:${endCol}${4 + rows.length}`).values = [headers, ...rows];
  styleHeader(sheet.getRange(`A4:${endCol}4`));
  styleBody(sheet.getRange(`A5:${endCol}${4 + rows.length}`));
  setWidths(sheet, headers.map((h) => Math.min(Math.max(String(h).length + 6, 14), 34)));
}

addSimpleSheet(
  "NRE-NRO Tracker",
  "NRE-NRO Tracker",
  "NRI-only tab. Keep NRE and NRO interest separate.",
  ["Account", "Type", "Interest", "Taxable?", "TDS", "Notes"],
  [["Sample NRO", "NRO", 0, "Yes", 0, "NRO interest is taxable"], ["Sample NRE", "NRE", 0, "No", 0, "NRE interest is generally exempt while NRI"]],
);

addSimpleSheet(
  "TDS Reconciliation",
  "TDS Reconciliation",
  "NRI and general TDS cross-check against AIS/Form 26AS.",
  ["Source", "Income Type", "TDS per Document", "TDS per AIS/26AS", "Difference", "Notes"],
  [["Sample Broker", "Capital gains", 0, 0, 0, "NRI broker TDS goes here"], ["Sample Bank", "Interest", 1800, 1800, 0, "Synthetic example"]],
);
sheets["TDS Reconciliation"].getRange("E5:E6").formulas = [["=C5-D5"], ["=C6-D6"]];

addSimpleSheet(
  "DTAA & Residency",
  "DTAA & Residency",
  "NRI-only residency and treaty documentation checklist.",
  ["Field", "Value", "Needed?", "Status", "Notes"],
  [["Country of tax residence", "", "If NRI", "Needed", ""], ["TRC available?", "", "If claiming DTAA", "Needed", ""], ["Form 10F filed?", "", "If claiming DTAA", "Needed", ""]],
);

addSimpleSheet(
  "Repatriation Log",
  "Repatriation Log",
  "NRI-only NRO remittance tracking.",
  ["Date", "Account", "Amount USD", "Form status", "Running Total", "Notes"],
  [[null, "", 0, "", 0, "Track against annual limit"], [null, "", 0, "", 0, ""]],
);

addSimpleSheet(
  "Coparceners & Members",
  "Coparceners & Members",
  "HUF-only family member register.",
  ["Name", "Relationship", "PAN", "Role", "Notes"],
  [["Sample Karta", "Karta", "", "Karta", "Synthetic placeholder"], ["Sample Member", "Member", "", "Member", ""]],
);

addSimpleSheet(
  "Transfers Without Consideration",
  "Transfers Without Consideration",
  "HUF-only Section 64(2) clubbing tracker.",
  ["Transferor", "Asset", "Transfer Date", "Income", "Clubbed Back?", "Notes"],
  [["", "", null, 0, "Review", "Income from assets transferred without adequate consideration may club back"]],
);

addSimpleSheet(
  "Partition Log",
  "Partition Log",
  "HUF-only partition tracker.",
  ["Date", "Type", "Deed Reference", "Assets Covered", "Notes"],
  [[null, "", "", "", "Full/partial partition notes go here"]],
);

addSimpleSheet(
  "Interest Deduction Tracker",
  "Interest Deduction Tracker",
  "Senior citizen tab for 80TTB/interest tracking.",
  ["Source", "Interest Type", "Interest Amount", "Eligible Limit", "Eligible Deduction", "Notes"],
  [["Sample Bank", "Savings", 6000, 50000, null, "80TTB if senior citizen under old regime"], ["Sample FD", "Deposit", 18000, 50000, null, ""]],
);
sheets["Interest Deduction Tracker"].getRange("E5:E6").formulas = [["=IF(Profile!B9=\"60 or older\",MIN(C5,D5),0)"], ["=IF(Profile!B9=\"60 or older\",MIN(C6,D6),0)"]];

addSimpleSheet(
  "Regime & Advance Tax Flags",
  "Regime & Advance Tax Flags",
  "Senior citizen and business-income caveat tracker.",
  ["Flag", "Value", "Consequence", "Notes"],
  [["Business/speculative income present?", null, "May restrict regime switching and advance-tax exemption", ""], ["Senior citizen?", null, "Check advance-tax exemption only if no business income", ""]],
);
sheets["Regime & Advance Tax Flags"].getRange("B5:B6").formulas = [["=Profile!B10"], ["=IF(Profile!B9=\"60 or older\",\"Yes\",\"No\")"]];

addSimpleSheet(
  "Minor's Income (Clubbing)",
  "Minor's Income (Clubbing)",
  "Single-parent/guardian tab for Schedule SPI inputs.",
  ["Child", "Income Source", "Amount", "Exemption", "Clubbed Amount", "Notes"],
  [["", "", 0, 1500, null, "Section 64(1A) review needed"]],
);
sheets["Minor's Income (Clubbing)"].getRange("E5").formulas = [["=MAX(0,C5-D5)"]];

addSimpleSheet(
  "Alimony/Maintenance Log",
  "Alimony/Maintenance Log",
  "Single-parent tab distinguishing periodic and lump-sum receipts.",
  ["Date", "Payer", "Type", "Amount", "Tax Treatment", "Notes"],
  [[null, "", "Periodic/Lump sum", 0, "Review", "Treatment depends on facts and documentation"]],
);

for (const sheet of Object.values(sheets)) {
  try {
    sheet.freezePanes.freezeRows(4);
  } catch {
    // Some sheets already have panes set; keep going.
  }
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(`Wrote ${outputPath}`);
