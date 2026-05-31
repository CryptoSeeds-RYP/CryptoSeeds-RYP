import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));

const requiredScripts = [
  "test",
  "build",
  "copy:audit",
  "visual:audit",
  "token:check",
  "devnet:readiness",
  "protocol:idl:check",
  "protocol:smoke:localnet:wsl",
  "rewards:epoch:draft",
  "ops:check",
];

const requiredDocs = [
  "docs/architecture/admin-dashboard.md",
  "docs/architecture/operations-model.md",
  "docs/architecture/platform-authority-model.md",
  "docs/architecture/reward-vault-epochs.md",
  "docs/compliance/decentralization-and-self-custody.md",
  "docs/product/master-brief.md",
];

const blockers = [];

for (const scriptName of requiredScripts) {
  if (!packageJson.scripts?.[scriptName]) {
    blockers.push(`Missing package script: ${scriptName}`);
  }
}

for (const docPath of requiredDocs) {
  try {
    await access(join(repoRoot, docPath));
  } catch {
    blockers.push(`Missing operations document: ${docPath}`);
  }
}

const report = {
  status: blockers.length === 0 ? "READY" : "BLOCKED",
  requiredScripts,
  requiredDocs,
  blockers,
};

console.log(JSON.stringify(report, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
