import { describe, expect, it } from "vitest";
import {
  buildDevnetDeploymentInspectionPreview,
  type DevnetDeploymentInspection,
  validateDevnetDeploymentInspection,
} from "./devnetDeploymentInspection";

const authorityAddress = "Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe";
const mintAddress = "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7";
const programAddress = "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb";
const loaderAddress = "BPFLoaderUpgradeab1e11111111111111111111111";

describe("devnet deployment inspection", () => {
  it("builds a read-only preview with devnet funding as the first expected blocker", () => {
    const preview = buildDevnetDeploymentInspectionPreview({
      config: {
        adminAuthorityAddress: authorityAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        protocolProgramId: programAddress,
        rypDecimals: 6,
        rypMintAddress: mintAddress,
      },
    });

    expect(preview.executionMode).toBe("READ_ONLY");
    expect(preview.blockers).toContain("Devnet authority needs at least 0.1 SOL to create the test mint.");
    expect(preview.nextActions).toContain(
      "npm run devnet:funding:packet -- --env .env.devnet.example",
    );
  });

  it("blocks local placeholder state from looking deployable", () => {
    const preview = buildDevnetDeploymentInspectionPreview({
      config: {
        adminAuthorityAddress: undefined,
        cluster: "localnet",
        protocolDeployment: "placeholder",
        protocolProgramId: "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL",
        rypDecimals: 6,
        rypMintAddress: "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD",
      },
    });

    expect(preview.blockers).toContain("Devnet deployment inspection requires VITE_SOLANA_CLUSTER=devnet.");
    expect(preview.blockers).toContain(
      "Devnet deployment inspection requires VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT=devnet.",
    );
    expect(preview.blockers).toContain("Devnet admin authority address is not configured.");
  });

  it("moves the next action to mint creation once authority funding exists", () => {
    const inspection = validateDevnetDeploymentInspection({
      ...baseInspection(),
      authority: {
        address: authorityAddress,
        status: "PRESENT",
        lamports: 100_000_000,
        sol: 0.1,
        fundedForMint: true,
        fundedForDeploy: false,
        message: "Devnet authority balance is 0.1 SOL.",
      },
    });

    expect(inspection.blockers).not.toContain("Devnet authority needs at least 0.1 SOL to create the test mint.");
    expect(inspection.warnings).toContain("Devnet authority has mint funding; 3 SOL is recommended before deployment.");
    expect(inspection.nextActions[0]).toBe("npm run devnet:mint:test -- --env .env.devnet.example");
  });

  it("moves the next action to bootstrap once mint exists and program is missing", () => {
    const inspection = validateDevnetDeploymentInspection({
      ...baseInspection(),
      authority: fundedAuthority(),
      mint: decodedMint(),
    });

    expect(inspection.blockers).toContain("Devnet program account does not exist.");
    expect(inspection.nextActions[0]).toBe(
      "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
    );
  });

  it("moves the next action to protocol initialization after program deployment", () => {
    const inspection = validateDevnetDeploymentInspection({
      ...baseInspection(),
      authority: fundedAuthority(),
      mint: decodedMint(),
      program: {
        address: programAddress,
        status: "PRESENT",
        executable: true,
        owner: loaderAddress,
        lamports: 1,
        dataLength: 36,
        message: "Devnet program account was found.",
      },
    });

    expect(inspection.blockers).toEqual([]);
    expect(inspection.nextActions[0]).toBe("npm run devnet:init:protocol -- --env .env.devnet.example");
  });
});

function baseInspection(): DevnetDeploymentInspection {
  return {
    executionMode: "READ_ONLY",
    cluster: "devnet",
    deployment: "devnet",
    minimumMintSolRequired: 0.1,
    minimumDeploySolRecommended: 3,
    authority: {
      address: authorityAddress,
      status: "PRESENT",
      lamports: 0,
      sol: 0,
      fundedForMint: false,
      fundedForDeploy: false,
      message: "Devnet authority balance is 0 SOL.",
    },
    mint: {
      address: mintAddress,
      status: "MISSING",
      message: "Devnet RYP test mint account was not found.",
    },
    program: {
      address: programAddress,
      status: "MISSING",
      message: "Devnet program account was not found.",
    },
    blockers: [],
    warnings: [],
    nextActions: [],
  };
}

function fundedAuthority(): DevnetDeploymentInspection["authority"] {
  return {
    address: authorityAddress,
    status: "PRESENT",
    lamports: 3_000_000_000,
    sol: 3,
    fundedForMint: true,
    fundedForDeploy: true,
    message: "Devnet authority balance is 3 SOL.",
  };
}

function decodedMint(): DevnetDeploymentInspection["mint"] {
  return {
    address: mintAddress,
    status: "PRESENT",
    isMint: true,
    decimals: 6,
    freezeAuthority: null,
    mintAuthority: null,
    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    supply: "0",
    message: "Devnet RYP test mint decoded.",
  };
}
