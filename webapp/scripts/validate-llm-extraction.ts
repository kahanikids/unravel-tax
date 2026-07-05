#!/usr/bin/env node
/**
 * Deterministic LLM extraction validation (no live inference).
 * Scores saved spike outputs: raw vs post-process accuracy.
 * Live WebGPU benchmark is optional via spike/run-live-llm-benchmark.mjs.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parsePastedExtraction } from "../src/ingest";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const spikeDir = resolve(repoRoot, "spike");
const fixturesDir = resolve(repoRoot, "fixtures");

export async function main() {
  const scoreUrl = pathToFileURL(resolve(spikeDir, "score-extraction.mjs")).href;
  const { scoreExtraction } = await import(scoreUrl);

  const fixturePdfText = await readFile(
    resolve(fixturesDir, "sample-pdf-extracted-text.txt"),
    "utf8"
  );
  const llamaSaved = await readFile(
    resolve(spikeDir, "fixtures", "llama-sample-pdf-run.txt"),
    "utf8"
  );

  const rawScore = scoreExtraction(llamaSaved, fixturePdfText, false);
  const postScore = scoreExtraction(llamaSaved, fixturePdfText, true);

  if (!rawScore.ok) {
    throw new Error(`Saved Llama spike output failed to parse: ${rawScore.summary}`);
  }
  if (rawScore.matched !== 5) {
    throw new Error(
      `Expected raw Llama spike to match all 5 rows on amounts (dates may fail). Got: ${rawScore.summary}`
    );
  }
  if (postScore.matched !== 5 || postScore.dateIssues !== 0) {
    throw new Error(
      `Post-process should fix all dates on saved Llama spike. Got: ${postScore.summary}`
    );
  }

  const repaired = parsePastedExtraction(llamaSaved, fixturePdfText);
  if (repaired.transactions.length !== 5) {
    throw new Error(
      `parsePastedExtraction with post-process should yield 5 rows, got ${repaired.transactions.length}.`
    );
  }

  const livePath = resolve(spikeDir, "fixtures", "llama-live-broker-cg.txt");
  try {
    const liveRaw = await readFile(livePath, "utf8");
    const liveRawScore = scoreExtraction(liveRaw, fixturePdfText, false);
    const livePostScore = scoreExtraction(liveRaw, fixturePdfText, true);
    console.log(
      `Live benchmark file present: raw=${liveRawScore.summary}; post-process=${livePostScore.summary}`
    );
  } catch {
    console.log(
      "No llama-live-broker-cg.txt yet (optional). Run: node spike/run-live-llm-benchmark.mjs"
    );
  }

  console.log(
    `Validated LLM extraction scoring: saved spike raw=${rawScore.summary}; post-process=${postScore.summary} (5/5 rows, dates repaired).`
  );
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main();
}
