import { CalendarClock, Eye, LockKeyhole, Wheat, Zap } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import { holderRewardPolicy, holderRewardTierRules } from "../domain/holderRewards";
import type { Reward } from "../types";
import { formatLabel } from "../utils/format";

export function HarvestView({ rewards }: { rewards: Reward[] }) {
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
