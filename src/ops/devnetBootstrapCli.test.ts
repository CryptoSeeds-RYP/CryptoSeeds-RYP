import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "devnet-bootstrap.mjs");

describe("devnet bootstrap CLI", () => {
  it("runs protocol inspection and read-only readiness after execute-init", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain("inspect_protocol_state");
    expect(script).toContain("read_only_testnet_readiness");
    expect(script).toContain('"--execute-init"');
    expect(script).toContain("parsed.inspectProtocol = true");
    expect(script).toContain("parsed.readOnlyReady = true");
  });

  it("exposes explicit post-deploy inspection and read-only readiness flags", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain('"--inspect-protocol"');
    expect(script).toContain('"--read-only-ready"');
    expect(script).toContain("scripts/inspect-devnet-protocol-state.mjs");
    expect(script).toContain("scripts/check-public-testnet-readiness.mjs");
  });

  it("recommends the staged mint and initialization commands in next actions", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain("npm run devnet:mint:test");
    expect(script).toContain("npm run devnet:init:protocol");
    expect(script).toContain("npm run testnet:readiness");
    expect(script).not.toContain("run with --mint to create the devnet test mint");
    expect(script).not.toContain("Run npm run devnet:bootstrap -- --env .env.devnet.example --execute-init.");
  });
});
