import { Activity } from "lucide-react";
import { appConfig } from "../config/env";
import { summarizeStakingPosition } from "../domain/staking";
import { RYP_CONFIRMED_SUPPLY, shortAddress } from "../domain/token";
import { selectableTiers } from "../domain/tiering";
import type { StakingTier } from "../types";
import { formatRyp } from "../utils/format";
import { StateLine } from "./StateLine";

export function ProtocolPanel({
  walletConnected,
  activeTier,
  selectedTier,
  rypBalance,
  stakedAmount,
  stakingDays,
  goldenKeyNft,
  votingRightsNft,
  onTierChange,
}: {
  walletConnected: boolean;
  activeTier: StakingTier;
  selectedTier: StakingTier;
  rypBalance: number;
  stakedAmount: number;
  stakingDays: number;
  goldenKeyNft: boolean;
  votingRightsNft: boolean;
  onTierChange: (tier: StakingTier) => void;
}) {
  const stakingSummary = summarizeStakingPosition({
    walletConnected,
    rypBalance,
    stakedAmount,
    stakingTier: activeTier,
    stakingDays,
    goldenKeyNft,
    votingRightsNft,
    claimableRewards: [],
  });

  return (
    <section className="side-panel">
      <div className="panel-title">
        <Activity size={18} />
        <strong>Protocol State</strong>
      </div>
      <div className="state-lines">
        <StateLine label="Wallet" value={walletConnected ? "Connected" : "Disconnected"} />
        <StateLine label="Tier" value={activeTier} />
        <StateLine label="Balance" value={`${formatRyp(rypBalance)} RYP`} />
        <StateLine label="Staked" value={`${formatRyp(stakedAmount)} RYP`} />
        <StateLine label="Fee Cut" value={`${stakingSummary.feeReductionPercent}%`} />
        <StateLine label="Effective Fee" value={stakingSummary.effectiveNetworkFee} />
        <StateLine
          label="Next Tier"
          value={
            stakingSummary.nextTier
              ? `${formatRyp(stakingSummary.rypToNextTier ?? 0)} RYP`
              : "Max tier"
          }
        />
        <StateLine
          label="Voting"
          value={
            stakingSummary.votingRightsState === "ACTIVE"
              ? "Active"
              : `${stakingSummary.votingDaysRemaining}d remaining`
          }
        />
        <StateLine label="Mint" value={shortAddress(appConfig.rypMintAddress)} />
        <StateLine label="Supply" value={RYP_CONFIRMED_SUPPLY} />
      </div>
      <div className="tier-control" aria-label="Demo staking tier">
        {selectableTiers.map((tier) => (
          <button
            key={tier}
            className={selectedTier === tier ? "active" : ""}
            onClick={() => onTierChange(tier)}
            title={tier}
          >
            {tier.slice(0, 2)}
          </button>
        ))}
      </div>
    </section>
  );
}
