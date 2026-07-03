import { IconChecklist, IconCompass, IconUpload } from "./icons";

export function WelcomeScreen({
  onStart,
  onStartComputationFirst,
  onResume,
  hasSavedSession,
  onShowCapabilities,
  onShowTour
}: {
  onStart: () => void;
  onStartComputationFirst: () => void;
  onResume: () => void;
  hasSavedSession: boolean;
  onShowCapabilities: () => void;
  onShowTour: () => void;
}) {
  return (
    <div className="welcome-card">
      <div className="welcome-card-header">
        <p className="eyebrow">Unravel Tax</p>
        <button type="button" className="text-button welcome-capabilities-trigger" onClick={onShowCapabilities}>
          What can this do?
        </button>
      </div>
      <h1 className="welcome-title">Turn a pile of tax documents into a filing you understand.</h1>

      <div className="welcome-badges">
        <span className="welcome-badge">No signup</span>
        <span className="welcome-badge">Most File Formats</span>
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

      <p className="entry-path-lede">
        {hasSavedSession ? "Or start something new. Pick how you'd like to begin:" : "Pick how you'd like to begin:"}
      </p>

      <div className="entry-path-cards">
        <button type="button" className="entry-path-card" onClick={onStart}>
          <IconChecklist className="entry-path-icon" />
          <span className="entry-path-text">
            <h3>Checklist</h3>
            <p>A few quick questions, tailored to you.</p>
          </span>
        </button>
        <button type="button" className="entry-path-card" onClick={onStartComputationFirst}>
          <IconUpload className="entry-path-icon" />
          <span className="entry-path-text">
            <h3>Start with Computation</h3>
            <p>Skip ahead. See your numbers first.</p>
          </span>
        </button>
        <button type="button" className="entry-path-card" onClick={onShowTour}>
          <IconCompass className="entry-path-icon" />
          <span className="entry-path-text">
            <h3>Get to know the tool</h3>
            <p>A quick tour, then try it with sample data.</p>
          </span>
        </button>
      </div>
    </div>
  );
}
