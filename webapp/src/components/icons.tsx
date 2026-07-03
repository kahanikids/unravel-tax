/**
 * Hand-rolled line icons, shared between the welcome screen's entry-path
 * cards and the side nav rail so the same shape means the same step
 * everywhere. No icon library dependency: each is a few SVG paths, sized to
 * inherit color and dimensions from its container via `currentColor`/CSS.
 */
type IconProps = { className?: string };

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

export function IconPerson({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c1.4-4 4-5.6 7-5.6s5.6 1.6 7 5.6" />
    </svg>
  );
}

export function IconChecklist({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden="true">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M8.5 12l1.6 1.6L13.5 10" />
      <path d="M9 16.5h6" />
    </svg>
  );
}

export function IconUpload({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden="true">
      <path d="M6 21h12" />
      <path d="M12 15V4" />
      <path d="M7.2 8.5L12 4l4.8 4.5" />
    </svg>
  );
}

export function IconChart({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden="true">
      <path d="M4 20V11" />
      <path d="M11 20V4" />
      <path d="M18 20v-6.5" />
    </svg>
  );
}

export function IconCompass({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.4" />
      <path d="M14.6 9.4l-2 4.6-4.6 2 2-4.6z" />
    </svg>
  );
}
