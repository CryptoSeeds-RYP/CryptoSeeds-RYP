import { Bot, CheckCircle2, LockKeyhole, ShieldCheck, Signal } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import {
  buildSeedBotCapabilities,
  canAccessSeedBotStrategy,
  seedBotFeeDisclosure,
  seedBotPerformanceDisclaimer,
  seedBotStrategies,
  type SeedBotStrategy,
} from "../domain/seedbot";
import type { SeedBotSignal, StakingTier } from "../types";
import { formatLabel } from "../utils/format";

export function SeedBotView({
  unlocked,
  walletConnected,
  activeTier,
  rypBalance,
  signals,
  onPrepareAllocation,
}: {
  unlocked: boolean;
  walletConnected: boolean;
  activeTier: StakingTier;
  rypBalance: number;
  signals: SeedBotSignal[];
  onPrepareAllocation: (strategy: SeedBotStrategy, mode: "BASKET" | "PER_ASSET") => void;
}) {
  const capabilities = buildSeedBotCapabilities({ walletConnected, stakingTier: activeTier, rypBalance });

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
        <section className="terminal-panel strategy-collection-panel">
          <div className="panel-title">
            <Bot size={18} />
            <strong>Public Strategy Collection</strong>
          </div>
          <p className="terminal-disclaimer">{seedBotPerformanceDisclaimer}</p>
          <div className="strategy-card-list">
            {seedBotStrategies.map((strategy) => {
              const accessible = canAccessSeedBotStrategy({
                walletConnected,
                stakingTier: activeTier,
                rypBalance,
                strategy,
              });

              return (
                <article className={`strategy-card ${accessible ? "enabled" : "locked"}`} key={strategy.id}>
                  <div className="strategy-card-header">
                    <div>
                      <strong>{strategy.name}</strong>
                      <span>{strategy.summary}</span>
                    </div>
                    <em>{accessible ? "Unlocked" : `${formatLabel(strategy.minimumAccess)} required`}</em>
                  </div>
                  <div className="performance-grid">
                    {strategy.performance.map((item) => (
                      <div key={`${strategy.id}-${item.window}`}>
                        <span>{item.window}</span>
                        <strong>{item.returnPercent > 0 ? "+" : ""}{item.returnPercent}%</strong>
                      </div>
                    ))}
                  </div>
                  <div className="asset-route-list">
                    {strategy.assets.map((asset) => (
                      <span key={`${strategy.id}-${asset.symbol}`}>
                        {asset.symbol} {asset.targetWeightPercent}% / {asset.walletRoute}
                      </span>
                    ))}
                  </div>
                  <p>{seedBotFeeDisclosure(strategy.feeModel)}</p>
                  <div className="strategy-actions">
                    <button disabled={!accessible} onClick={() => onPrepareAllocation(strategy, "BASKET")}>
                      Allocate Basket
                    </button>
                    <button disabled={!accessible} onClick={() => onPrepareAllocation(strategy, "PER_ASSET")}>
                      Per-Asset Routes
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
