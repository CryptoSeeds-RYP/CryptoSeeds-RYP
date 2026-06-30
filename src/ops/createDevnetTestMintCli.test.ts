import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "create-devnet-test-mint.mjs");

describe("create devnet test mint CLI", () => {
  it("does not request faucet funding from the mint mutation path", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).not.toContain("requestAirdrop");
    expect(script).toContain("devnet:funding:packet");
    expect(script).toContain("before mint creation");
  });
});
