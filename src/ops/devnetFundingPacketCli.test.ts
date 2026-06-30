import { Keypair } from "@solana/web3.js";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "prepare-devnet-funding-packet.mjs");
const fundingPacketCli = await import(pathToFileURL(scriptPath).href);

const buildDevnetFundingPacket = fundingPacketCli.buildDevnetFundingPacket as (input: {
  balance: { lamports: number | null; sol: number; error?: string } | null;
  config: FundingConfig;
  envSource: string;
  generatedAt?: string;
}) => FundingPacket;

type FundingConfig = {
  authorityAddress: string;
  cluster: string;
  programId: string;
  rpcUrl: string;
  rypMintAddress: string;
};

type FundingPacket = {
  status: "FUNDING_REQUIRED" | "FUNDED_FOR_MINT" | "FUNDED_FOR_DEPLOY";
  authority: {
    minimumTopUpSol: number;
    recommendedTopUpSol: number;
  };
  afterFundingCommands: string[];
  blockers: string[];
  devnetOnlyWarning: string;
  fundingOptions: Array<{ address: string | null; url?: string }>;
  rateLimitFallbacks: Array<{ address?: string | null; command?: string; commands?: string[]; id: string }>;
  warnings: string[];
};

describe("devnet funding packet CLI", () => {
  it("builds a precise public handoff packet when authority funding is missing", () => {
    const config = validConfig();
    const packet = buildDevnetFundingPacket({
      balance: { lamports: 0, sol: 0 },
      config,
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });

    expect(packet.status).toBe("FUNDING_REQUIRED");
    expect(packet.authority.minimumTopUpSol).toBe(0.1);
    expect(packet.authority.recommendedTopUpSol).toBe(3);
    expect(packet.blockers.join(" ")).toContain("fund at least 0.1 devnet SOL");
    expect(packet.devnetOnlyWarning).toContain("Do not send mainnet SOL");
    expect(packet.fundingOptions[0]).toMatchObject({
      address: config.authorityAddress,
      url: "https://faucet.solana.com",
    });
    expect(packet.rateLimitFallbacks.map((fallback) => fallback.id)).toEqual([
      "staged-cli-airdrop",
      "fallback-existing-devnet-wallet",
      "devnet-proof-of-work",
    ]);
    expect(packet.rateLimitFallbacks.find((fallback) => fallback.id === "staged-cli-airdrop")?.command).toBe(
      "npm run devnet:fund:authority -- --env .env.devnet.example --amounts 0.1,0.5,1,3",
    );
    expect(packet.rateLimitFallbacks.find((fallback) => fallback.id === "fallback-existing-devnet-wallet")?.address).toBe(
      config.authorityAddress,
    );
    expect(packet.rateLimitFallbacks.find((fallback) => fallback.id === "devnet-proof-of-work")?.commands).toContain(
      "devnet-pow get-all-faucets -u dev",
    );
    expect(packet.afterFundingCommands).toContain("npm run devnet:mint:test -- --env .env.devnet.example");
    expect(packet.afterFundingCommands).toContain(
      "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
    );
    expect(packet.afterFundingCommands).toContain("npm run devnet:init:protocol -- --env .env.devnet.example");
    expect(packet.afterFundingCommands).toContain(
      "npm run devnet:init:protocol -- --env .env.devnet.example --execute",
    );
    expect(packet.afterFundingCommands).toContain(
      "npm run testnet:readiness -- --profile read-only --env .env.devnet.example",
    );
    expect(packet.afterFundingCommands).toContain(
      "npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.example",
    );
    expect(packet.afterFundingCommands).not.toContain("npm run devnet:bootstrap -- --env .env.devnet.example --mint");
    expect(packet.afterFundingCommands).not.toContain(
      "npm run devnet:bootstrap -- --env .env.devnet.example --execute-init",
    );
  });

  it("uses the selected env source in every post-funding command", () => {
    const packet = buildDevnetFundingPacket({
      balance: { lamports: 0, sol: 0 },
      config: validConfig(),
      envSource: ".env.devnet.staging",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });

    expect(packet.afterFundingCommands).toEqual([
      "npm run devnet:fund:authority -- --env .env.devnet.staging --check-only",
      "npm run devnet:status -- --env .env.devnet.staging",
      "npm run devnet:next -- --env .env.devnet.staging",
      "npm run devnet:mint:test -- --env .env.devnet.staging",
      "npm run devnet:bootstrap -- --env .env.devnet.staging --deploy --init-plan",
      "npm run devnet:init:protocol -- --env .env.devnet.staging",
      "npm run devnet:init:protocol -- --env .env.devnet.staging --execute",
      "npm run testnet:readiness -- --profile read-only --env .env.devnet.staging",
      "npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.staging",
    ]);
    expect(packet.rateLimitFallbacks.find((fallback) => fallback.id === "staged-cli-airdrop")?.command).toBe(
      "npm run devnet:fund:authority -- --env .env.devnet.staging --amounts 0.1,0.5,1,3",
    );
  });

  it("separates mint-ready funding from deploy-ready funding", () => {
    const mintReady = buildDevnetFundingPacket({
      balance: { lamports: 200_000_000, sol: 0.2 },
      config: validConfig(),
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });
    const deployReady = buildDevnetFundingPacket({
      balance: { lamports: 3_000_000_000, sol: 3 },
      config: validConfig(),
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });

    expect(mintReady.status).toBe("FUNDED_FOR_MINT");
    expect(mintReady.warnings.join(" ")).toContain("recommended before program deployment");
    expect(deployReady.status).toBe("FUNDED_FOR_DEPLOY");
    expect(deployReady.blockers).toEqual([]);
  });

  it("blocks invalid devnet funding config before presenting it as actionable", () => {
    const packet = buildDevnetFundingPacket({
      balance: { lamports: 3_000_000_000, sol: 3 },
      config: {
        ...validConfig(),
        authorityAddress: "not-a-wallet",
        cluster: "mainnet-beta",
      },
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });

    expect(packet.status).toBe("FUNDING_REQUIRED");
    expect(packet.blockers).toContain("VITE_SOLANA_CLUSTER must be devnet.");
    expect(packet.blockers).toContain("VITE_ADMIN_AUTHORITY_ADDRESS must be a valid Solana public key.");
  });
});

function validConfig(): FundingConfig {
  return {
    authorityAddress: Keypair.generate().publicKey.toBase58(),
    cluster: "devnet",
    programId: Keypair.generate().publicKey.toBase58(),
    rpcUrl: "https://api.devnet.solana.com",
    rypMintAddress: Keypair.generate().publicKey.toBase58(),
  };
}
