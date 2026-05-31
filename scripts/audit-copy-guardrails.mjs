import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const sourceRoot = join(repoRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const riskyPatterns = [
  /\bguaranteed?\s+(?:profit|profits|returns?|roi|yield|apy)\b/i,
  /\bguaranteed?\s+future\s+results\b/i,
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

for (const file of await walk(sourceRoot)) {
  if (!sourceExtensions.has(extensionOf(file))) continue;

  const text = await readFile(file, "utf8");
  text.split(/\r?\n/).forEach((line, index) => {
    riskyPatterns.forEach((pattern) => {
      const match = pattern.exec(line);
      if (!match) return;

      const contextStart = Math.max(0, match.index - 36);
      const contextEnd = Math.min(line.length, match.index + match[0].length + 36);
      const context = line.slice(contextStart, contextEnd);
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
  return file.replace(`${repoRoot}\\`, "").replaceAll("\\", "/");
}
