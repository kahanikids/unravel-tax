import { useState } from "react";
import { DOCUMENT_SOURCE_GUIDE } from "../lib/copy";

/**
 * "Where do I get this?" expandable, shown next to a checklist document
 * whenever static guidance exists for it (lib/copy.ts#DOCUMENT_SOURCE_GUIDE).
 * Renders nothing for documents without an entry - this is reference copy
 * for the handful of genuinely-confusing sources, not a claim of full
 * broker coverage.
 */
export function DocumentSourceHint({ document }: { document: string }) {
  const [open, setOpen] = useState(false);
  const guide = DOCUMENT_SOURCE_GUIDE[document];

  if (!guide) {
    return null;
  }

  return (
    <div className="source-hint">
      <button type="button" className="text-button source-hint-toggle" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide where to get this" : "Where do I get this?"}
      </button>
      {open ? (
        <div className="source-hint-body">
          <p>{guide.summary}</p>
          <ul>
            {guide.sources.map((source) => (
              <li key={source.name}>
                <strong>{source.name}: </strong>
                {source.steps}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
