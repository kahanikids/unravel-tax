import { useEffect } from "react";
import { CAPABILITIES } from "../lib/copy";

/**
 * "What can this do?" modal: a full scope preview for a skeptical
 * first-time user who wants to see everything the tool does and doesn't do
 * yet before entering any personal data. Same spirit as HelpPanel (a
 * transparency check, not a decision to make).
 *
 * Controlled from outside (App.tsx owns `open` state) rather than managing
 * its own, because more than one trigger opens the same panel: the header
 * button (every step, including welcome) and a dedicated corner button on
 * the welcome card itself. Both share this one modal instance instead of
 * each spawning their own.
 */
export function CapabilitiesPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const available = CAPABILITIES.filter((capability) => capability.status === "available");
  const partial = CAPABILITIES.filter((capability) => capability.status === "partial");
  const planned = CAPABILITIES.filter((capability) => capability.status === "planned");

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-labelledby="capabilities-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="capabilities-title">What this tool can do</h3>
        <p>
          The full picture before you enter anything: what's live today, and what's still planned. Nothing here is a
          step you need to complete.
        </p>

        <h4 className="capabilities-group-title">Available now</h4>
        <ul className="capabilities-list">
          {available.map((capability) => (
            <li key={capability.label}>
              <details className="capabilities-item">
                <summary className="capabilities-item-heading">
                <strong>{capability.label}</strong>
                <span className="pill pill-ready">Available</span>
                </summary>
                <p>{capability.detail}</p>
              </details>
            </li>
          ))}
        </ul>

        <h4 className="capabilities-group-title">Partial, use with care</h4>
        <ul className="capabilities-list">
          {partial.map((capability) => (
            <li key={capability.label}>
              <details className="capabilities-item">
                <summary className="capabilities-item-heading">
                <strong>{capability.label}</strong>
                <span className="pill pill-neutral">Partial</span>
                </summary>
                <p>{capability.detail}</p>
              </details>
            </li>
          ))}
        </ul>

        <h4 className="capabilities-group-title">Planned, not yet available</h4>
        <ul className="capabilities-list">
          {planned.map((capability) => (
            <li key={capability.label}>
              <details className="capabilities-item">
                <summary className="capabilities-item-heading">
                <strong>{capability.label}</strong>
                <span className="pill pill-neutral">Coming soon</span>
                </summary>
                <p>{capability.detail}</p>
              </details>
            </li>
          ))}
        </ul>

        <div className="modal-actions">
          <button type="button" className="primary-button" onClick={onClose}>
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
