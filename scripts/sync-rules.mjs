#!/usr/bin/env node
/**
 * Copy rules/*.json (source of truth) into webapp/src/rules/data/.
 * Run after editing rules/ and before committing webapp changes.
 */
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
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

const sourceFiles = listJsonFiles(RULES_DIR);
const destFiles = listJsonFiles(WEBAPP_DATA_DIR);

const sourceSet = new Set(sourceFiles);
const destSet = new Set(destFiles);

const orphansInDest = destFiles.filter((name) => !sourceSet.has(name));
const missingInDest = sourceFiles.filter((name) => !destSet.has(name));

if (orphansInDest.length > 0) {
  console.error(
    `webapp/src/rules/data/ has JSON files not in rules/: ${orphansInDest.join(", ")}`
  );
  process.exit(1);
}

mkdirSync(WEBAPP_DATA_DIR, { recursive: true });

for (const name of sourceFiles) {
  copyFileSync(join(RULES_DIR, name), join(WEBAPP_DATA_DIR, name));
}

if (missingInDest.length > 0) {
  console.log(`Added ${missingInDest.length} new rule file(s) to webapp/src/rules/data/`);
}

console.log(`Synced ${sourceFiles.length} rule JSON file(s) to webapp/src/rules/data/`);
