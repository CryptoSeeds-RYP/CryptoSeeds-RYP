import { useMemo, useState } from "react";
import { Activity, ArrowDownToLine } from "lucide-react";
import { appConfig } from "../config/env";
import { basisPointsToPercent, RYP_TOKEN_TRANSFER_FEE_BPS } from "../domain/feeRouter";
import { summarizeStakingPosition, validateUnstakePreview } from "../domain/staking";
import { RYP_CONFIRMED_SUPPLY, shortAddress } from "../domain/token";
import { buildTokenTrustChecks, tokenTrustSummary } from "../domain/tokenTrust";
import { selectableTiers } from "../domain/tiering";
import type { StakingTier } from "../types";
import { formatLabel, formatRyp } from "../utils/format";
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
  onUnstakePreview,
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
  onUnstakePreview: (amount: number) => void;
}) {
  const [unstakeAmount, setUnstakeAmount] = useState("5000");
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
  const trustChecks = buildTokenTrustChecks();
  const trustSummary = tokenTrustSummary(trustChecks);
  const unstakeAmountNumber = Number(unstakeAmount.replace(/,/g, "").trim());
  const unstakeValidation = useMemo(
    () =>
      validateUnstakePreview({
        currentStakedAmount: stakedAmount,
        unstakeAmount: Number.isFinite(unstakeAmountNumber) ? unstakeAmountNumber : unstakeAmount,
      }),
    [stakedAmount, unstakeAmount, unstakeAmountNumber],
  );
  const unstakeDisabled = stakedAmount <= 0 || !walletConnected || !Number.isFinite(unstakeAmountNumber) || unstakeAmountNumber <= 0;

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
        <StateLine label="Platform Fee" value={stakingSummary.effectivePlatformFee} />
        <StateLine label="Transfer Fee" value={basisPointsToPercent(RYP_TOKEN_TRANSFER_FEE_BPS)} />
        <StateLine label="RYP Trust" value={`${trustSummary.verified}/${trustSummary.total} verified`} />
        <StateLine
          label="Fee Route"
          value={formatLabel(trustChecks.find((check) => check.id === "transfer-fee-route")?.status ?? "REVIEW_REQUIRED")}
        />
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
      <div className="unstake-preview-form">
        <label htmlFor="unstake-preview-amount">
          <span>Unstake Preview</span>
          <input
            id="unstake-preview-amount"
            inputMode="decimal"
            min="0"
            onChange={(event) => setUnstakeAmount(event.target.value)}
            type="number"
            value={unstakeAmount}
          />
        </label>
        <span className={`unstake-preview-status ${unstakeValidation.valid ? "valid" : "blocked"}`}>
          {unstakeValidation.valid
            ? unstakeValidation.remainingAmount === 0
              ? "Full exit"
              : `${formatRyp(unstakeValidation.remainingAmount)} RYP remains`
            : unstakeValidation.reason}
        </span>
        <button
          className="secondary-action compact-action"
          disabled={unstakeDisabled}
          onClick={() => onUnstakePreview(unstakeAmountNumber)}
        >
          <ArrowDownToLine size={16} />
          Prepare Unstake
        </button>
      </div>
    </section>
  );
}
