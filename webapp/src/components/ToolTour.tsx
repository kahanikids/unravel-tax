import { useEffect, useState } from "react";
import { HOW_IT_WORKS, TOOL_TOUR_USE_CASES } from "../lib/copy";

const STEP_TITLES = ["What can it do", "How it works", "Try with sample data"];

/**
 * "Get to know the tool" entry point: a 3-step tour for someone who wants
 * the pitch and a feel for the flow before committing to real data. Distinct
 * from CapabilitiesPanel ("What can this do?"), which is the honest
 * available-vs-planned scope list for a more skeptical reader; this is the
 * friendlier walkthrough, and it's the one that can drop you straight into
 * the existing sample-data flow.
 */
export function ToolTour({
  open,
  onClose,
  onTrySample
}: {
  open: boolean;
  onClose: () => void;
  onTrySample: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const isLastStep = stepIndex === STEP_TITLES.length - 1;

  function handleTrySample() {
    onTrySample();
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-labelledby="tour-title" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">{`Step ${stepIndex + 1} of ${STEP_TITLES.length}`}</p>
        <h3 id="tour-title">{STEP_TITLES[stepIndex]}</h3>

        {stepIndex === 0 ? (
          <ul className="who-for-list">
            {TOOL_TOUR_USE_CASES.map((useCase) => (
              <li key={useCase}>{useCase}</li>
            ))}
          </ul>
        ) : null}

        {stepIndex === 1 ? (
          <>
            <ol className="help-steps">
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title}>
                  <strong>
                    {index + 1}. {step.title}
                  </strong>
                  <p>{step.detail}</p>
                </li>
              ))}
            </ol>
            <p>
              Every number comes from documented tax rules, never guessed by AI. At the end you get two files: a
              short summary for your CA, and a full workbook to keep.
            </p>
          </>
        ) : null}

        {stepIndex === 2 ? (
          <p>
            See it with a sample broker statement already loaded, so you can look around before entering anything
            real. Nothing on that screen is your actual data.
          </p>
        ) : null}

        <div className="tour-dots" aria-hidden="true">
          {STEP_TITLES.map((title, index) => (
            <span key={title} className={`tour-dot${index === stepIndex ? " tour-dot-current" : ""}`} />
          ))}
        </div>

        <div className="modal-actions">
          {stepIndex > 0 ? (
            <button type="button" className="text-button" onClick={() => setStepIndex((value) => value - 1)}>
              Back
            </button>
          ) : (
            <button type="button" className="text-button" onClick={onClose}>
              Skip
            </button>
          )}
          {isLastStep ? (
            <button type="button" className="primary-button" onClick={handleTrySample}>
              See With Sample Data
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={() => setStepIndex((value) => value + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
