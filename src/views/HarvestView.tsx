import { Eye, LockKeyhole, Wheat, Zap } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import type { Reward } from "../types";
import { formatLabel } from "../utils/format";

export function HarvestView({ rewards }: { rewards: Reward[] }) {
  return (
    <div className="location-view">
      <ViewHeader icon={Wheat} label="Harvest Ledger" value="Claims, reports, and achievements" />
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

