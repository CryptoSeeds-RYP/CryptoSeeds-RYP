import { useState } from "react";
import { Bot, CheckCircle2, LockKeyhole, ShieldCheck, Signal } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import {
  buildSeedBotCapabilities,
  canAccessSeedBotStrategy,
  performanceForWindow,
  seedBotFeeDisclosure,
  seedBotPerformanceDisclaimer,
  seedBotPerformanceWindows,
  seedBotStrategies,
  type SeedBotPerformanceWindow,
  type SeedBotPerformanceWindowName,
  type SeedBotStrategy,
} from "../domain/seedbot";
import { recommendedSeedBotVenue, venueById } from "../domain/seedbotVenues";
import { buildSeedBotRoutePlan } from "../services/seedbotVenueRouter";
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
  const recommendedVenue = recommendedSeedBotVenue();
  const [selectedWindows, setSelectedWindows] = useState<Record<string, SeedBotPerformanceWindowName>>(
    Object.fromEntries(seedBotStrategies.map((strategy) => [strategy.id, "30D"])),
  );

  function selectWindow(strategyId: string, window: SeedBotPerformanceWindowName) {
    setSelectedWindows((current) => ({ ...current, [strategyId]: window }));
  }

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
          <div className="risk-control"><span>Primary venue</span><strong>{recommendedVenue.name}</strong></div>
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
        <section className="strategy-collection-panel">
          <div className="panel-title">
            <Bot size={18} />
            <strong>Public Strategy Collection</strong>
          </div>
          <p className="terminal-disclaimer">{seedBotPerformanceDisclaimer}</p>
          <div className="strategy-triangle">
            {seedBotStrategies.map((strategy, index) => {
              const accessible = canAccessSeedBotStrategy({
                walletConnected,
                stakingTier: activeTier,
                rypBalance,
                strategy,
              });
              const selectedWindow = selectedWindows[strategy.id] ?? "30D";
              const selectedPerformance = performanceForWindow(strategy, selectedWindow);
              const venue = venueById(strategy.preferredVenueId);
              const routePlan = buildSeedBotRoutePlan({ strategy });

              return (
                <article
                  className={`strategy-card strategy-card-${index + 1} ${accessible ? "enabled" : "locked"}`}
                  key={strategy.id}
                >
                  <div className="strategy-card-header">
                    <div>
                      <strong>{strategy.name}</strong>
                      <span>{strategy.summary}</span>
                      {venue && <span>{venue.name} / {formatLabel(venue.status)}</span>}
                    </div>
                    <em>{accessible ? "Unlocked" : `${formatLabel(strategy.minimumAccess)} required`}</em>
                  </div>
                  <div className="strategy-chart-header">
                    <div>
                      <span>{selectedPerformance.window} history</span>
                      <strong>
                        {selectedPerformance.returnPercent > 0 ? "+" : ""}
                        {selectedPerformance.returnPercent}%
                      </strong>
                    </div>
                    <div className="performance-toggle-row" aria-label={`${strategy.name} performance window`}>
                      {seedBotPerformanceWindows.map((window) => (
                        <button
                          className={selectedWindow === window ? "active" : ""}
                          key={`${strategy.id}-${window}`}
                          onClick={() => selectWindow(strategy.id, window)}
                        >
                          {window}
                        </button>
                      ))}
                    </div>
                  </div>
                  <StrategyPerformanceGraph performance={selectedPerformance} />
                  <div className="asset-route-list">
                    {strategy.assets.map((asset) => (
                      <span key={`${strategy.id}-${asset.symbol}`}>
                        {asset.symbol} {asset.targetWeightPercent}% / {asset.venueId}
                      </span>
                    ))}
                  </div>
                  <div className="venue-route-list">
                    {routePlan.routes.map((route) => (
                      <div key={`${strategy.id}-${route.venueId}`}>
                        <span>{route.venueName}</span>
                        <strong>{formatLabel(route.mode)}</strong>
                        <em>{route.assets.map((asset) => asset.symbol).join(" / ")}</em>
                      </div>
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

function StrategyPerformanceGraph({ performance }: { performance: SeedBotPerformanceWindow }) {
  const width = 260;
  const height = 112;
  const padding = 10;
  const values = performance.points;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(1, max - min);
  const step = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const zeroY = height - padding - ((0 - min) / range) * (height - padding * 2);

  return (
    <svg className="strategy-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${performance.window} historical performance graph`}>
      <line className="strategy-graph-zero" x1={padding} x2={width - padding} y1={zeroY} y2={zeroY} />
      <polyline className="strategy-graph-line" points={points} />
      {values.map((value, index) => {
        const [x, y] = points.split(" ")[index].split(",");
        return <circle className="strategy-graph-point" cx={x} cy={y} r={3} key={`${performance.window}-${index}-${value}`} />;
      })}
    </svg>
  );
}
