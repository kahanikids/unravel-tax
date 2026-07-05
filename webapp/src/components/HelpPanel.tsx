import { useCallback, useEffect, useState } from "react";
import {
  DISCLAIMER_FULL,
  HOW_IT_WORKS,
  REPORT_ISSUE_URL,
  WHO_ITS_FOR,
  WHO_ITS_FOR_EXCLUDES,
  WHO_ITS_FOR_TAGLINE
} from "../lib/copy";

type HelpPanelProps = {
  /** Test-only: render the dialog open on first paint (validate-guided-ui). */
  initialOpen?: boolean;
  /**
   * Optional controlled mode: when `open` is passed, App owns the state so the
   * side-nav "Help" item and the header "?" open the same panel. Left
   * undefined, the panel manages its own open state (standalone in the header).
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/**
 * The "?" help affordance: how the guided flow works, who it's built for,
 * and the fuller disclaimer, all in one place instead of cluttering every
 * screen with the full explanation. Available from any step, including
 * welcome, so a first-time visitor can check "is this for me?" up front.
 * Unlike the confirm/risk-trigger modals, this one is informational, not a
 * decision to make - closes on backdrop click, Escape, or the button.
 */
export function HelpPanel({
  initialOpen = false,
  open: controlledOpen,
  onOpenChange
}: HelpPanelProps) {
  const [internalOpen, setInternalOpen] = useState(initialOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalOpen(value);
      }
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );

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
  }, [open, setOpen]);

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
            <p>
              <a href={REPORT_ISSUE_URL} target="_blank" rel="noopener noreferrer">
                Something Wrong? Report It On GitHub
              </a>
            </p>

            <div className="modal-actions">
              <button type="button" className="primary-button" onClick={() => setOpen(false)}>
                Got It
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
