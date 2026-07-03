import { STEP_LABELS, STEP_ORDER, type AppStep } from "../state/types";
import {
  IconChart,
  IconCompass,
  IconHelp,
  IconPerson,
  IconShield,
  IconSparkles,
  IconUpload
} from "./icons";

const RAIL_STEPS = STEP_ORDER.filter((step): step is Exclude<AppStep, "welcome"> => step !== "welcome");

const STEP_ICONS: Record<Exclude<AppStep, "welcome">, typeof IconPerson> = {
  orientation: IconPerson,
  documents: IconUpload,
  results: IconChart
};

const MOBILE_STEP_LABELS: Record<Exclude<AppStep, "welcome">, string> = {
  orientation: "About",
  documents: "Docs",
  results: "Files"
};

/**
 * Vertical, always-visible rail of the same step model ProgressSteps used to
 * show horizontally in the header (see DESIGN_NOTES.md for why this
 * replaced it). Persistent on every screen, including welcome, so a
 * resumed-but-not-yet-clicked-into session still shows where you left off
 * instead of looking like a reset back to step 1. Never a way to skip
 * ahead: only steps already reached (index <= furthestIndex) are clickable.
 */
/**
 * Always-available utility actions, kept visually and structurally separate
 * from the filing steps (bottom-anchored group) so they never look like a way
 * to skip ahead in the flow. Info/help only - no step-jump guard applies.
 */
const UTILITY_ITEMS = [
  { key: "help", label: "Help", mobileLabel: "Help", Icon: IconHelp },
  { key: "features", label: "Features", mobileLabel: "Tools", Icon: IconSparkles },
  { key: "tour", label: "Take a tour", mobileLabel: "Tour", Icon: IconCompass },
  { key: "legal", label: "Legal", mobileLabel: "Legal", Icon: IconShield }
] as const;

export function SideNav({
  current,
  furthestIndex,
  onNavigate,
  onShowHelp,
  onShowCapabilities,
  onShowTour,
  onShowLegal
}: {
  current: AppStep;
  furthestIndex: number;
  onNavigate: (step: AppStep) => void;
  onShowHelp: () => void;
  onShowCapabilities: () => void;
  onShowTour: () => void;
  onShowLegal: () => void;
}) {
  const currentIndex = STEP_ORDER.indexOf(current);
  const utilityHandlers: Record<(typeof UTILITY_ITEMS)[number]["key"], () => void> = {
    help: onShowHelp,
    features: onShowCapabilities,
    tour: onShowTour,
    legal: onShowLegal
  };

  return (
    <nav className="side-nav" aria-label="Filing steps">
      <div className="side-nav-steps">
      {RAIL_STEPS.map((step) => {
        const index = STEP_ORDER.indexOf(step);
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        const reached = index <= furthestIndex;
        const Icon = STEP_ICONS[step];
        const content = (
          <>
            <Icon className="side-nav-icon" />
            <span className="side-nav-label side-nav-label-full">{STEP_LABELS[step]}</span>
            <span className="side-nav-label side-nav-label-mobile">{MOBILE_STEP_LABELS[step]}</span>
          </>
        );

        return reached ? (
          <button
            type="button"
            key={step}
            className={`side-nav-step side-nav-step-${state}`}
            onClick={() => onNavigate(step)}
            aria-current={state === "current" ? "step" : undefined}
            title={STEP_LABELS[step]}
          >
            {content}
          </button>
        ) : (
          <span
            key={step}
            className={`side-nav-step side-nav-step-${state}`}
            aria-disabled="true"
            title={STEP_LABELS[step]}
          >
            {content}
          </span>
        );
      })}
      </div>

      <div className="side-nav-utility" aria-label="Help and information">
        {UTILITY_ITEMS.map(({ key, label, mobileLabel, Icon }) => (
          <button
            type="button"
            key={key}
            className="side-nav-step side-nav-util"
            onClick={utilityHandlers[key]}
            title={label}
          >
            <Icon className="side-nav-icon" />
            <span className="side-nav-label side-nav-label-full">{label}</span>
            <span className="side-nav-label side-nav-label-mobile">{mobileLabel}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
