import { STEP_LABELS, STEP_ORDER, type AppStep } from "../state/types";

/**
 * Doubles as the app's only persistent nav (DESIGN_NOTES.md): every step
 * already reached this filing is a real, clickable button, so a user can
 * jump back to the checklist/documents/results without restarting from the
 * welcome screen. Steps not yet reached stay inert - this never offers a
 * way to skip ahead, only back to where the user has already been.
 */
export function ProgressSteps({
  current,
  furthestIndex,
  onNavigate
}: {
  current: AppStep;
  furthestIndex: number;
  onNavigate: (step: AppStep) => void;
}) {
  const currentIndex = STEP_ORDER.indexOf(current);
  const visibleSteps = STEP_ORDER.filter((step) => step !== "welcome");

  return (
    <nav className="progress-steps" aria-label="Progress">
      {visibleSteps.map((step, displayIndex) => {
        const index = STEP_ORDER.indexOf(step);
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        const reached = index <= furthestIndex;
        const content = (
          <>
            <span className="progress-step-index">{displayIndex + 1}</span>
            <span className="progress-step-label">{STEP_LABELS[step]}</span>
          </>
        );

        return reached ? (
          <button
            type="button"
            className={`progress-step progress-step-${state}`}
            key={step}
            onClick={() => onNavigate(step)}
            aria-current={state === "current" ? "step" : undefined}
          >
            {content}
          </button>
        ) : (
          <span className={`progress-step progress-step-${state}`} key={step} aria-disabled="true">
            {content}
          </span>
        );
      })}
    </nav>
  );
}
