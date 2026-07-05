import { useEffect, useState } from "react";
import { IconChecklist, IconCompass, IconUpload } from "./icons";
import { LEGAL_INTRO, LEGAL_SECTIONS, REPORT_ISSUE_URL, REPO_URL, WELCOME_DISCLAIMER_BANNER } from "../lib/copy";

const WELCOME_DISCLAIMER_KEY = "unravel-tax-welcome-disclaimer-dismissed";

export function WelcomeScreen({
  onStart,
  onStartComputationFirst,
  onResume,
  onStartOver,
  hasSavedSession,
  onShowCapabilities,
  onShowTour,
  localFolderSupported,
  onRestoreFromFolder,
  onImportPreviousWorkbook
}: {
  onStart: () => void;
  onStartComputationFirst: () => void;
  onResume: () => void;
  onStartOver: () => void;
  hasSavedSession: boolean;
  onShowCapabilities: () => void;
  onShowTour: () => void;
  localFolderSupported: boolean;
  onRestoreFromFolder: () => void;
  /** Reads a previously exported Unravel Tax workbook to prefill this year's profile and carry-forward-loss figures. */
  onImportPreviousWorkbook: (file: File) => void;
}) {
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(WELCOME_DISCLAIMER_KEY) === "1") {
      setDisclaimerDismissed(true);
    }
  }, []);

  function dismissDisclaimer() {
    localStorage.setItem(WELCOME_DISCLAIMER_KEY, "1");
    setDisclaimerDismissed(true);
  }

  return (
    <div className="welcome-card">
      {!disclaimerDismissed ? (
        <div className="welcome-disclaimer-banner" role="status">
          <p>{WELCOME_DISCLAIMER_BANNER}</p>
          <button type="button" className="text-button welcome-disclaimer-dismiss" onClick={dismissDisclaimer}>
            Got It
          </button>
        </div>
      ) : null}
      <div className="welcome-card-header">
        <p className="eyebrow">Unravel Tax</p>
        <button type="button" className="secondary-button welcome-capabilities-trigger" onClick={onShowCapabilities}>
          Tools Features
        </button>
      </div>
      <h1 className="welcome-title">
        <span className="welcome-title-desktop">Turn a pile of tax documents into a filing you understand.</span>
        <span className="welcome-title-mobile">Tax documents, sorted.</span>
      </h1>

      <div className="welcome-badges">
        <span className="welcome-badge">No signup</span>
        <span className="welcome-badge welcome-badge-formats">
          <span className="welcome-badge-desktop">Most File Formats</span>
          <span className="welcome-badge-mobile">CSV/Excel/PDF</span>
        </span>
        <span className="welcome-badge">
          <span className="welcome-badge-desktop">Stays in your browser</span>
          <span className="welcome-badge-mobile">Browser-only</span>
        </span>
      </div>
      <p className="welcome-time-estimate">Takes about 15-20 minutes.</p>

      {hasSavedSession ? (
        <div className="resume-banner">
          <p>You have a filing in progress, saved in this browser.</p>
          <div className="resume-banner-actions">
            <button type="button" className="primary-button" onClick={onResume}>
              <span className="welcome-resume-desktop">Resume Where You Left Off</span>
              <span className="welcome-resume-mobile">Resume</span>
            </button>
            <button type="button" className="secondary-button" onClick={onStartOver}>
              Start Over
            </button>
          </div>
        </div>
      ) : null}

      <p className="entry-path-lede">
        Pick how you'd like to begin:
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
            <h3>Add Documents</h3>
            <p>Skip the questions. Upload and see your numbers.</p>
          </span>
        </button>
        <button type="button" className="entry-path-card" onClick={onShowTour}>
          <IconCompass className="entry-path-icon" />
          <span className="entry-path-text">
            <h3>Get To Know The Tool</h3>
            <p>A quick tour, then try it with sample data.</p>
          </span>
        </button>
      </div>

      {localFolderSupported ? (
        <p className="welcome-restore">
          Saved a filing to a folder before?{" "}
          <button type="button" className="text-button" onClick={onRestoreFromFolder}>
            Restore From A Folder
          </button>
        </p>
      ) : null}

      <p className="welcome-restore">
        Filed with Unravel Tax last year?{" "}
        <label className="text-button">
          Import Last Year's Workbook
          <input
            type="file"
            accept=".xlsx"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImportPreviousWorkbook(file);
              }
              event.target.value = "";
            }}
          />
        </label>{" "}
        to prefill your profile answers and carry-forward losses.
      </p>

      <details className="welcome-legal">
        <summary>Legal, AI Use &amp; Privacy</summary>
        <div className="welcome-legal-body">
          {LEGAL_INTRO.map((part) => (
            <p className="welcome-legal-intro" key={part.label}>
              <strong>{part.label}:</strong> {part.text}
            </p>
          ))}
          {LEGAL_SECTIONS.map((section) => (
            <section className="welcome-legal-section" key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </section>
          ))}
          <p className="welcome-legal-links">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              View The Source On GitHub
            </a>
            <span aria-hidden="true"> · </span>
            <a href={REPORT_ISSUE_URL} target="_blank" rel="noopener noreferrer">
              Report An Issue
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}
