import { describe, expect, it } from "vitest";
import { DEMO_WALLET_ADDRESS } from "../domain/demo";
import { tierRequirements } from "../domain/tiering";
import { createProtocolServices } from "./mockServices";

const realWallet = "11111111111111111111111111111111";

describe("protocol snapshot services", () => {
  it("keeps demo wallet tier simulation available for visual previews", async () => {
    const services = createProtocolServices({
      tokenBalances: {
        async getRypBalance() {
          return 84_200;
        },
      },
    });
    const snapshot = await services.loadProtocolSnapshot(DEMO_WALLET_ADDRESS, "TREE");

    expect(snapshot.user.walletConnected).toBe(true);
    expect(snapshot.user.stakingTier).toBe("TREE");
    expect(snapshot.user.stakedAmount).toBe(tierRequirements.TREE);
    expect(snapshot.user.goldenKeyNft).toBe(true);
    expect(snapshot.farm.governanceActive).toBe(true);
    expect(snapshot.rewards.every((reward) => reward.status !== "LOCKED")).toBe(true);
  });

  it("does not fabricate stake, NFTs, rewards, or governance for real wallets", async () => {
    const services = createProtocolServices({
      tokenBalances: {
        async getRypBalance() {
          return 12_345;
        },
      },
    });
    const snapshot = await services.loadProtocolSnapshot(realWallet, "FRUIT");

    expect(snapshot.user.walletConnected).toBe(true);
    expect(snapshot.user.walletAddress).toBe(realWallet);
    expect(snapshot.user.rypBalance).toBe(12_345);
    expect(snapshot.user.stakingTier).toBe("NONE");
    expect(snapshot.user.stakedAmount).toBe(0);
    expect(snapshot.user.goldenKeyNft).toBe(false);
    expect(snapshot.user.votingRightsNft).toBe(false);
    expect(snapshot.farm.harvestAvailable).toBe(false);
    expect(snapshot.farm.governanceActive).toBe(false);
    expect(snapshot.farm.seedBotUnlocked).toBe(true);
    expect(snapshot.rewards.every((reward) => reward.status === "LOCKED")).toBe(true);
  });

  it("keeps SeedBot locked for real wallets with no RYP and no stake", async () => {
    const services = createProtocolServices({
      tokenBalances: {
        async getRypBalance() {
          return 0;
        },
      },
    });
    const snapshot = await services.loadProtocolSnapshot(realWallet, "SPROUT");

    expect(snapshot.user.stakingTier).toBe("NONE");
    expect(snapshot.farm.seedBotUnlocked).toBe(false);
    expect(snapshot.rewards.every((reward) => reward.status === "LOCKED")).toBe(true);
  });
});
