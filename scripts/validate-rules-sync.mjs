#!/usr/bin/env node
/**
 * Fail if rules/*.json and webapp/src/rules/data/*.json are out of sync.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RULES_DIR = join(REPO_ROOT, "rules");
const WEBAPP_DATA_DIR = join(REPO_ROOT, "webapp", "src", "rules", "data");

function listJsonFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort();
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const sourceFiles = listJsonFiles(RULES_DIR);
const destFiles = listJsonFiles(WEBAPP_DATA_DIR);

if (sourceFiles.length === 0) {
  console.error("No JSON files found in rules/");
  process.exit(1);
}

const destSet = new Set(destFiles);
const failures = [];

for (const name of sourceFiles) {
  if (!destSet.has(name)) {
    failures.push(`Missing in webapp/src/rules/data/: ${name}`);
    continue;
  }
  const sourceHash = hashFile(join(RULES_DIR, name));
  const destHash = hashFile(join(WEBAPP_DATA_DIR, name));
  if (sourceHash !== destHash) {
    failures.push(`Out of sync: ${name} (run: cd webapp && npm run sync-rules)`);
  }
}

for (const name of destFiles) {
  if (!sourceFiles.includes(name)) {
    failures.push(`Orphan in webapp/src/rules/data/: ${name}`);
  }
}

if (failures.length > 0) {
  console.error("Rule sync validation failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${sourceFiles.length} rule JSON file(s) in sync.`);
