import { AlertTriangle, BadgeCheck, Bot, Clock3, Landmark, ListChecks, ShieldCheck, Vote, WalletCards } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import { basisPointsToPercent } from "../domain/feeRouter";
import { agentSafetyRules, maintenanceRunbook } from "../domain/operations";
import {
  authorityControls,
  platformBoundaries,
  platformFeePolicy,
  reviewGates,
} from "../domain/platformGovernance";
import { formatLabel } from "../utils/format";

export function GovernanceView({ votingActive }: { votingActive: boolean }) {
  return (
    <div className="location-view">
      <ViewHeader icon={Vote} label="Governance Hall" value={votingActive ? "Voting rights timer active" : "Stake to activate"} />
      <section className="governance-section">
        <div className="view-header">
          <div>
            <ShieldCheck size={20} />
            <strong>Platform Charter</strong>
          </div>
          <span>Self-custodial by design</span>
        </div>
        <div className="authority-grid">
          {platformBoundaries.map((boundary) => (
            <article className="authority-card" key={boundary.id}>
              <div className="authority-card-top">
                <WalletCards size={17} />
                <span>{boundary.status}</span>
              </div>
              <strong>{boundary.label}</strong>
              <p>{boundary.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="governance-section">
        <div className="view-header">
          <div>
            <ListChecks size={20} />
            <strong>Ops Console</strong>
          </div>
          <span>Non-specialist operator mode</span>
        </div>
        <div className="authority-grid ops-grid">
          {maintenanceRunbook.map((item) => (
            <article className={`authority-card ops-card ${item.automationMode.toLowerCase()}`} key={item.id}>
              <div className="authority-card-top">
                <ListChecks size={17} />
                <span>{formatLabel(item.cadence)}</span>
              </div>
              <strong>{item.label}</strong>
              <p>{item.operatorAction}</p>
              <em>{formatLabel(item.automationMode)}{item.script ? ` / ${item.script}` : ""}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="governance-section">
        <div className="view-header">
          <div>
            <Bot size={20} />
            <strong>AI Agent Boundaries</strong>
          </div>
          <span>Assistive, not custodial</span>
        </div>
        <div className="policy-strip agent-policy-strip">
          {agentSafetyRules.map((rule) => (
            <div className={rule.allowed ? "allowed" : "blocked"} key={rule.id}>
              <span>{rule.allowed ? "Allowed" : "Blocked"}</span>
              <strong>{rule.label}</strong>
              <em>{rule.detail}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="governance-section">
        <div className="view-header">
          <div>
            <Landmark size={20} />
            <strong>Fee & Treasury Policy</strong>
          </div>
          <span>{basisPointsToPercent(platformFeePolicy.tokenTransferFeeBps)} RYP transfer fee</span>
        </div>
        <div className="policy-strip">
          <div>
            <span>RYP transfer fee</span>
            <strong>{basisPointsToPercent(platformFeePolicy.tokenTransferFeeBps)}</strong>
          </div>
          <div>
            <span>Platform action fee</span>
            <strong>{basisPointsToPercent(platformFeePolicy.baseFeeBps)} before tier reduction</strong>
          </div>
          <div>
            <span>Fee buckets</span>
            <strong>{platformFeePolicy.splitBuckets.map(formatLabel).join(" / ")}</strong>
          </div>
          <div>
            <span>Split status</span>
            <strong>{formatLabel(platformFeePolicy.exactSplitStatus)}</strong>
          </div>
          <div>
            <span>Transfer enforcement</span>
            <strong>Wrapper or token-extension route required</strong>
          </div>
          <div>
            <span>SeedBot fee</span>
            <strong>Review-gated preview</strong>
          </div>
        </div>
        <div className="policy-note-list">
          {platformFeePolicy.tokenTransferFeeNotes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
      </section>

      <section className="governance-section">
        <div className="view-header">
          <div>
            <Clock3 size={20} />
            <strong>Authority Map</strong>
          </div>
          <span>Multisig/timelock target</span>
        </div>
        <div className="authority-grid">
          {authorityControls.map((control) => (
            <article className={`authority-card ${control.currentState.toLowerCase()}`} key={control.id}>
              <div className="authority-card-top">
                <BadgeCheck size={17} />
                <span>{formatLabel(control.currentState)}</span>
              </div>
              <strong>{control.label}</strong>
              <p>{control.targetControl}</p>
            </article>
          ))}
        </div>
      </section>

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

      <section className="governance-section">
        <div className="view-header">
          <div>
            <AlertTriangle size={20} />
            <strong>Review Gates</strong>
          </div>
          <span>Blocked before live use</span>
        </div>
        <div className="authority-grid">
          {reviewGates.map((gate) => (
            <article className={`authority-card review-${gate.status.toLowerCase()}`} key={gate.id}>
              <div className="authority-card-top">
                <AlertTriangle size={17} />
                <span>{formatLabel(gate.status)}</span>
              </div>
              <strong>{gate.label}</strong>
              <p>{gate.reason}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
