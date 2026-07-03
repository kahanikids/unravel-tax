import { useEffect, useState } from "react";
import type { IncomeSource, OrientationAnswers } from "../state/types";

type QuestionBase = {
  id: string;
  prompt: string;
  helper?: string;
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
  options: { label: string; value: OrientationAnswers["residency"] }[];
  value: (answers: OrientationAnswers) => OrientationAnswers["residency"];
  set: (answers: OrientationAnswers, value: NonNullable<OrientationAnswers["residency"]>) => OrientationAnswers;
};

type MultiQuestion = QuestionBase & {
  kind: "multi";
  options: { label: string; value: IncomeSource }[];
  value: (answers: OrientationAnswers) => IncomeSource[];
  set: (answers: OrientationAnswers, values: IncomeSource[]) => OrientationAnswers;
};

type Question = YesNoQuestion | ChoiceQuestion | MultiQuestion;

const INCOME_OPTIONS: { label: string; value: IncomeSource }[] = [
  { label: "Salary or pension", value: "salary_pension" },
  { label: "Bank interest", value: "bank_interest" },
  { label: "Shares or mutual funds you sold this year", value: "capital_gains" },
  { label: "Dividends", value: "dividends" },
  { label: "Rent", value: "rent" },
  { label: "Something else", value: "other" }
];

const QUESTIONS: Question[] = [
  {
    id: "residency",
    kind: "choice",
    prompt: "Are you living in India right now, or outside India, for this financial year?",
    options: [
      { label: "I live in India", value: "resident" },
      { label: "I live outside India (NRI)", value: "nri" }
    ],
    visible: () => true,
    value: (a) => a.residency,
    set: (a, value) => ({ ...a, residency: value })
  },
  {
    id: "huf",
    kind: "yes-no",
    prompt: "Is any of this income or investment held through a family (HUF) rather than just you personally?",
    helper: "Skip this if that term is unfamiliar. It almost certainly doesn't apply to you.",
    mobileHelper: "Not sure? Skip it.",
    visible: () => true,
    skippable: true,
    value: (a) => a.huf,
    set: (a, value) => ({ ...a, huf: value })
  },
  {
    id: "seniorCitizen",
    kind: "yes-no",
    prompt: "Are you 60 or older?",
    visible: () => true,
    skippable: true,
    value: (a) => a.seniorCitizen,
    set: (a, value) => ({ ...a, seniorCitizen: value })
  },
  {
    id: "singleParent",
    kind: "yes-no",
    prompt: "Are you a single parent or guardian with children under 18?",
    helper:
      "Answer No if you don't have minor children. This only changes things when a child has money in their own name — bank interest or investments in a minor's name get added to your return.",
    mobileHelper: "No minor children? Answer No.",
    visible: () => true,
    skippable: true,
    value: (a) => a.singleParent,
    set: (a, value) => ({ ...a, singleParent: value })
  },
  {
    id: "incomeSources",
    kind: "multi",
    prompt: "What kinds of income do you have?",
    helper: "Pick everything that applies.",
    options: INCOME_OPTIONS,
    visible: () => true,
    value: (a) => a.incomeSources,
    set: (a, values) => ({ ...a, incomeSources: values })
  },
  {
    id: "multipleEmployers",
    kind: "yes-no",
    prompt: "Did you change jobs this year, or have income from more than one employer?",
    visible: () => true,
    skippable: true,
    value: (a) => a.multipleEmployers,
    set: (a, value) => ({ ...a, multipleEmployers: value })
  },
  {
    id: "hraClaimed",
    kind: "yes-no",
    prompt: "Do you pay rent and claim it against your salary (HRA)?",
    visible: () => true,
    skippable: true,
    value: (a) => a.hraClaimed,
    set: (a, value) => ({ ...a, hraClaimed: value, hraAboveThreshold: value ? a.hraAboveThreshold : null, hasLandlordPan: value ? a.hasLandlordPan : null })
  },
  {
    id: "hraAboveThreshold",
    kind: "yes-no",
    prompt: "Is your annual rent over roughly ₹1 lakh (about ₹8,300/month)?",
    visible: (a) => a.hraClaimed === true,
    skippable: true,
    value: (a) => a.hraAboveThreshold,
    set: (a, value) => ({ ...a, hraAboveThreshold: value, hasLandlordPan: value ? a.hasLandlordPan : null })
  },
  {
    id: "hasLandlordPan",
    kind: "yes-no",
    prompt: "Do you have your landlord's PAN?",
    helper: "Above that rent threshold, the HRA claim needs it on file.",
    visible: (a) => a.hraClaimed === true && a.hraAboveThreshold === true,
    skippable: true,
    value: (a) => a.hasLandlordPan,
    set: (a, value) => ({ ...a, hasLandlordPan: value })
  },
  {
    id: "epfWithdrawal",
    kind: "yes-no",
    prompt: "Did you take money out of your provident fund this year?",
    visible: () => true,
    skippable: true,
    value: (a) => a.epfWithdrawal,
    set: (a, value) => ({ ...a, epfWithdrawal: value, epfBeforeFiveYears: value ? a.epfBeforeFiveYears : null })
  },
  {
    id: "epfBeforeFiveYears",
    kind: "yes-no",
    prompt: "Was that before completing 5 years of continuous service?",
    visible: (a) => a.epfWithdrawal === true,
    skippable: true,
    value: (a) => a.epfBeforeFiveYears,
    set: (a, value) => ({ ...a, epfBeforeFiveYears: value })
  }
];

