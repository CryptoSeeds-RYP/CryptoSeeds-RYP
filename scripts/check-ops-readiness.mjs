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
  "devnet:bootstrap",
  "devnet:deploy:wsl",
  "devnet:fund:authority",
  "devnet:init:protocol",
  "devnet:prep",
  "devnet:program:check",
  "devnet:readiness",
  "devnet:status",
  "devnet:vaults:prep",
  "testnet:readiness",
  "protocol:idl:check",
  "protocol:admin:fixture:check",
  "protocol:smoke:localnet:wsl",
  "rewards:claim-merkle",
  "rewards:epoch:draft",
  "rewards:holder-claim-packet",
  "ops:check",
];

const requiredDocs = [
  "docs/architecture/admin-dashboard.md",
  "docs/architecture/operations-model.md",
  "docs/architecture/platform-authority-model.md",
  "docs/architecture/reward-vault-epochs.md",
  "docs/compliance/decentralization-and-self-custody.md",
  "docs/product/master-brief.md",
  "docs/setup/devnet-deployment-status.md",
  "docs/setup/public-testnet-readiness.md",
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
