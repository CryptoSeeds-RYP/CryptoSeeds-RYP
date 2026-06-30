import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "audit-secret-material.mjs");
const secretAuditCli = await import(pathToFileURL(scriptPath).href);

const auditTrackedSecretMaterial = secretAuditCli.auditTrackedSecretMaterial as (input: {
  files: Array<{ content: Buffer | string; path: string }>;
}) => {
  status: string;
  blockers: string[];
};

describe("secret material audit CLI", () => {
  it("passes clean tracked source files", () => {
    const report = auditTrackedSecretMaterial({
      files: [
        { path: "src/domain/token.ts", content: "export const RYP_MINT = 'CFPz...';" },
        { path: ".env.devnet.example", content: "VITE_SOLANA_CLUSTER=devnet\n" },
      ],
    });

    expect(report.status).toBe("PASSED");
    expect(report.blockers).toEqual([]);
  });

  it("blocks committed Solana keypair JSON arrays and keypair-shaped paths", () => {
    const report = auditTrackedSecretMaterial({
      files: [
        {
          path: "target/devnet/devnet-authority.json",
          content: JSON.stringify(Array.from({ length: 64 }, (_, index) => index)),
        },
      ],
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers.join(" ")).toContain("tracked Solana keypair JSON array");
    expect(report.blockers.join(" ")).toContain("build/devnet target file is tracked");
  });

  it("blocks private-key blocks and real-looking secret assignments", () => {
    const privateKeyHeader = ["-----BEGIN", " PRIVATE KEY-----"].join("");
    const secretAssignment = ["API_SECRET", "supersecretvalue123"].join("=");
    const report = auditTrackedSecretMaterial({
      files: [
        {
          path: "src/config/leak.ts",
          content: `${privateKeyHeader}\n${secretAssignment}\n`,
        },
      ],
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers.join(" ")).toContain("pem-private-key");
    expect(report.blockers.join(" ")).toContain("API_SECRET");
  });

  it("allows placeholder secret assignments in example files", () => {
    const report = auditTrackedSecretMaterial({
      files: [
        {
          path: ".env.example",
          content: `${["API_SECRET", "your_api_secret_here"].join("=")}\nVITE_HELIUS_API_KEY=\nVITE_DEMO_MODE=true\n`,
        },
      ],
    });

    expect(report.status).toBe("PASSED");
  });
});
