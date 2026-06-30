import { describe, expect, it } from "vitest";
import { PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import {
  adminActionPreviews,
  buildAdminAccess,
  buildAdminLaunchReadiness,
  buildAdminMissionControl,
  buildAdminProtocolPreviews,
} from "./admin";

const adminAddress = "Admin111111111111111111111111111111111111111";
const validAdminAddress = "11111111111111111111111111111111";

describe("admin access", () => {
  it("keeps dashboard locked until an admin address is configured", () => {
    const access = buildAdminAccess({
      config: {
        cluster: "localnet",
        protocolDeployment: "placeholder",
        solanaBroadcastEnabled: false,
      },
      walletAddress: adminAddress,
      demoMode: true,
    });

    expect(access.status).toBe("UNCONFIGURED");
    expect(access.canOpenDashboard).toBe(false);
    expect(access.blockers).toContain("VITE_ADMIN_AUTHORITY_ADDRESS is not configured.");
  });

  it("unlocks draft-only admin mode for the configured wallet off mainnet", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: adminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: adminAddress,
      demoMode: false,
    });

    expect(access.status).toBe("TEST_UNLOCKED");
    expect(access.walletMatches).toBe(true);
    expect(access.canDraftActions).toBe(true);
    expect(access.canExecuteActions).toBe(false);
  });

  it("blocks wrong wallets and mainnet admin use", () => {
    const wrongWallet = buildAdminAccess({
      config: {
        adminAuthorityAddress: adminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: "Wrong11111111111111111111111111111111111111",
      demoMode: false,
    });
    const mainnet = buildAdminAccess({
      config: {
        adminAuthorityAddress: adminAddress,
        cluster: "mainnet-beta",
        protocolDeployment: "mainnet-beta",
        solanaBroadcastEnabled: false,
      },
      walletAddress: adminAddress,
      demoMode: false,
    });

    expect(wrongWallet.status).toBe("WRONG_WALLET");
    expect(wrongWallet.canOpenDashboard).toBe(false);
    expect(mainnet.status).toBe("MAINNET_BLOCKED");
    expect(mainnet.canOpenDashboard).toBe(false);
  });

  it("does not unlock admin actions while demo mode is active", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: adminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: adminAddress,
      demoMode: true,
    });

    expect(access.status).toBe("DEMO_BLOCKED");
    expect(access.canOpenDashboard).toBe(false);
    expect(access.blockers).toContain("Demo mode must be disabled before the admin dashboard can unlock.");
  });

  it("keeps all MVP admin actions non-executable from the UI", () => {
    expect(adminActionPreviews.some((action) => action.executionRule.includes("No production"))).toBe(true);
    expect(adminActionPreviews.every((action) => !action.executionRule.includes("Execute live"))).toBe(true);
  });

  it("builds preview-only protocol transactions for a valid admin authority", () => {
    const previews = buildAdminProtocolPreviews({
      authorityAddress: validAdminAddress,
      rypMintAddress: "So11111111111111111111111111111111111111112",
      rypDecimals: 6,
    });
    const readyActions = previews.flatMap((preview) => preview.plan?.action ?? []);

    expect(readyActions).toEqual([
      "INITIALIZE_CONFIG",
      "INITIALIZE_REWARD_CONFIG",
      "REGISTER_REWARD_VAULT",
      "VERIFY_REWARD_VAULT",
      "UPDATE_FEE_CONFIG",
      "SET_MODULE_PAUSE",
      "SET_MODULE_PAUSE",
      "SET_MODULE_PAUSE",
      "SET_MODULE_PAUSE",
      "SET_MODULE_PAUSE",
      "SET_MODULE_PAUSE",
    ]);
    expect(previews.find((preview) => preview.id === "ryp-transfer-fee-route")?.status).toBe("BLOCKED");

    const initializeConfig = previews.find((preview) => preview.plan?.action === "INITIALIZE_CONFIG")?.plan;
    const initializeRewardConfig = previews.find((preview) => preview.plan?.action === "INITIALIZE_REWARD_CONFIG")?.plan;
    const registerVault = previews.find((preview) => preview.plan?.action === "REGISTER_REWARD_VAULT")?.plan;
    const verifyVault = previews.find((preview) => preview.plan?.action === "VERIFY_REWARD_VAULT")?.plan;
    const updateFeeConfig = previews.find((preview) => preview.plan?.action === "UPDATE_FEE_CONFIG")?.plan;
    const pauseStaking = previews.find((preview) => preview.id === "pause-staking-module")?.plan;
    const clearModulePauses = previews.find((preview) => preview.id === "clear-module-pauses")?.plan;

    expect(initializeConfig?.instructions[0].dataHex).toContain("00f2052a01000000");
    expect(initializeRewardConfig?.instructions[0].dataHex).toBe("542d0dc2ebb539ab803a090000000000060d050d050d");
    expect(registerVault?.instructions[0].dataHex).toMatch(/^cb37299cfc7fb9ef02/);
    expect(registerVault?.instructions[0].dataHex).toContain("01");
    expect(verifyVault?.instructions[0].dataHex).toMatch(/^66d3afeefc0e7bf502/);
    expect(updateFeeConfig?.instructions[0].dataHex).toBe("68b867f258976b145e0100002300460069008c00");
    expect(pauseStaking?.instructions[0].dataHex).toBe("adabe26eeb6c7094010001");
    expect(clearModulePauses?.instructions[0].dataHex).toBe("adabe26eeb6c70941f0000");
    expect(clearModulePauses?.warnings.join(" ")).toContain("does not move funds");
  });

  it("blocks protocol transaction previews without a configured authority", () => {
    const previews = buildAdminProtocolPreviews({
      rypMintAddress: "So11111111111111111111111111111111111111112",
      rypDecimals: 6,
    });

    expect(previews.filter((preview) => preview.status === "READY")).toHaveLength(0);
    expect(previews.every((preview) => preview.blockers.length > 0)).toBe(true);
  });

  it("summarizes public testnet blockers for placeholder or demo state", () => {
    const access = buildAdminAccess({
      config: {
        cluster: "localnet",
        protocolDeployment: "placeholder",
        solanaBroadcastEnabled: false,
      },
      walletAddress: undefined,
      demoMode: true,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: undefined,
        cluster: "localnet",
        demoMode: true,
        protocolDeployment: "placeholder",
        protocolProgramId: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
        rypMintAddress: "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
    });

    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockedCount).toBeGreaterThan(0);
    expect(readiness.blockers).toContain("Public testnet readiness requires VITE_SOLANA_CLUSTER=devnet.");
    expect(readiness.blockers).toContain("Protocol program id is still the placeholder.");
    expect(readiness.blockers).toContain("Reward config must decode from devnet before public reward inspection review.");
    expect(readiness.gates.find((gate) => gate.id === "broadcast-boundary")?.status).toBe("REVIEW_REQUIRED");
  });

  it("marks clean devnet state as ready for review while broadcast remains disabled", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: validAdminAddress,
      demoMode: false,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        demoMode: false,
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "DECODED",
        blockers: [],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "DECODED",
        epochStatus: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
    });

    expect(readiness.status).toBe("READY_FOR_REVIEW");
    expect(readiness.blockedCount).toBe(0);
    expect(readiness.reviewCount).toBe(1);
    expect(readiness.warnings).toContain(
      "Broadcast remains disabled until devnet account inspection and wallet simulation review pass.",
    );
  });

  it("blocks launch readiness when module pauses or reward blockers are active", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: validAdminAddress,
      demoMode: false,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        demoMode: false,
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "DECODED",
        blockers: [],
        warnings: [],
        activeModulePauses: ["staking", "projects"],
      },
      reward: {
        rewardConfigStatus: "DECODED",
        epochStatus: "DECODE_ERROR",
        blockers: ["Reward epoch account must decode before admin reward inspection is considered ready."],
        warnings: [],
      },
    });

    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockers).toContain("staking module pause is active.");
    expect(readiness.blockers).toContain("projects module pause is active.");
    expect(readiness.blockers).toContain(
      "Reward epoch account must decode before admin reward inspection is considered ready.",
    );
  });

  it("surfaces the current mission as waiting on devnet funding and protocol inspection", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: validAdminAddress,
      demoMode: false,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        demoMode: false,
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: ["ProtocolConfig account is missing."],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: ["RewardConfig account is missing."],
        warnings: [],
      },
    });
    const mission = buildAdminMissionControl({
      access,
      config: {
        cluster: "devnet",
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      deployment: {
        authority: {
          address: validAdminAddress,
          status: "PRESENT",
          lamports: 0,
          sol: 0,
          fundedForMint: false,
          fundedForDeploy: false,
          message: "Devnet authority balance is 0 SOL.",
        },
        blockers: ["Devnet authority needs at least 0.1 SOL to create the test mint."],
        mint: {
          address: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
          status: "MISSING",
          message: "Devnet RYP test mint account was not found.",
        },
        nextActions: ["npm run devnet:funding:packet -- --env .env.devnet.example"],
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
        program: {
          address: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
          status: "MISSING",
          message: "Devnet program account was not found.",
        },
      },
      launchReadiness: readiness,
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: ["ProtocolConfig account is missing."],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: ["RewardConfig account is missing."],
        warnings: [],
      },
    });

    expect(mission.status).toBe("MISSION_BLOCKED");
    expect(mission.blockedCount).toBe(1);
    expect(mission.waitingOnDevnetCount).toBeGreaterThan(0);
    expect(mission.phases.find((phase) => phase.id === "devnet-funding")?.status).toBe("BLOCKED");
    expect(mission.phases.find((phase) => phase.id === "devnet-mint")?.status).toBe("WAITING_ON_DEVNET");
    expect(mission.phases.find((phase) => phase.id === "devnet-program")?.status).toBe("WAITING_ON_DEVNET");
    expect(mission.phases.find((phase) => phase.id === "devnet-protocol")?.status).toBe("WAITING_ON_DEVNET");
    expect(mission.phases.find((phase) => phase.id === "devnet-funding")?.command).toBe(
      "npm run devnet:funding:packet -- --env .env.devnet.example",
    );
    expect(mission.operatorHandoff).toMatchObject({
      activeStep: "fund_devnet_authority",
      requiresExternalAction: true,
      requiresExplicitApproval: false,
      risk: "READ_ONLY",
    });
    expect(mission.nextActions[0]).toBe("npm run devnet:funding:packet -- --env .env.devnet.example");
    expect(mission.nextActions).toContain("npm run mission:status -- --env .env.devnet.example");
  });

  it("advances mission next action from funding to test mint creation once authority is funded", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: validAdminAddress,
      demoMode: false,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        demoMode: false,
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: ["ProtocolConfig account is missing."],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: ["RewardConfig account is missing."],
        warnings: [],
      },
    });
    const mission = buildAdminMissionControl({
      access,
      config: {
        cluster: "devnet",
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      deployment: {
        authority: {
          address: validAdminAddress,
          status: "PRESENT",
          lamports: 100_000_000,
          sol: 0.1,
          fundedForMint: true,
          fundedForDeploy: false,
          message: "Devnet authority balance is 0.1 SOL.",
        },
        blockers: ["Devnet RYP test mint account does not exist."],
        mint: {
          address: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
          status: "MISSING",
          message: "Devnet RYP test mint account was not found.",
        },
        nextActions: ["npm run devnet:mint:test -- --env .env.devnet.example"],
        program: {
          address: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
          status: "MISSING",
          message: "Devnet program account was not found.",
        },
      },
      launchReadiness: readiness,
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: ["ProtocolConfig account is missing."],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: ["RewardConfig account is missing."],
        warnings: [],
      },
    });

    expect(mission.phases.find((phase) => phase.id === "devnet-funding")?.status).toBe("LOCAL_READY");
    expect(mission.phases.find((phase) => phase.id === "devnet-mint")?.status).toBe("REVIEW_REQUIRED");
    expect(mission.phases.find((phase) => phase.id === "devnet-program")?.status).toBe("WAITING_ON_DEVNET");
    expect(mission.nextActions[0]).toBe("npm run devnet:mint:test -- --env .env.devnet.example");
  });

  it("advances mission next action to protocol initialization after program deployment", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: validAdminAddress,
      demoMode: false,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        demoMode: false,
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: ["ProtocolConfig account is missing."],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: ["RewardConfig account is missing."],
        warnings: [],
      },
    });
    const mission = buildAdminMissionControl({
      access,
      config: {
        cluster: "devnet",
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      deployment: {
        authority: {
          address: validAdminAddress,
          status: "PRESENT",
          lamports: 3_000_000_000,
          sol: 3,
          fundedForMint: true,
          fundedForDeploy: true,
          message: "Devnet authority balance is 3 SOL.",
        },
        blockers: ["ProtocolConfig account is missing."],
        mint: {
          address: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
          status: "PRESENT",
          isMint: true,
          decimals: 6,
          mintAuthority: null,
          freezeAuthority: null,
          supply: "0",
          message: "Devnet RYP test mint decoded.",
        },
        nextActions: ["npm run devnet:init:protocol -- --env .env.devnet.example"],
        program: {
          address: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
          status: "PRESENT",
          executable: true,
          owner: "BPFLoaderUpgradeab1e11111111111111111111111",
          lamports: 1,
          dataLength: 36,
          message: "Devnet program account was found.",
        },
      },
      launchReadiness: readiness,
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: ["ProtocolConfig account is missing."],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: ["RewardConfig account is missing."],
        warnings: [],
      },
    });

    expect(mission.phases.find((phase) => phase.id === "devnet-funding")?.status).toBe("LOCAL_READY");
    expect(mission.phases.find((phase) => phase.id === "devnet-mint")?.status).toBe("READY_FOR_REVIEW");
    expect(mission.phases.find((phase) => phase.id === "devnet-program")?.status).toBe("READY_FOR_REVIEW");
    expect(mission.phases.find((phase) => phase.id === "devnet-protocol")?.status).toBe("REVIEW_REQUIRED");
    expect(mission.phases.find((phase) => phase.id === "devnet-protocol")?.summary).toContain("initialize");
    expect(mission.phases.find((phase) => phase.id === "devnet-protocol")?.command).toBe(
      "npm run devnet:init:protocol -- --env .env.devnet.example",
    );
    expect(mission.nextActions[0]).toBe("npm run devnet:init:protocol -- --env .env.devnet.example");
  });

  it("keeps mission status blocked when launch readiness is blocked outside the devnet lane", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: undefined,
        cluster: "localnet",
        protocolDeployment: "placeholder",
        solanaBroadcastEnabled: false,
      },
      walletAddress: undefined,
      demoMode: true,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: undefined,
        cluster: "localnet",
        demoMode: true,
        protocolDeployment: "placeholder",
        protocolProgramId: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
        rypMintAddress: "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
    });
    const mission = buildAdminMissionControl({
      access,
      config: {
        cluster: "localnet",
        protocolDeployment: "placeholder",
        protocolProgramId: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
        rypMintAddress: "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD",
        solanaBroadcastEnabled: false,
      },
      launchReadiness: readiness,
      protocol: {
        status: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
      reward: {
        rewardConfigStatus: "PREVIEW_ONLY",
        epochStatus: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
    });

    expect(readiness.status).toBe("BLOCKED");
    expect(mission.status).toBe("MISSION_BLOCKED");
    expect(mission.nextActions).toContain("npm run mission:status -- --env .env.devnet.example");
  });

  it("marks mission phases ready for review after decoded devnet protocol and reward state", () => {
    const access = buildAdminAccess({
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        protocolDeployment: "devnet",
        solanaBroadcastEnabled: false,
      },
      walletAddress: validAdminAddress,
      demoMode: false,
    });
    const readiness = buildAdminLaunchReadiness({
      access,
      config: {
        adminAuthorityAddress: validAdminAddress,
        cluster: "devnet",
        demoMode: false,
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      protocol: {
        status: "DECODED",
        blockers: [],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "DECODED",
        epochStatus: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
    });
    const mission = buildAdminMissionControl({
      access,
      config: {
        cluster: "devnet",
        protocolDeployment: "devnet",
        protocolProgramId: "5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb",
        rypMintAddress: "B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7",
        solanaBroadcastEnabled: false,
      },
      launchReadiness: readiness,
      protocol: {
        status: "DECODED",
        blockers: [],
        warnings: [],
        activeModulePauses: [],
      },
      reward: {
        rewardConfigStatus: "DECODED",
        epochStatus: "PREVIEW_ONLY",
        blockers: [],
        warnings: [],
      },
    });

    expect(mission.status).toBe("MISSION_READY_FOR_REVIEW");
    expect(mission.blockedCount).toBe(0);
    expect(mission.phases.find((phase) => phase.id === "frontend-state")?.status).toBe("READY_FOR_REVIEW");
    expect(mission.phases.find((phase) => phase.id === "wallet-execution")?.status).toBe("REVIEW_REQUIRED");
    expect(mission.nextActions).not.toContain("npm run mission:status -- --env .env.devnet.example");
  });
});
