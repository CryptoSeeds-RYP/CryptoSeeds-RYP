import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProtocolPanel } from "./ProtocolPanel";

const noop = () => undefined;

describe("ProtocolPanel", () => {
  it("renders an unstake preview control for valid full exits", () => {
    const html = renderToStaticMarkup(
      <ProtocolPanel
        activeTier="SEED"
        goldenKeyNft
        onTierChange={noop}
        onUnstakePreview={noop}
        rypBalance={10_000}
        selectedTier="SEED"
        stakedAmount={5_000}
        stakingDays={14}
        votingRightsNft={false}
        walletConnected
      />,
    );

    expect(html).toContain("Unstake Preview");
    expect(html).toContain("Prepare Unstake");
    expect(html).toContain("Full exit");
  });

  it("renders the below-Seed remainder warning before wallet signing", () => {
    const html = renderToStaticMarkup(
      <ProtocolPanel
        activeTier="SEED"
        goldenKeyNft
        onTierChange={noop}
        onUnstakePreview={noop}
        rypBalance={10_000}
        selectedTier="SEED"
        stakedAmount={8_000}
        stakingDays={14}
        votingRightsNft={false}
        walletConnected
      />,
    );

    expect(html).toContain("below the 5,000 RYP Seed minimum");
  });
});
