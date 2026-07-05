import { useEffect, useState } from "react";
import { ruleCatalog } from "../rules";
import { IconHourglass } from "./icons";

// Deadline is the resident ITR-1/2 due date from rules/itr-form-selection.json
// (never hardcoded here), taken to end of that day in IST. It's the earliest
// common due date, so it's the honest one to show before we know a profile.
const DUE_DATE = ruleCatalog.itrFormSelection.values.forms.resident_simple.due_date;
const DEADLINE = new Date(`${DUE_DATE}T23:59:59+05:30`).getTime();

function parts(msLeft: number) {
  const s = Math.floor(msLeft / 1000);
  return [
    { value: Math.floor(s / 86400), label: "Days" },
    { value: Math.floor((s % 86400) / 3600), label: "Hrs" },
    { value: Math.floor((s % 3600) / 60), label: "Mins" },
    { value: s % 60, label: "Secs" }
  ];
}

export function CountdownBanner({ variant }: { variant?: "header" } = {}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const msLeft = DEADLINE - now;
  const dueLabel = new Date(DEADLINE).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <div
      className={
        variant === "header" ? "countdown-banner countdown-banner-header" : "countdown-banner"
      }
      role="timer"
      aria-live="off"
    >
      <div className="countdown-lede">
        <IconHourglass className="countdown-icon" />
        <span className="countdown-title">ITR Filing Deadline</span>
      </div>
      {msLeft > 0 ? (
        <div className="countdown-units">
          {parts(msLeft).map((part) => (
            <div className="countdown-unit" key={part.label}>
              <span className="countdown-value">{String(part.value).padStart(2, "0")}</span>
              <span className="countdown-label">{part.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="countdown-closed">
          Closed on {dueLabel}. A late return may still be possible.
        </span>
      )}
    </div>
  );
}
