import { useEffect, useState } from "react";
import { DISCLAIMER_FULL, HOW_IT_WORKS, WHO_ITS_FOR, WHO_ITS_FOR_EXCLUDES, WHO_ITS_FOR_TAGLINE } from "../lib/copy";

/**
 * The "?" help affordance: how the guided flow works, who it's built for,
 * and the fuller disclaimer, all in one place instead of cluttering every
 * screen with the full explanation. Available from any step, including
 * welcome, so a first-time visitor can check "is this for me?" up front.
 * Unlike the confirm/risk-trigger modals, this one is informational, not a
 * decision to make - closes on backdrop click, Escape, or the button.
 */
export function HelpPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="help-button"
        aria-label="How this works, and who it's for"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-labelledby="help-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="help-title">How this works</h3>
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

            <h3>Who it's for</h3>
            <p className="who-for-tagline">{WHO_ITS_FOR_TAGLINE}</p>
            <ul className="who-for-list">
              {WHO_ITS_FOR.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            <p className="who-for-excludes">{WHO_ITS_FOR_EXCLUDES}</p>

            <h3>Before you rely on this</h3>
            <p>{DISCLAIMER_FULL}</p>

            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
