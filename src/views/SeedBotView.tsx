import { Bot, CheckCircle2, LockKeyhole, ShieldCheck, Signal } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import { buildSeedBotCapabilities } from "../domain/seedbot";
import type { SeedBotSignal, StakingTier } from "../types";
import { formatLabel } from "../utils/format";

export function SeedBotView({
  unlocked,
  walletConnected,
  activeTier,
  signals,
}: {
  unlocked: boolean;
  walletConnected: boolean;
  activeTier: StakingTier;
  signals: SeedBotSignal[];
}) {
  const capabilities = buildSeedBotCapabilities({ walletConnected, stakingTier: activeTier });

  return (
    <div className="location-view seedbot-view">
      <ViewHeader icon={Bot} label="SeedBot Terminal" value={unlocked ? "Signal-only mode" : "Access locked"} />
      <div className="terminal-grid">
        <section className="terminal-panel">
          <div className="panel-title">
            <Signal size={18} />
            <strong>Market Grove</strong>
          </div>
          {signals.map((item) => (
            <div className="signal-row" key={item.token}>
              <span>{item.token}</span>
              <strong>{item.signal}</strong>
              <em>{item.change}</em>
            </div>
          ))}
        </section>
        <section className="terminal-panel">
          <div className="panel-title">
            <ShieldCheck size={18} />
            <strong>Risk Canopy</strong>
          </div>
          <div className="risk-control"><span>Private keys</span><strong>Never requested</strong></div>
          <div className="risk-control"><span>Execution</span><strong>Wallet approved</strong></div>
          <div className="risk-control"><span>Automation</span><strong>Disabled in MVP</strong></div>
          <div className="risk-control"><span>Slippage</span><strong>0.5% demo cap</strong></div>
        </section>
        <section className="terminal-panel">
          <div className="panel-title">
            <CheckCircle2 size={18} />
            <strong>Strategy Seeds</strong>
          </div>
          <div className="capability-list">
            {capabilities.map((capability) => (
              <article className={`capability-row ${capability.enabled ? "enabled" : "locked"}`} key={capability.id}>
                <div className="capability-icon">
                  {capability.enabled ? <CheckCircle2 size={16} /> : <LockKeyhole size={16} />}
                </div>
                <div>
                  <strong>{capability.label}</strong>
                  <span>{formatLabel(capability.mode)}</span>
                </div>
                <em>{capability.safetyNote}</em>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
