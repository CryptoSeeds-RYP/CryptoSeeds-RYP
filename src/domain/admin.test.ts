import { describe, expect, it } from "vitest";
import { adminActionPreviews, buildAdminAccess, buildAdminProtocolPreviews } from "./admin";

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
    ]);
    expect(previews.find((preview) => preview.id === "ryp-transfer-fee-route")?.status).toBe("BLOCKED");

    const initializeConfig = previews.find((preview) => preview.plan?.action === "INITIALIZE_CONFIG")?.plan;
    const initializeRewardConfig = previews.find((preview) => preview.plan?.action === "INITIALIZE_REWARD_CONFIG")?.plan;
    const registerVault = previews.find((preview) => preview.plan?.action === "REGISTER_REWARD_VAULT")?.plan;
    const verifyVault = previews.find((preview) => preview.plan?.action === "VERIFY_REWARD_VAULT")?.plan;
    const updateFeeConfig = previews.find((preview) => preview.plan?.action === "UPDATE_FEE_CONFIG")?.plan;

    expect(initializeConfig?.instructions[0].dataHex).toContain("00f2052a01000000");
    expect(initializeRewardConfig?.instructions[0].dataHex).toBe("542d0dc2ebb539ab803a090000000000060d050d050d");
    expect(registerVault?.instructions[0].dataHex).toMatch(/^cb37299cfc7fb9ef02/);
    expect(registerVault?.instructions[0].dataHex).toContain("01");
    expect(verifyVault?.instructions[0].dataHex).toMatch(/^66d3afeefc0e7bf502/);
    expect(updateFeeConfig?.instructions[0].dataHex).toBe("68b867f258976b145e0100002300460069008c00");
  });

  it("blocks protocol transaction previews without a configured authority", () => {
    const previews = buildAdminProtocolPreviews({
      rypMintAddress: "So11111111111111111111111111111111111111112",
      rypDecimals: 6,
    });

    expect(previews.filter((preview) => preview.status === "READY")).toHaveLength(0);
    expect(previews.every((preview) => preview.blockers.length > 0)).toBe(true);
  });
});
