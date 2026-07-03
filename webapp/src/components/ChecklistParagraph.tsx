import { useState } from "react";

function splitSentences(text: string): string[] {
  const parts = text.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

/** Long checklist copy shows two sentences; the rest sits behind More/Less. */
export function ChecklistParagraph({ text }: { text: string }) {
  const sentences = splitSentences(text);
  const [expanded, setExpanded] = useState(false);

  if (sentences.length <= 2) {
    return <p>{text}</p>;
  }

  return (
    <p>
      {expanded ? text : `${sentences.slice(0, 2).join(" ")} `}
      <button type="button" className="text-button checklist-text-toggle" onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Less" : "More"}
      </button>
    </p>
  );
}
