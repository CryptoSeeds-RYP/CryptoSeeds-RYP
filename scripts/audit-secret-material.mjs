#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ignoredFiles = new Set(["scripts/audit-secret-material.mjs"]);
const allowedEnvFiles = new Set([".env.example", ".env.devnet.example"]);
const binaryExtensions = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
]);
const serviceTokenPatterns = [
  {
    id: "pem-private-key",
    pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
  {
    id: "openssh-private-key",
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
  },
  {
    id: "discord-bot-token",
    pattern: /\b(?:mfa\.[A-Za-z0-9_-]{80,}|[MN][A-Za-z0-9_-]{23}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,})\b/g,
  },
  {
    id: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
  },
  {
    id: "openai-api-key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    id: "aws-access-key",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  },
];
const secretAssignmentPattern =
  /\b([A-Z0-9_]*(?:PRIVATE_KEY|SECRET|MNEMONIC|SEED_PHRASE|API_KEY|ACCESS_TOKEN|BOT_TOKEN)[A-Z0-9_]*)[ \t]*[:=][ \t]*["']?([^"'\s#\r\n]*)["']?/g;

if (isMain(import.meta.url)) {
  const files = await readTrackedFiles();
  const report = auditTrackedSecretMaterial({ files });

  console.log(JSON.stringify(report, null, 2));
  if (report.blockers.length > 0) {
    process.exit(1);
  }
}

export function auditTrackedSecretMaterial({ files }) {
  const blockers = [];
  const warnings = [];
  let scannedFiles = 0;
  let skippedBinaryFiles = 0;

  for (const file of files) {
    const filePath = normalizePath(file.path);
    if (ignoredFiles.has(filePath)) continue;

    blockers.push(...pathBlockers(filePath));
    if (isBinaryPath(filePath) || hasNullByte(file.content)) {
      skippedBinaryFiles += 1;
      continue;
    }

    const text = normalizeText(file.content);
    scannedFiles += 1;

    if (isSolanaKeypairJson(text)) {
      blockers.push(`${filePath}: tracked Solana keypair JSON array detected.`);
    }

    for (const pattern of serviceTokenPatterns) {
      for (const match of text.matchAll(pattern.pattern)) {
        blockers.push(`${filePath}: secret-shaped value detected (${pattern.id}).`);
        if (match.index !== undefined) break;
      }
    }

    for (const match of text.matchAll(secretAssignmentPattern)) {
      const [, name, value] = match;
      if (isPlaceholderSecretValue(value)) continue;
      blockers.push(`${filePath}: non-placeholder secret assignment detected (${name}).`);
    }
  }

  return {
    exportVersion: "secret-material-audit/v1",
    status: blockers.length === 0 ? "PASSED" : "BLOCKED",
    scannedFiles,
    skippedBinaryFiles,
    blockers: [...new Set(blockers)],
    warnings,
  };
}

async function readTrackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    encoding: "buffer",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr.toString("utf8")}`);
  }

  const paths = result.stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean);

  return Promise.all(paths.map(async (path) => ({
    content: await readFile(path),
    path,
  })));
}

function pathBlockers(filePath) {
  const blockers = [];

  if (/^(?:target|programs\/[^/]+\/target)\//.test(filePath)) {
    blockers.push(`${filePath}: build/devnet target file is tracked.`);
  }
  if (/(^|\/)\.env(?:$|\.)/.test(filePath) && !allowedEnvFiles.has(filePath)) {
    blockers.push(`${filePath}: tracked env file is not allowlisted.`);
  }
  if (/(^|\/)[^/]*(?:keypair|private-key|secret-key)[^/]*\.(?:json|pem|txt)$/i.test(filePath)) {
    blockers.push(`${filePath}: tracked secret/keypair-shaped file path.`);
  }

  return blockers;
}

function isSolanaKeypairJson(text) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return false;

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) &&
      parsed.length === 64 &&
      parsed.every((value) => Number.isInteger(value) && value >= 0 && value <= 255);
  } catch {
    return false;
  }
}

function isPlaceholderSecretValue(value) {
  const normalized = String(value ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  return !normalized ||
    normalized === "false" ||
    normalized === "true" ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === "example" ||
    normalized === "placeholder" ||
    normalized === "changeme" ||
    normalized === "change_me" ||
    normalized === "replace_me" ||
    normalized === "dummy" ||
    normalized === "test" ||
    normalized.startsWith("your_") ||
    normalized.startsWith("<") ||
    normalized.includes("placeholder") ||
    normalized.includes("example");
}

function normalizeText(content) {
  return Buffer.isBuffer(content) ? content.toString("utf8") : String(content ?? "");
}

function hasNullByte(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content ?? ""));
  return buffer.includes(0);
}

function isBinaryPath(filePath) {
  const dot = filePath.lastIndexOf(".");
  return dot >= 0 && binaryExtensions.has(filePath.slice(dot).toLowerCase());
}

function normalizePath(filePath) {
  return String(filePath).replaceAll("\\", "/");
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
