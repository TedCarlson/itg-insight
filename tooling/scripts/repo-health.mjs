import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, "tooling/reports/repo-health-latest.json");

const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".scss",
  ".sql",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".txt",
]);

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, fullPath);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      files.push(...walk(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!isTextFile(fullPath)) continue;

    files.push(rel);
  }

  return files;
}

function countLoc(relPath) {
  const fullPath = path.join(repoRoot, relPath);
  const text = fs.readFileSync(fullPath, "utf8");
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
}

function topGroup(relPath) {
  const first = relPath.split(path.sep)[0];
  if (["apps", "packages", "supabase", "scripts", "tooling", "docs", ".github"].includes(first)) {
    return first;
  }
  return "root";
}

function addMetric(map, key, loc) {
  const current = map.get(key) ?? { files: 0, loc: 0 };
  current.files += 1;
  current.loc += loc;
  map.set(key, current);
}

const files = walk(repoRoot);

const byGroup = new Map();
const byAppsWebSrc = new Map();
const byExtension = new Map();
const fileMetrics = [];

for (const file of files) {
  const loc = countLoc(file);
  const ext = path.extname(file).toLowerCase() || "[none]";

  addMetric(byGroup, topGroup(file), loc);
  addMetric(byExtension, ext, loc);

  const normalized = file.split(path.sep).join("/");
  const appsWebPrefix = "apps/web/src/";

  if (normalized.startsWith(appsWebPrefix)) {
    const rest = normalized.slice(appsWebPrefix.length);
    const srcGroup = rest.split("/")[0] || "src";
    addMetric(byAppsWebSrc, `src/${srcGroup}`, loc);
  }

  fileMetrics.push({ path: normalized, loc, extension: ext });
}

fileMetrics.sort((a, b) => b.loc - a.loc);

const totalLoc = fileMetrics.reduce((sum, file) => sum + file.loc, 0);

const snapshot = {
  generated_at: new Date().toISOString(),
  total: {
    files: fileMetrics.length,
    loc: totalLoc,
  },
  by_group: Object.fromEntries([...byGroup.entries()].sort((a, b) => b[1].loc - a[1].loc)),
  apps_web_src: Object.fromEntries([...byAppsWebSrc.entries()].sort((a, b) => b[1].loc - a[1].loc)),
  by_extension: Object.fromEntries([...byExtension.entries()].sort((a, b) => b[1].loc - a[1].loc)),
  large_files: fileMetrics.filter((file) => file.loc >= 500).slice(0, 50),
  largest_files: fileMetrics.slice(0, 25),
};

fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
console.log(`Files: ${snapshot.total.files}`);
console.log(`LOC: ${snapshot.total.loc}`);
