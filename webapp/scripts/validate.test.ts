import { describe, it } from "vitest";
import { main as validateIngest } from "./validate-ingest";
import { main as validateCalculations } from "./validate-calculations";
import { main as validateReconciliation } from "./validate-reconciliation";
import { main as validateExports } from "./validate-exports";
import { main as validateGuidedUi } from "./validate-guided-ui";

// Runs the existing validate:* scripts under Vitest so `npm run test:coverage`
// reports real coverage against src/ while the scripts stay runnable
// standalone (npm run validate:ingest etc.) for day-to-day debugging.
describe("validate suite", () => {
  it("ingest", async () => {
    await validateIngest();
  });

  it("calculations", async () => {
    await validateCalculations();
  });

  it("reconciliation", async () => {
    await validateReconciliation();
  });

  it("exports", async () => {
    await validateExports();
  });

  it("guided ui", () => {
    validateGuidedUi();
  });
});
