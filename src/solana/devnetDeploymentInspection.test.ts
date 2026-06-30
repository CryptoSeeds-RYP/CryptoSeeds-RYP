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
        opsEnvFile: ".env.devnet.example",
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
    expect(preview.operatorHandoff).toMatchObject({
      activeStep: "fund_devnet_authority",
      command: "npm run devnet:funding:packet -- --env .env.devnet.example",
      requiresExplicitApproval: false,
      requiresExternalAction: true,
      risk: "READ_ONLY",
    });
  });

  it("blocks local placeholder state from looking deployable", () => {
    const preview = buildDevnetDeploymentInspectionPreview({
      config: {
        adminAuthorityAddress: undefined,
        cluster: "localnet",
        opsEnvFile: ".env.devnet.example",
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
    expect(inspection.operatorHandoff).toMatchObject({
      activeStep: "create_devnet_test_mint",
      command: "npm run devnet:mint:test -- --env .env.devnet.example",
      requiresExplicitApproval: true,
      requiresExternalAction: false,
      risk: "DEVNET_MUTATION",
    });
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
    expect(inspection.operatorHandoff).toMatchObject({
      activeStep: "deploy_devnet_program",
      command: "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
      requiresExplicitApproval: true,
      risk: "DEVNET_MUTATION",
    });
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
    expect(inspection.operatorHandoff).toMatchObject({
      activeStep: "initialize_devnet_protocol",
      command: "npm run devnet:init:protocol -- --env .env.devnet.example",
      requiresExplicitApproval: true,
      risk: "DEVNET_MUTATION",
    });
  });

  it("uses the selected ops env file in next actions and handoff commands", () => {
    const inspection = validateDevnetDeploymentInspection({
      ...baseInspection(),
      opsEnvFile: ".env.devnet.staging",
    });

    expect(inspection.nextActions).toContain("npm run devnet:funding:packet -- --env .env.devnet.staging");
    expect(inspection.nextActions).toContain("npm run devnet:next -- --env .env.devnet.staging");
    expect(inspection.operatorHandoff).toMatchObject({
      activeStep: "fund_devnet_authority",
      command: "npm run devnet:funding:packet -- --env .env.devnet.staging",
      resumeCommand: "npm run devnet:next -- --env .env.devnet.staging",
      afterCompletionCommand: "npm run devnet:next -- --env .env.devnet.staging",
    });
  });
});

function baseInspection(): DevnetDeploymentInspection {
  return {
    executionMode: "READ_ONLY",
    cluster: "devnet",
    deployment: "devnet",
    opsEnvFile: ".env.devnet.example",
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
    operatorHandoff: {
      activeStep: "fund_devnet_authority",
      command: "npm run devnet:funding:packet -- --env .env.devnet.example",
      resumeCommand: "npm run devnet:next -- --env .env.devnet.example",
      afterCompletionCommand: "npm run devnet:next -- --env .env.devnet.example",
      requiresExternalAction: true,
      requiresExplicitApproval: false,
      risk: "READ_ONLY",
      operatorRule: "External action required first; use the funding packet, fund devnet SOL externally, then rerun devnet:next.",
    },
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
