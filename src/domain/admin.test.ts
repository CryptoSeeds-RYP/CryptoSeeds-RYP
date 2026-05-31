import { describe, expect, it } from "vitest";
import { adminActionPreviews, buildAdminAccess } from "./admin";

const adminAddress = "Admin111111111111111111111111111111111111111";

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
});
