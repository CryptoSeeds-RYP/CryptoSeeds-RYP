import { CalendarClock, Eye, LockKeyhole, ShieldCheck, Vault, Wheat, Zap } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import { appConfig } from "../config/env";
import { holderRewardPolicy, holderRewardTierRules } from "../domain/holderRewards";
import { shortAddress } from "../domain/token";
import type { RewardAccountInspection } from "../solana/rewardAccountInspection";
import type { Reward } from "../types";
import { formatLabel } from "../utils/format";

export function HarvestView({
  rewardInspection,
  rewards,
}: {
  rewardInspection?: RewardAccountInspection;
  rewards: Reward[];
}) {
  return (
    <div className="location-view">
      <ViewHeader icon={Wheat} label="Harvest Ledger" value="Claims, reports, and achievements" />
      <section className="governance-section">
        <div className="view-header">
          <div>
            <CalendarClock size={20} />
            <strong>{holderRewardPolicy.label}</strong>
          </div>
          <span>Net-of-cost payout engine</span>
        </div>
        <div className="policy-strip holder-reward-policy-strip">
          <div>
            <span>Cadence</span>
            <strong>{formatLabel(holderRewardPolicy.cadence)}</strong>
          </div>
          <div>
            <span>Funding</span>
            <strong>Holder allocation pays delivery</strong>
          </div>
          <div>
            <span>Dust rule</span>
            <strong>Roll forward</strong>
          </div>
        </div>
        <div className="authority-grid holder-tier-grid">
          {holderRewardTierRules.map((rule) => (
            <article className="authority-card holder-tier-card" key={rule.tier}>
              <div className="authority-card-top">
                <CalendarClock size={17} />
                <span>{formatLabel(rule.cadence)}</span>
              </div>
              <strong>{formatLabel(rule.tier)}</strong>
              <p>{rule.note}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="governance-section">
        <div className="view-header">
          <div>
            <Vault size={20} />
            <strong>Reward Protocol Mirror</strong>
          </div>
          <span>
            {rewardInspection
              ? `${formatLabel(rewardInspection.rewardConfigStatus)} / epoch #${rewardInspection.epochId}`
              : "Read-only mirror inactive"}
          </span>
        </div>
        <div className="authority-grid">
          <article className={`authority-card ${rewardInspection?.rewardConfigStatus.toLowerCase() ?? "preview_only"}`}>
            <div className="authority-card-top">
              <ShieldCheck size={17} />
              <span>{formatLabel(rewardInspection?.rewardConfigStatus ?? "PREVIEW_ONLY")}</span>
            </div>
            <strong>
              {rewardInspection?.rewardConfig
                ? `${rewardInspection.rewardConfig.holderSplitBps}/${rewardInspection.rewardConfig.stakerSplitBps}/${rewardInspection.rewardConfig.treasurySplitBps} bps`
                : "Configured reward split"}
            </strong>
            <p>{rewardInspection?.rewardConfigMessage ?? "No live reward config account is being inspected."}</p>
            <em>{rewardInspection ? shortAddress(rewardInspection.rewardConfigAddress) : "No reward config PDA"}</em>
          </article>
          <article className={`authority-card ${rewardInspection?.epochStatus.toLowerCase() ?? "preview_only"}`}>
            <div className="authority-card-top">
              <CalendarClock size={17} />
              <span>{formatLabel(rewardInspection?.epochStatus ?? "PREVIEW_ONLY")}</span>
            </div>
            <strong>
              {rewardInspection?.epoch
                ? `${formatLabel(rewardInspection.epoch.status)} / ${formatRewardBaseUnits(rewardInspection.epoch.rewardPoolAmount)} pool`
                : "Configured reward epoch"}
            </strong>
            <p>{rewardInspection?.epochMessage ?? "No live reward epoch account is being inspected."}</p>
            <em>
              {rewardInspection?.epoch
                ? `Claims expire ${formatRewardDate(rewardInspection.epoch.claimExpiresAt)}`
                : rewardInspection ? shortAddress(rewardInspection.epochPreviewAddress) : "No epoch PDA"}
            </em>
          </article>
          <article className="authority-card">
            <div className="authority-card-top">
              <Wheat size={17} />
              <span>Read only</span>
            </div>
            <strong>
              {rewardInspection?.epoch
                ? `${formatRewardBaseUnits(rewardInspection.epoch.distributedNetAmount)} net / ${formatRewardBaseUnits(rewardInspection.epoch.reservedDeliveryCostAmount)} delivery`
                : "No claim accounting loaded"}
            </strong>
            <p>
              {rewardInspection?.epoch
                ? `${formatRewardBaseUnits(rewardInspection.epoch.claimedNetAmount)} claimed / ${formatRewardBaseUnits(rewardInspection.epoch.rolledForwardAmount)} rolled forward`
                : "No reward claim action is exposed by this mirror."}
            </p>
            <em>{rewardInspection?.executionMode ?? "READ_ONLY"}</em>
          </article>
        </div>
        {rewardInspection && (
          <div className="authority-grid holder-tier-grid">
            {rewardInspection.vaults.map((vault) => (
              <article className={`authority-card reward-account-card ${vault.status.toLowerCase()}`} key={vault.address}>
                <div className="authority-card-top">
                  <Vault size={17} />
                  <span>{formatLabel(vault.status)}</span>
                </div>
                <strong>{vault.label}</strong>
                <p>
                  {vault.decoded
                    ? `${formatLabel(vault.decoded.custodyModel)} / ${formatLabel(vault.decoded.verificationStatus)}`
                    : vault.message ?? "Vault state not decoded."}
                </p>
                <em>
                  {vault.decoded
                    ? `${formatRewardBaseUnits(vault.decoded.totalFundedAmount)} / ${shortAddress(vault.decoded.vaultAddress)}`
                    : shortAddress(vault.address)}
                </em>
              </article>
            ))}
          </div>
        )}
        {rewardInspection && rewardInspectionMessages(rewardInspection).length > 0 && (
          <div className="policy-note-list">
            {rewardInspectionMessages(rewardInspection).map((message) => (
              <span key={message}>{message}</span>
            ))}
          </div>
        )}
      </section>
      <div className="ledger-list">
        {rewards.map((reward) => (
          <article className="ledger-item" key={reward.id}>
            <div className="ledger-icon">
              {reward.status === "READY" ? <Zap size={18} /> : <LockKeyhole size={18} />}
            </div>
            <div>
              <strong>{reward.label}</strong>
              <span>{reward.source}</span>
            </div>
            <div className="ledger-action">
              <span>{reward.amount ?? formatLabel(reward.type)}</span>
              <button disabled={reward.status !== "READY"}>
                <Eye size={16} />
                {reward.status === "READY" ? "Open" : reward.status}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function rewardInspectionMessages(inspection: RewardAccountInspection) {
  return [...inspection.blockers, ...inspection.warnings];
}

function formatRewardBaseUnits(value: string) {
  try {
    const raw = BigInt(value);
    const divisor = 10n ** BigInt(appConfig.rypDecimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    if (fraction === 0n) return `${wholeText} RYP`;

    const fractionText = fraction.toString().padStart(appConfig.rypDecimals, "0").replace(/0+$/, "");
    return `${wholeText}.${fractionText} RYP`;
  } catch {
    return "Invalid";
  }
}

function formatRewardDate(value: string) {
  if (value === "0") return "not set";
  try {
    const timestampMs = Number(BigInt(value) * 1000n);
    const date = new Date(timestampMs);
    if (Number.isNaN(date.getTime())) return "invalid";
    return date.toISOString().slice(0, 10);
  } catch {
    return "invalid";
  }
}
