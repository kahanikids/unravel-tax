import { renderToString } from "react-dom/server";
import App from "../src/App";

function main() {
  const html = renderToString(<App />);
  assertIncludes(html, "Things To Check");
  assertIncludes(html, "AIS / Form 26AS");
  assertIncludes(html, "Bank interest certificates");
  assertIncludes(html, "Short-Term Capital Gains");
  assertIncludes(html, "Show full detail");

  const checksIndex = html.indexOf("Things To Check");
  const totalsIndex = html.indexOf("Simple Summary");
  if (checksIndex === -1 || totalsIndex === -1 || checksIndex > totalsIndex) {
    throw new Error("Default view must show checklist consequences before totals.");
  }

  if (html.includes("Advanced Detail") || html.includes("Show simple view")) {
    throw new Error("First-time default view should be simple; advanced detail must require the explicit toggle.");
  }

  console.log("Validated guided UI: first-time view shows checks before totals and keeps advanced detail opt-in.");
}

function assertIncludes(value: string, expected: string) {
  if (!value.includes(expected)) {
    throw new Error(`Rendered UI is missing: ${expected}`);
  }
}

main();
