import { useEffect, useId, useRef, useState } from "react";

/**
 * Small "i" icon that reveals a short note on click/tap. Click-based (not
 * hover) so it works on touch devices, and the bubble's width is clamped to
 * the viewport so it never runs off-screen on narrow phones.
 */
export function InfoTooltip({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
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
    <span className={className ? `info-tip ${className}` : "info-tip"} ref={rootRef}>
      <button
        type="button"
        className="info-tip-trigger"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        i
      </button>
      {open ? (
        <span className="info-tip-bubble" role="tooltip" id={popoverId}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
