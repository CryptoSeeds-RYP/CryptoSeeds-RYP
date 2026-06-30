import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("devnet operator next actions", () => {
  it("keeps funding helper next actions env-aware and on the staged route", async () => {
    const script = await readScript("scripts/fund-devnet-authority.mjs");

    expect(script).toContain("nextActions(status, envSource)");
    expect(script).toContain("npm run devnet:bootstrap -- --env ${commandEnv} --deploy --init-plan");
    expect(script).not.toContain("Run npm run devnet:deploy:wsl after mint creation and final status review.");
    expect(script).not.toContain("Re-run npm run devnet:fund:authority -- --env .env.devnet.example.");
  });

  it("keeps status and program inspection reports env-aware", async () => {
    const statusScript = await readScript("scripts/check-devnet-status.mjs");
    const programScript = await readScript("scripts/check-devnet-program.mjs");

    expect(statusScript).toContain("envSource = path.relative(repoRoot, envPath)");
    expect(statusScript).toContain("target/devnet/independent-treasury.json");
    expect(statusScript).toContain("--treasury");
    expect(statusScript).toContain("VITE_INDEPENDENT_TREASURY_ADDRESS must be set for devnet work.");
    expect(statusScript).toContain("Independent treasury address must be distinct from the admin authority wallet.");
    expect(statusScript).toContain("npm run devnet:vaults:prep -- --env ${envSource}");
    expect(statusScript).toContain("npm run devnet:next -- --env ${envSource}");
    expect(statusScript).toContain("npm run devnet:bootstrap -- --env ${envSource} --deploy --init-plan");
    expect(statusScript).toContain("recommendDevnetNextAction({ envPath: envSource, status: baseReport })");
    expect(statusScript).toContain("operatorHandoff: buildDevnetOperatorHandoff({ envPath: envSource, recommendation })");
    expect(statusScript).not.toContain("Run npm run devnet:prep -- --env ${envSource}.");
    expect(statusScript).not.toContain("Run npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example.");

    expect(programScript).toContain("envSource = path.relative(repoRoot, envPath)");
    expect(programScript).toContain("npm run devnet:bootstrap -- --env ${envSource} --deploy --init-plan");
    expect(programScript).toContain("npm run devnet:init:protocol -- --env ${envSource}");
    expect(programScript).not.toContain("Run npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example.");
  });

  it("keeps devnet deployment docs on the staged wrapper route", async () => {
    const doc = await readScript("docs/setup/devnet-deployment-status.md");

    expect(doc).toContain("npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan");
    expect(doc).toContain("npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.example");
    expect(doc).not.toContain("Equivalent direct deploy command");
    expect(doc).not.toContain("npm run devnet:deployment:receipt -- --env .env.devnet.example");
  });
});

async function readScript(relativePath: string) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}
