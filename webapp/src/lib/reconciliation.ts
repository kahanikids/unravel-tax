export type ChecklistItem = {
  document: string;
  needed: string | boolean;
  status: string;
  whyNeeded: string;
};

export type TdsRow = {
  source: string;
  tdsPerDocument: number;
  tdsPerAis: number;
};

export type ChecklistGap = {
  document: string;
  status: string;
  whyNeeded: string;
};

export type FigureMismatch = {
  field: string;
  expected: number;
  reported: number;
  difference: number;
  source: string;
};

export type ReconciliationReport = {
  missingDocuments: ChecklistGap[];
  mismatches: FigureMismatch[];
  ready: boolean;
};

const COMPLETE_STATUSES = new Set(["complete", "loaded", "sample loaded", "provided", "available", "done"]);
const NOT_REQUIRED_STATUSES = new Set(["not applicable", "not needed", "n/a", "na"]);
const REQUIRED_VALUES = new Set(["yes", "required", "true", "1"]);

export function checklistGaps(checklistItems: ChecklistItem[]): ChecklistGap[] {
  return checklistItems.flatMap((item) => {
    const status = normalizeStatus(item.status);
    if (!isRequired(item) || COMPLETE_STATUSES.has(status) || NOT_REQUIRED_STATUSES.has(status)) {
      return [];
    }

    return [
      {
        document: item.document,
        status: status || "missing",
        whyNeeded: item.whyNeeded
      }
    ];
  });
}

export function figureMismatches(
  expected: Record<string, number>,
  reported: Record<string, number>,
  source: string,
  tolerance = 0.01
): FigureMismatch[] {
  return Object.entries(expected).flatMap(([field, expectedValue]) => {
    const reportedValue = reported[field] ?? 0;
    const difference = reportedValue - expectedValue;
    if (Math.abs(difference) <= tolerance) {
      return [];
    }

    return [
      {
        field,
        expected: expectedValue,
        reported: reportedValue,
        difference,
        source: field in reported ? source : `${source}: missing reported field`
      }
    ];
  });
}

export function tdsMismatches(rows: TdsRow[], tolerance = 0.01): FigureMismatch[] {
  const expected = Object.fromEntries(rows.map((row) => [row.source, row.tdsPerDocument]));
  const reported = Object.fromEntries(rows.map((row) => [row.source, row.tdsPerAis]));
  return figureMismatches(expected, reported, "TDS document vs AIS/26AS", tolerance);
}

export function reconciliationReport({
  checklistItems,
  expectedFigures,
  reportedFigures,
  tdsRows = [],
  tolerance = 0.01
}: {
  checklistItems: ChecklistItem[];
  expectedFigures: Record<string, number>;
  reportedFigures: Record<string, number>;
  tdsRows?: TdsRow[];
  tolerance?: number;
}): ReconciliationReport {
  const missingDocuments = checklistGaps(checklistItems);
  const mismatches = [
    ...figureMismatches(expectedFigures, reportedFigures, "Calculated totals vs reported CA summary", tolerance),
    ...tdsMismatches(tdsRows, tolerance)
  ];

  return {
    missingDocuments,
    mismatches,
    ready: missingDocuments.length === 0 && mismatches.length === 0
  };
}

function normalizeStatus(value: string) {
  return String(value || "").trim().toLowerCase();
}

function isRequired(item: ChecklistItem) {
  if (typeof item.needed === "boolean") {
    return item.needed;
  }

  const status = normalizeStatus(item.status);
  if (NOT_REQUIRED_STATUSES.has(status)) {
    return false;
  }

  return REQUIRED_VALUES.has(normalizeStatus(item.needed));
}