function isUnanswered(question: Question, answers: OrientationAnswers): boolean {
  if (question.kind === "multi") {
    return question.value(answers).length === 0;
  }
  return question.value(answers) === null;
}

/** Short, plain-language labels for the saved-answers summary card, so a
 * returning user sees a scannable recap rather than the full question text. */
const SUMMARY_LABELS: Record<string, string> = {
  residency: "Where you live",
  huf: "Income held through a family (HUF)",
  seniorCitizen: "60 or older",
  singleParent: "Single parent with minor children",
  incomeSources: "Kinds of income",
  multipleEmployers: "More than one employer this year",
  hraClaimed: "Claim rent against salary (HRA)",
  hraAboveThreshold: "Annual rent over ~₹1 lakh",
  hasLandlordPan: "Have landlord's PAN",
  epfWithdrawal: "Took money out of provident fund",
  epfBeforeFiveYears: "Withdrawal before 5 years of service"
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
    return question.options
      .filter((option) => values.includes(option.value))
      .map((option) => option.label)
      .join(", ");
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
        <p className="orientation-note">Here's what you told us. These shape your checklist and recommendations.</p>
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
            Update answers
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
      {index === 0 ? <p className="orientation-note">Answers only shape what's asked next. Nothing is submitted anywhere.</p> : null}
      <h2 className="orientation-prompt">{current.prompt}</h2>
      {current.helper ? (
        <p className="orientation-helper">
          <span className="orientation-helper-desktop">{current.helper}</span>
          <span className="orientation-helper-mobile">{current.mobileHelper ?? current.helper}</span>
        </p>
      ) : null}

      {current.kind === "yes-no" ? (
        <div className="orientation-options">
          <button type="button" className="option-button" onClick={() => answerAndAdvance(current.set(answers, true))}>
            Yes
          </button>
          <button type="button" className="option-button" onClick={() => answerAndAdvance(current.set(answers, false))}>
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
              onClick={() => answerAndAdvance(current.set(answers, option.value as NonNullable<OrientationAnswers["residency"]>))}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {current.kind === "multi" ? (
        <MultiSelectQuestion question={current} answers={answers} onChange={onChange} onContinue={() => setIndex((value) => value + 1)} />
      ) : null}

      {current.skippable ? (
        <button type="button" className="text-button orientation-skip" onClick={skip}>
          Skip
        </button>
      ) : null}

      <div className="orientation-nav">
        {index > 0 ? (
          <button type="button" className="text-button" onClick={() => setIndex((value) => Math.max(0, value - 1))}>
            ← Back
          </button>
        ) : enteredWithAnswers ? (
          <button type="button" className="text-button" onClick={() => setMode("summary")}>
            ← Back to my answers
          </button>
        ) : (
          <span />
        )}
      </div>
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

  const toggle = (value: IncomeSource) => {
    const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(question.set(answers, next));
  };

  return (
    <div className="orientation-multi">
      <div className="orientation-checkboxes">
        {question.options.map((option) => (
          <label key={option.value} className="checkbox-row">
            <input type="checkbox" checked={selected.includes(option.value)} onChange={() => toggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
      <button type="button" className="primary-button" disabled={selected.length === 0} onClick={onContinue}>
        Continue
      </button>
    </div>
  );
}
