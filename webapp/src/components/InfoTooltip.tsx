import { useEffect, useId, useRef, useState } from "react";

/**
 * Small "i" icon that reveals a short note on click/tap. Used for context
 * that's helpful but would otherwise crowd the main flow with extra text.
 */
export function InfoTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span className="info-tooltip" ref={rootRef}>
      <button
        type="button"
        className="info-tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        i
      </button>
      {open ? (
        <span className="info-tooltip-popover" role="tooltip" id={popoverId}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
