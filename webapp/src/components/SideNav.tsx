import { STEP_LABELS, STEP_ORDER, type AppStep } from "../state/types";
import { IconChart, IconChecklist, IconPerson, IconUpload } from "./icons";

const RAIL_STEPS = STEP_ORDER.filter((step): step is Exclude<AppStep, "welcome"> => step !== "welcome");

const STEP_ICONS: Record<Exclude<AppStep, "welcome">, typeof IconPerson> = {
  orientation: IconPerson,
  checklist: IconChecklist,
  documents: IconUpload,
  results: IconChart
};

const MOBILE_STEP_LABELS: Record<Exclude<AppStep, "welcome">, string> = {
  orientation: "About",
  checklist: "List",
  documents: "Docs",
  results: "Files"
};

/**
 * Vertical, always-visible rail of the same step model ProgressSteps used to
 * show horizontally in the header (see DESIGN_NOTES.md for why this
 * replaced it). Persistent on every screen, including welcome, so a
 * resumed-but-not-yet-clicked-into session still shows where you left off
 * instead of looking like a reset back to step 1. Never a way to skip
 * ahead: only steps already reached (index <= furthestIndex) are clickable.
 */
export function SideNav({
  current,
  furthestIndex,
  onNavigate
}: {
  current: AppStep;
  furthestIndex: number;
  onNavigate: (step: AppStep) => void;
}) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <nav className="side-nav" aria-label="Filing steps">
      {RAIL_STEPS.map((step) => {
        const index = STEP_ORDER.indexOf(step);
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        const reached = index <= furthestIndex;
        const Icon = STEP_ICONS[step];
        const content = (
          <>
            <Icon className="side-nav-icon" />
            <span className="side-nav-label side-nav-label-full">{STEP_LABELS[step]}</span>
            <span className="side-nav-label side-nav-label-mobile">{MOBILE_STEP_LABELS[step]}</span>
          </>
        );

        return reached ? (
          <button
            type="button"
            key={step}
            className={`side-nav-step side-nav-step-${state}`}
            onClick={() => onNavigate(step)}
            aria-current={state === "current" ? "step" : undefined}
            title={STEP_LABELS[step]}
          >
            {content}
          </button>
        ) : (
          <span
            key={step}
            className={`side-nav-step side-nav-step-${state}`}
            aria-disabled="true"
            title={STEP_LABELS[step]}
          >
            {content}
          </span>
        );
      })}
    </nav>
  );
}
