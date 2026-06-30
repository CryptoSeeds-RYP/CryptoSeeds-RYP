import { describe, expect, it } from "vitest";
import { buildDevnetOperatorHandoff, recommendDevnetNextAction } from "./recommend-devnet-next-action.mjs";

const envPath = ".env.devnet.example";
const authorityAddress = "Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe";

describe("devnet next-action recommender", () => {
  it("recommends local reward vault keypair prep before chain mutations", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      status: statusReport({
        rewardVaultKeypairs: {
          holder: { address: null },
        },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "prepare_reward_vault_keypairs",
      risk: "LOCAL_IGNORED_FILES_ONLY",
    });
  });

  it("recommends read-only funding packet when authority is unfunded", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      status: statusReport({
        authority: {
          fundedForDeploy: false,
          fundedForMint: false,
          minimumDeploySolRecommended: 3,
          minimumMintSolRequired: 0.1,
        },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "fund_devnet_authority",
      command: "npm run devnet:funding:packet -- --env .env.devnet.example",
      risk: "READ_ONLY",
    });
    expect(recommendation.manualAction).toContain(authorityAddress);
    expect(buildDevnetOperatorHandoff({ envPath, recommendation })).toMatchObject({
      activeStep: "fund_devnet_authority",
      command: "npm run devnet:funding:packet -- --env .env.devnet.example",
      requiresExplicitApproval: false,
      requiresExternalAction: true,
      resumeCommand: "npm run devnet:next -- --env .env.devnet.example",
      risk: "READ_ONLY",
    });
  });

  it("recommends test mint creation after authority funding", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      status: statusReport({
        authority: {
          fundedForDeploy: false,
          fundedForMint: true,
        },
        mint: { exists: false },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "create_devnet_test_mint",
      risk: "DEVNET_MUTATION",
    });
    expect(buildDevnetOperatorHandoff({ envPath, recommendation })).toMatchObject({
      activeStep: "create_devnet_test_mint",
      requiresExplicitApproval: true,
      requiresExternalAction: false,
      risk: "DEVNET_MUTATION",
    });
  });

  it("recommends deploy and init-plan after mint exists and deploy funding is ready", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      status: statusReport({
        authority: {
          fundedForDeploy: true,
          fundedForMint: true,
        },
        mint: { exists: true, isMint: true },
        program: { exists: false },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "deploy_program_and_plan_init",
      command: "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
      risk: "DEVNET_MUTATION",
    });
  });

  it("recommends initialization planning when the deployed program has missing protocol config", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      protocolInspection: {
        blockers: ["ProtocolConfig account is missing."],
        status: "BLOCKED",
      },
      status: statusReport({
        authority: {
          fundedForDeploy: true,
          fundedForMint: true,
        },
        mint: { exists: true, isMint: true },
        program: { exists: true },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "plan_protocol_initialization",
      risk: "READ_ONLY",
    });
  });

  it("recommends read-only testnet readiness after protocol inspection passes", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      protocolInspection: {
        blockers: [],
        status: "READY_FOR_READ_ONLY_PROTOCOL_REVIEW",
      },
      status: statusReport({
        authority: {
          fundedForDeploy: true,
          fundedForMint: true,
        },
        mint: { exists: true, isMint: true },
        program: { exists: true },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "run_read_only_testnet_readiness",
      risk: "READ_ONLY",
    });
    expect(buildDevnetOperatorHandoff({ envPath, recommendation })).toMatchObject({
      activeStep: "run_read_only_testnet_readiness",
      requiresExplicitApproval: false,
      requiresExternalAction: false,
      risk: "READ_ONLY",
    });
  });

  it("recommends deployment receipt when readiness passes", () => {
    const recommendation = recommendDevnetNextAction({
      envPath,
      protocolInspection: {
        blockers: [],
        status: "READY_FOR_READ_ONLY_PROTOCOL_REVIEW",
      },
      readiness: {
        blockers: [],
        status: "READY_FOR_READ_ONLY_TESTNET_PREVIEW",
      },
      status: statusReport({
        authority: {
          fundedForDeploy: true,
          fundedForMint: true,
        },
        mint: { exists: true, isMint: true },
        program: { exists: true },
      }),
    });

    expect(recommendation).toMatchObject({
      id: "prepare_deployment_receipt",
      command: "npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.example",
      risk: "READ_ONLY",
    });
  });
});

function statusReport({
  authority = {},
  mint = {},
  program = {},
  rewardVaultKeypairs = {},
} = {}) {
  return {
    chain: {
      authority: {
        fundedForDeploy: false,
        fundedForMint: false,
        minimumDeploySolRecommended: 3,
        minimumMintSolRequired: 0.1,
        ...authority,
      },
      mint: {
        exists: false,
        ...mint,
      },
      program: {
        exists: false,
        ...program,
      },
    },
    config: {
      adminAuthorityAddress: authorityAddress,
    },
    local: {
      rewardVaultKeypairs: {
        delivery: { address: "delivery-vault" },
        holder: { address: "holder-vault" },
        rollover: { address: "rollover-vault" },
        staker: { address: "staker-vault" },
        ...rewardVaultKeypairs,
      },
    },
    status: "BLOCKED",
  };
}
