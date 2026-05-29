import { useState } from "react";
import { Bot, CheckCircle2, CirclePause, LockKeyhole, SearchCheck, ShieldCheck, Signal, XCircle } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import { appConfig } from "../config/env";
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
import { shortEvmAddress } from "../evm/useMetaMaskWallet";
import {
  buildHyperliquidCancelOrderDraft,
  buildHyperliquidOrderStatusQuery,
  buildHyperliquidScheduleCancelDraft,
} from "../services/hyperliquidAdapter";
import { buildSeedBotRoutePlan } from "../services/seedbotVenueRouter";
import type { SeedBotSignal, StakingTier } from "../types";
import { formatLabel } from "../utils/format";

export function SeedBotView({
  unlocked,
  walletConnected,
  activeTier,
  rypBalance,
  evmWalletAddress,
  evmChainId,
  signals,
  onPrepareAllocation,
}: {
  unlocked: boolean;
  walletConnected: boolean;
  activeTier: StakingTier;
  rypBalance: number;
  evmWalletAddress?: string;
  evmChainId?: string;
  signals: SeedBotSignal[];
  onPrepareAllocation: (strategy: SeedBotStrategy, mode: "BASKET" | "PER_ASSET") => void;
}) {
  const capabilities = buildSeedBotCapabilities({ walletConnected, stakingTier: activeTier, rypBalance });
  const recommendedVenue = recommendedSeedBotVenue();
  const [selectedWindows, setSelectedWindows] = useState<Record<string, SeedBotPerformanceWindowName>>(
    Object.fromEntries(seedBotStrategies.map((strategy) => [strategy.id, "30D"])),
  );
  const [controlOrderId, setControlOrderId] = useState("123456");
  const [controlAssetId, setControlAssetId] = useState("0");
  const parsedOrderId = parseHyperliquidOrderId(controlOrderId);
  const parsedAssetId = parseIntegerField(controlAssetId);
  const previewNonce = Date.UTC(2026, 4, 30, 12, 0, 0);
  const previewExpiresAfter = previewNonce + 60_000;
  const statusQuery = buildHyperliquidOrderStatusQuery({
    user: evmWalletAddress ?? "",
    oid: parsedOrderId,
    network: appConfig.seedBotHyperliquidNetwork,
  });
  const cancelDraft = buildHyperliquidCancelOrderDraft({
    assetId: parsedAssetId,
    oid: typeof parsedOrderId === "number" ? parsedOrderId : Number.NaN,
    nonce: previewNonce,
    expiresAfter: previewExpiresAfter,
    network: appConfig.seedBotHyperliquidNetwork,
    signedExecutionEnabled: appConfig.seedBotSignedExecutionEnabled,
  });
  const scheduleCancelDraft = buildHyperliquidScheduleCancelDraft({
    time: previewNonce + 10_000,
    nonce: previewNonce,
    expiresAfter: previewExpiresAfter,
    network: appConfig.seedBotHyperliquidNetwork,
    signedExecutionEnabled: appConfig.seedBotSignedExecutionEnabled,
  });

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
        <section className="terminal-panel execution-guard-panel">
          <div className="panel-title">
            <ShieldCheck size={18} />
            <strong>Execution Guard</strong>
          </div>
          <div className="execution-guard-grid">
            <div>
              <span>Venue</span>
              <strong>Hyperliquid {appConfig.seedBotHyperliquidNetwork}</strong>
            </div>
            <div>
              <span>Signed execution</span>
              <strong>{appConfig.seedBotSignedExecutionEnabled ? "Enabled" : "Disabled"}</strong>
            </div>
            <div>
              <span>EVM wallet</span>
              <strong>{evmWalletAddress ? shortEvmAddress(evmWalletAddress) : "Not connected"}</strong>
            </div>
            <div>
              <span>Chain</span>
              <strong>{evmChainId ?? "Pending"}</strong>
            </div>
          </div>
          <div className="execution-control-row">
            <button disabled title="Requires a known order id and signed testnet mode">
              <SearchCheck size={15} />
              Status
            </button>
            <button disabled title="Requires a known order id and signed testnet mode">
              <XCircle size={15} />
              Cancel
            </button>
            <button disabled title="Requires signed testnet mode">
              <CirclePause size={15} />
              Kill Switch
            </button>
          </div>
          <div className="execution-preview-form">
            <label>
              <span>Mock order id</span>
              <input
                value={controlOrderId}
                onChange={(event) => setControlOrderId(event.target.value)}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Asset id</span>
              <input
                inputMode="numeric"
                value={controlAssetId}
                onChange={(event) => setControlAssetId(event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
          <div className="execution-preview-grid">
            <ExecutionPreviewCard
              title="Status Query"
              status={statusQuery.status}
              blockedReasons={statusQuery.blockedReasons}
              payload={{ endpoint: statusQuery.infoEndpoint, body: statusQuery.body ?? null }}
            />
            <ExecutionPreviewCard
              title="Cancel Draft"
              status={cancelDraft.status}
              blockedReasons={cancelDraft.blockedReasons}
              payload={{ endpoint: cancelDraft.exchangeEndpoint, request: cancelDraft.request ?? null }}
            />
            <ExecutionPreviewCard
              title="Kill Switch Draft"
              status={scheduleCancelDraft.status}
              blockedReasons={scheduleCancelDraft.blockedReasons}
              payload={{
                endpoint: scheduleCancelDraft.exchangeEndpoint,
                request: scheduleCancelDraft.request ?? null,
              }}
            />
          </div>
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

function ExecutionPreviewCard({
  title,
  status,
  blockedReasons,
  payload,
}: {
  title: string;
  status: string;
  blockedReasons: string[];
  payload: unknown;
}) {
  return (
    <article className="execution-preview-card">
      <header>
        <strong>{title}</strong>
        <span className={`status-pill ${blockedReasons.length > 0 ? "blocked" : "ready"}`}>{formatLabel(status)}</span>
      </header>
      {blockedReasons.length > 0 && (
        <div className="execution-blockers">
          {blockedReasons.map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      )}
      <pre>{JSON.stringify(payload, null, 2)}</pre>
    </article>
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

function parseHyperliquidOrderId(value: string) {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseIntegerField(value: string) {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  return Number(trimmed);
}
