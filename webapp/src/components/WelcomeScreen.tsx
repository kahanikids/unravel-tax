export function WelcomeScreen({
  onStart,
  onStartComputationFirst,
  onTrySample,
  onResume,
  hasSavedSession,
  onShowCapabilities
}: {
  onStart: () => void;
  onStartComputationFirst: () => void;
  onTrySample: () => void;
  onResume: () => void;
  hasSavedSession: boolean;
  onShowCapabilities: () => void;
}) {
  return (
    <div className="welcome-card">
      <p className="eyebrow">Unravel Tax</p>
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
          <h3>Checklist</h3>
          <p>Answer a few quick questions. We build your personal document checklist as you go.</p>
          <span className="entry-path-cta">Start the checklist →</span>
        </button>
        <button type="button" className="entry-path-card" onClick={onStartComputationFirst}>
          <h3>Start with Computation</h3>
          <p>Skip the questions. Drop in your documents and see your numbers right away.</p>
          <span className="entry-path-cta">Jump to my documents →</span>
        </button>
        <button type="button" className="entry-path-card" onClick={onShowCapabilities}>
          <h3>Get to know the tool</h3>
          <p>Not ready to commit? Take the tour and see what this can and can't do.</p>
          <span className="entry-path-cta">Show me around →</span>
        </button>
      </div>

      <div className="welcome-actions">
        <button type="button" className="text-button" onClick={onTrySample}>
          See with Sample Data
        </button>
      </div>
    </div>
  );
}
