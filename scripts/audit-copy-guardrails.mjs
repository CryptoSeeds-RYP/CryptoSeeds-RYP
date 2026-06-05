import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const scanTargets = [
  "src",
  "scripts",
  "README.md",
  ".env.example",
  ".env.devnet.example",
  "docs/architecture",
  "docs/design",
  "docs/operations",
  "docs/product/master-brief.md",
  "docs/product/mvp-roadmap.md",
];
const sourceExtensions = new Set([".css", ".json", ".md", ".mjs", ".ts", ".tsx", ".txt", ".toml"]);
const ignoredFiles = new Set(["scripts/audit-copy-guardrails.mjs"]);
const ignoredPathPatterns = [/^docs\/product\/slice-\d+-evaluation\.md$/];
const riskyPatterns = [
  /\bguaranteed?\s+(?:profit|profits|returns?|roi|yield|apy)\b/i,
  /\bguaranteed?\s+future\s+results\b/i,
  /\b(?:projected|expected|target|watered\s+down)\s+roi\b/i,
  /\binvestment\s+returns?\b/i,
  /\bsafe\s+investment\b/i,
  /\bvetted\s+investments?\b/i,
  /\brisk[-\s]?free\b/i,
  /\bpassive\s+income\b/i,
  /\bset[-\s]?and[-\s]?forget\s+(?:returns?|income|profit|profits)\b/i,
  /\b(?:ai\s+)?money\s+printer\b/i,
  /\bdefi\s+casino\b/i,
  /\bprofit\s+engine\b/i,
  /\b(?:bypass(?:es|ing)?|evad(?:e|es|ing)|avoid(?:s|ing)?)\s+(?:regulation|regulations|regulatory|law|laws|financial\s+services)\b/i,
  /\bregulation[-\s]?free\b/i,
  /\bguaranteed\s+compliant\b/i,
  /\bself[-\s]?custody\s+solves\s+compliance\b/i,
];
const negatingContext = /\b(?:no|not|never|avoid|without|does\s+not|do\s+not|isn'?t|not\s+a)\b/i;
const failures = [];

for (const file of await scanFiles()) {
  const relativeFile = relativePath(file);
  if (!sourceExtensions.has(extensionOf(file))) continue;
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relativeFile)) continue;
  if (ignoredFiles.has(relativeFile) || ignoredPathPatterns.some((pattern) => pattern.test(relativeFile))) continue;

  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    riskyPatterns.forEach((pattern) => {
      const match = pattern.exec(line);
      if (!match) return;

      const localContextStart = Math.max(0, match.index - 80);
      const localContextEnd = Math.min(line.length, match.index + match[0].length + 80);
      const context = [
        ...lines.slice(Math.max(0, index - 12), index),
        line.slice(localContextStart, localContextEnd),
      ].join(" ");
      if (negatingContext.test(context)) return;

      failures.push(`${relativePath(file)}:${index + 1} risky phrase "${match[0]}"`);
    });
  });
}

if (failures.length > 0) {
  console.error("Copy guardrail audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Copy guardrail audit passed.");

async function scanFiles() {
  const files = await Promise.all(
    scanTargets.map(async (target) => {
      const fullPath = join(repoRoot, target);
      try {
        const entries = await readdir(fullPath, { withFileTypes: true });
        const childFiles = await Promise.all(
          entries.map((entry) => {
            const childPath = join(fullPath, entry.name);
            return entry.isDirectory() ? walk(childPath) : childPath;
          }),
        );
        return childFiles.flat();
      } catch (error) {
        if (error?.code === "ENOTDIR") return [fullPath];
        throw error;
      }
    }),
  );

  return files.flat();
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = join(directory, entry.name);
      return entry.isDirectory() ? walk(fullPath) : fullPath;
    }),
  );
  return files.flat();
}

function extensionOf(file) {
  const dot = file.lastIndexOf(".");
  return dot === -1 ? "" : file.slice(dot);
}

function relativePath(file) {
  return relative(repoRoot, file).replaceAll("\\", "/");
}
