import { Bot, Coins, KeyRound, Leaf, LockKeyhole, Map, ScrollText, Sprout, Vote, Wheat } from "lucide-react";
import type { LocationKey, StakingTier } from "../types";
import { formatRyp } from "../utils/format";
import { Metric } from "../components/Metric";

export function HomesteadView({
  activeTier,
  walletConnected,
  rypBalance,
  stakedAmount,
  votingActive,
  seedBotUnlocked,
  onLocation,
}: {
  activeTier: StakingTier;
  walletConnected: boolean;
  rypBalance: number;
  stakedAmount: number;
  votingActive: boolean;
  seedBotUnlocked: boolean;
  onLocation: (location: LocationKey) => void;
}) {
  return (
    <div className="homestead-view">
      <div className="microverse-map">
        <img src="/assets/microverse-river-delta.jpg" alt="CryptoSeeds regenerative MicroVerse" />
        <div className="map-overlay" />
        <div className="map-title">
          <span>{activeTier === "NONE" ? "Wild Fields" : `${activeTier} Homestead`}</span>
          <strong>{walletConnected ? "Protocol state active" : "Wallet not connected"}</strong>
        </div>
        <button className="map-marker homestead-marker" onClick={() => onLocation("homestead")} title="Homestead">
          <Sprout size={18} />
          <span>Homestead</span>
        </button>
        <button className="map-marker explorer-marker" onClick={() => onLocation("explorer")} title="Explorer's Map">
          <Map size={18} />
          <span>Explorer</span>
        </button>
        <button className="map-marker harvest-marker" onClick={() => onLocation("harvest")} title="Harvest Ledger">
          <Wheat size={18} />
          <span>Harvest</span>
        </button>
        <button className="map-marker governance-marker" onClick={() => onLocation("governance")} title="Governance Hall">
          <Vote size={18} />
          <span>Governance</span>
        </button>
        <button className={`map-marker seedbot-marker ${seedBotUnlocked ? "" : "locked"}`} onClick={() => onLocation("seedbot")} title="SeedBot Terminal">
          {seedBotUnlocked ? <Bot size={18} /> : <LockKeyhole size={18} />}
          <span>SeedBot</span>
        </button>
      </div>

      <div className="metric-row">
        <Metric icon={Coins} label="RYP balance" value={formatRyp(rypBalance)} />
        <Metric icon={Leaf} label="Staked" value={formatRyp(stakedAmount)} />
        <Metric icon={KeyRound} label="Golden Key" value={walletConnected && activeTier !== "NONE" ? "Active" : "Locked"} />
        <Metric icon={ScrollText} label="Voting NFT" value={votingActive ? "14d timer" : "Locked"} />
      </div>
    </div>
  );
}

