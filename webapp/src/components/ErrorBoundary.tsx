import { Component, type ErrorInfo, type ReactNode } from "react";
import { REPORT_ISSUE_URL, REPO_URL } from "../lib/copy";

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Catches uncaught render errors so the user gets a recovery screen instead
 * of a blank page. No server logging — this app has no backend.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      // Dev-only: helps local debugging without sending data anywhere.
      console.error("[Unravel Tax]", error, info.componentStack);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>
            Your filing may still be saved in this browser. Reload the page to try again, or start fresh from the
            welcome screen.
          </p>
          <div className="error-boundary-actions">
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              Reload This Page
            </button>
            <a className="secondary-button" href={REPORT_ISSUE_URL} target="_blank" rel="noopener noreferrer">
              Report An Issue
            </a>
            <a className="text-button" href={REPO_URL} target="_blank" rel="noopener noreferrer">
              View Source On GitHub
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
