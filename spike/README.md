# LLM extraction spike

Browser-only Llama 3.2 3B extraction benchmark for PDF/free-form document text.

## Quick start (interactive)

From `webapp/`:

```bash
npm run dev
```

Open [http://127.0.0.1:5173/spike-llm-compare.html](http://127.0.0.1:5173/spike-llm-compare.html) in **Chrome or Edge** with a GPU. First run downloads ~2 GB of model weights.

Use the doc-type buttons to load fixtures, then **Run Llama extraction**. Scores appear for the broker CG fixture (ground truth in `fixtures/sample-broker-statement.csv`).

## Live benchmark (script)

From repo root (requires WebGPU + Chrome):

```bash
cd webapp
npm install
npx playwright install chromium
node ../spike/run-live-llm-benchmark.mjs
```

Outputs land in `spike/fixtures/llama-live-*.txt`. The script prints raw vs post-process scores using `spike/score-extraction.mjs`.

Options:

- `--headed` — show the browser window (useful when headless WebGPU fails)
- `--doc broker-cg` — run one doc type only (default: broker-cg)
- `--skip-run` — score existing outputs only

## Score saved outputs

```bash
node spike/score-extraction.mjs --compare-post-process spike/fixtures/llama-live-broker-cg.txt
node spike/score-extraction.mjs spike/fixtures/llama-sample-pdf-run.txt
```

`--compare-post-process` prints both raw LLM accuracy and accuracy after deterministic date repair.

## CI limitations

**GitHub-hosted runners do not expose WebGPU.** The main `validate.yml` workflow runs deterministic checks only:

- Post-process repair on saved spike output (`validate-ingest.ts`)
- `validate-llm-extraction.ts` scores fixture files without calling the model

Optional workflow `.github/workflows/live-llm-benchmark.yml` is `workflow_dispatch` only — run it on a **self-hosted GPU machine** or locally, not on `ubuntu-latest`.

Do not block merges on live LLM inference in CI.

## Doc types in the spike page

| Preset | Fixture | Scoring |
|--------|---------|---------|
| Broker CG | `fixtures/sample-pdf-extracted-text.txt` | 5-row ground truth |
| ITR-V | `fixtures/sample-itr-v.pdf` (pdf.js extract) | Informational only |
| AIS summary | `fixtures/sample-ais-summary.txt` | Informational (annual figures) |
| Custom | Paste or PDF upload | Manual |
