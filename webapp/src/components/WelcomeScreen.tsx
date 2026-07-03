import { DISCLAIMER_SHORT } from "../lib/copy";

export function WelcomeScreen({
  onStart,
  onTrySample,
  onResume,
  hasSavedSession
}: {
  onStart: () => void;
  onTrySample: () => void;
  onResume: () => void;
  hasSavedSession: boolean;
}) {
  return (
    <div className="welcome-card">
      <p className="eyebrow">Unravel Tax</p>
      <h1 className="welcome-title">Turn a pile of tax documents into a filing you understand.</h1>

      <div className="welcome-badges">
        <span className="welcome-badge">No signup</span>
        <span className="welcome-badge">Any file format</span>
        <span className="welcome-badge">Stays in your browser</span>
      </div>

      {hasSavedSession ? (
        <div className="resume-banner">
          <p>You have a filing in progress, saved in this browser.</p>
          <button type="button" className="primary-button" onClick={onResume}>
            Resume where you left off
          </button>
        </div>
      ) : null}

      <div className="welcome-actions">
        <button type="button" className={hasSavedSession ? "text-button" : "primary-button"} onClick={onStart}>
          {hasSavedSession ? "Start a new filing instead" : "Get started"}
        </button>
        <button type="button" className="text-button" onClick={onTrySample}>
          See it with sample data first
        </button>
      </div>

      <p className="disclaimer-banner">{DISCLAIMER_SHORT}</p>
    </div>
  );
}
