import { describe, expect, it } from "vitest";
import {
  PLACEHOLDER_PROTOCOL_PROGRAM_ID,
  readCluster,
  readHyperliquidNetwork,
  readInspectionId,
  readOptionalString,
  readProtocolDeployment,
  readRewardInspectionEpochId,
} from "./env";

const reviewedProgramId = "BPFLoaderUpgradeab1e11111111111111111111111";

describe("environment config readers", () => {
  it("defaults unknown clusters to localnet", () => {
    expect(readCluster(undefined)).toBe("localnet");
    expect(readCluster("devnet")).toBe("devnet");
    expect(readCluster("not-a-cluster")).toBe("localnet");
  });

  it("allows explicit localnet inspection with the development program id", () => {
    expect(readProtocolDeployment("localnet", PLACEHOLDER_PROTOCOL_PROGRAM_ID, "localnet")).toBe("localnet");
  });

  it("keeps placeholder deployment for non-localnet placeholder program ids", () => {
    expect(readProtocolDeployment("devnet", PLACEHOLDER_PROTOCOL_PROGRAM_ID, "devnet")).toBe("placeholder");
    expect(readProtocolDeployment("mainnet-beta", PLACEHOLDER_PROTOCOL_PROGRAM_ID, "mainnet-beta")).toBe("placeholder");
  });

  it("accepts reviewed non-placeholder deployments", () => {
    expect(readProtocolDeployment("devnet", reviewedProgramId, "devnet")).toBe("devnet");
    expect(readProtocolDeployment("mainnet-beta", reviewedProgramId, "mainnet-beta")).toBe("mainnet-beta");
  });

  it("normalizes optional integration values", () => {
    expect(readHyperliquidNetwork("MAINNET")).toBe("MAINNET");
    expect(readHyperliquidNetwork("bogus")).toBe("TESTNET");
    expect(readOptionalString("  wallet-address  ")).toBe("wallet-address");
    expect(readOptionalString("   ")).toBeUndefined();
  });

  it("normalizes reward inspection epoch ids", () => {
    expect(readRewardInspectionEpochId("3")).toBe(3n);
    expect(readRewardInspectionEpochId(" 42 ")).toBe(42n);
    expect(readRewardInspectionEpochId("-1")).toBe(0n);
    expect(readRewardInspectionEpochId("not-a-number")).toBe(0n);
    expect(readRewardInspectionEpochId(undefined)).toBe(0n);
  });

  it("normalizes generic protocol inspection ids", () => {
    expect(readInspectionId("9")).toBe(9n);
    expect(readInspectionId(" 10 ")).toBe(10n);
    expect(readInspectionId("-1")).toBe(0n);
    expect(readInspectionId("1.5")).toBe(0n);
    expect(readInspectionId(undefined)).toBe(0n);
  });
});
