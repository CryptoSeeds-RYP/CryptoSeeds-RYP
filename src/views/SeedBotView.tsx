import { Bot, ShieldCheck, Signal } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import type { SeedBotSignal } from "../types";

export function SeedBotView({ unlocked, signals }: { unlocked: boolean; signals: SeedBotSignal[] }) {
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
      </div>
    </div>
  );
}

