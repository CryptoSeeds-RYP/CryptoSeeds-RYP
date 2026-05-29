import { AlertTriangle, Vote } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";

export function GovernanceView({ votingActive }: { votingActive: boolean }) {
  return (
    <div className="location-view">
      <ViewHeader icon={Vote} label="Governance Hall" value={votingActive ? "Voting rights timer active" : "Stake to activate"} />
      <div className="proposal-grid">
        {[
          ["Approve Solar Water Node", "Project approval", "1 wallet = 1 vote"],
          ["Treasury Grove allocation", "Treasury policy", "Impact and R&D split"],
          ["SeedBot safety policy", "Protocol policy", "Automation limits"],
        ].map(([title, type, detail]) => (
          <article className="proposal-card" key={title}>
            <span>{type}</span>
            <strong>{title}</strong>
            <p>{detail}</p>
            <div className="vote-row">
              <button disabled={!votingActive}><Vote size={16} /> Yes</button>
              <button disabled={!votingActive}><AlertTriangle size={16} /> Review</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

