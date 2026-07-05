#!/usr/bin/env node
/**
 * Live Llama 3.2 3B extraction benchmark via Playwright + WebGPU.
 * Requires Chrome/Chromium with GPU. GitHub-hosted CI cannot run this.
 *
 * Usage (from repo root):
 *   cd webapp && npm install && npx playwright install chromium
 *   node ../spike/run-live-llm-benchmark.mjs [--headed] [--doc broker-cg] [--skip-run]
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webappDir = resolve(repoRoot, "webapp");
const fixturesOutDir = resolve(repoRoot, "spike", "fixtures");

const args = process.argv.slice(2);
const headed = args.includes("--headed");
const skipRun = args.includes("--skip-run");
const docArg = args.find((a) => a.startsWith("--doc="))?.split("=")[1]
  ?? (args.includes("--doc") ? args[args.indexOf("--doc") + 1] : "broker-cg");

function findFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
    server.on("error", reject);
  });
}

function waitForUrl(url, timeoutMs = 60_000) {
  const start = Date.now();
  return new Promise((resolveWait, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          resolveWait();
          return;
        }
      } catch { /* retry */ }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function startDevServer(port) {
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(
    npmCmd,
    ["run", "dev", "--", "--port", String(port), "--strictPort"],
    {
      cwd: webappDir,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" }
    }
  );
  child.stdout.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[vite] ${chunk}`));
  return child;
}

async function scoreOutput(filePath) {
  const mod = await import(pathToFileURL(resolve(repoRoot, "spike", "score-extraction.mjs")).href);
  const raw = readFileSync(filePath, "utf8");
  const rawScore = mod.scoreExtraction(raw, undefined, false);
  const postScore = mod.scoreExtraction(raw, undefined, true);
  return { rawScore, postScore };
}

async function main() {
  mkdirSync(fixturesOutDir, { recursive: true });
  const outFile = resolve(fixturesOutDir, `llama-live-${docArg}.txt`);

  if (skipRun) {
    if (!existsSync(outFile)) {
      console.error(`No output at ${outFile}. Run without --skip-run first.`);
      process.exit(1);
    }
    const { rawScore, postScore } = await scoreOutput(outFile);
    console.log(`\nScored ${outFile}:`);
    console.log(`  RAW:          ${rawScore.summary}`);
    console.log(`  POST-PROCESS: ${postScore.summary}`);
    return;
  }

  let playwright;
  try {
    const requireFromWebapp = createRequire(pathToFileURL(resolve(webappDir, "package.json")).href);
    playwright = requireFromWebapp("playwright");
  } catch {
    console.error(
      "Playwright not installed. From webapp/: npm install -D playwright && npx playwright install chromium"
    );
    process.exit(1);
  }

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const spikeUrl = `${baseUrl}/spike-llm-compare.html`;

  console.log(`Starting Vite on ${baseUrl}…`);
  const vite = await startDevServer(port);
  try {
    await waitForUrl(baseUrl);

    const browser = await playwright.chromium.launch({
      headless: !headed,
      args: [
        "--enable-unsafe-webgpu",
        "--enable-features=Vulkan,UseSkiaRenderer",
        "--use-angle=default"
      ]
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log(`Opening ${spikeUrl}…`);
    await page.goto(spikeUrl, { waitUntil: "networkidle", timeout: 120_000 });

    const webgpu = await page.evaluate(async () => {
      if (!("gpu" in navigator)) return false;
      try {
        const adapter = await navigator.gpu.requestAdapter();
        return adapter !== null;
      } catch {
        return false;
      }
    });

    if (!webgpu) {
      console.error(
        "WebGPU not available in this browser context. Try --headed on a machine with a GPU, or run the spike page manually."
      );
      await browser.close();
      process.exit(2);
    }

    console.log(`Loading doc type "${docArg}" and running Llama (this may take several minutes on first run)…`);
    await page.evaluate(async (docType) => {
      await window.loadDocType(docType);
    }, docArg);

    const result = await page.evaluate(async () => {
      return window.runLlamaBenchmark();
    });

    if (!result?.rawText) {
      throw new Error("Benchmark returned no output");
    }

    writeFileSync(outFile, result.rawText, "utf8");
    console.log(`Saved raw output to ${outFile}`);

    const { rawScore, postScore } = await scoreOutput(outFile);
    console.log("\n=== Benchmark results ===");
    console.log(`  docType:      ${docArg}`);
    console.log(`  RAW:          ${rawScore.summary}`);
    console.log(`  POST-PROCESS: ${postScore.summary}`);

    await browser.close();
  } finally {
    vite.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
