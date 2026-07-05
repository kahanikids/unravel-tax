const URL_PATTERN = /^https?:\/\//i;

/**
 * Compact "Source" link for a claim/rule shown in the UI. Reads the first
 * URL out of a rules/*.json `source_refs` array at runtime, so the link
 * always points at whatever the rule cites (never a URL hardcoded here).
 * Renders nothing when a rule only cites internal docs (BUILD_PLAN.md,
 * SYSTEM_SPEC.md) or bare Act sections, so those stay link-free rather than
 * showing a dead anchor.
 */
export function RuleSourceLink({
  refs,
  label = "Source"
}: {
  refs: readonly string[];
  label?: string;
}) {
  const url = refs.find((ref) => URL_PATTERN.test(ref));
  if (!url) {
    return null;
  }
  return (
    <a className="rule-source-link" href={url} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
