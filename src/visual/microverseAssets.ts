import assetSpecs from "./microverseAssetSpecs.json";
import type { LocationKey } from "../types";
import type { ProjectLifecycleVisualState } from "./projectVisuals";

export type MicroVerseLandmarkKind =
  | "HOMESTEAD"
  | "EXPLORER_MAP"
  | "GOVERNANCE_HALL"
  | "HARVEST_LEDGER"
  | "SEEDBOT_TERMINAL"
  | "STEWARD_GLADE"
  | "LOREHOUSE"
  | "TREASURY_GROVE";

export type MicroVerseLandmark = {
  id: string;
  label: string;
  kind: MicroVerseLandmarkKind;
  x: number;
  y: number;
  scale: number;
  accent: number;
  assetPath?: string;
  destination?: LocationKey;
};

export type MicroVerseAssetRole =
  | "CONCEPT_PLATE"
  | "WORLD_PLATE"
  | "LANDMARK"
  | "PROJECT_TILE"
  | "UI_OBJECT"
  | "PARTICLE";

export type MicroVerseAssetState =
  | "CONCEPT"
  | "LOCKED"
  | "IDLE"
  | "OPEN"
  | "ACTIVE"
  | "ATTENTION"
  | "MILESTONE"
  | "HARVEST"
  | "COMPLETED"
  | "PAUSED";

export type MicroVerseAssetSpec = {
  id: string;
  role: MicroVerseAssetRole;
  state: MicroVerseAssetState;
  path: string;
  targetWidth: number;
  targetHeight: number;
  maxBytes: number;
  productionReady: boolean;
  notes: string;
};

export type MicroVerseProjectTileAsset = {
  lifecycle: ProjectLifecycleVisualState;
  state: MicroVerseAssetState;
  assetPath: string;
  targetWidth: number;
};

export const MICROVERSE_ASSETS = {
  conceptPlate: "/assets/concepts/microverse-world-plate-v1.png",
  atlasManifest: "/assets/microverse-atlas.json",
} as const;

export const MICROVERSE_PALETTE = {
  terrainBase: 0x10282d,
  terrainWash: 0x1e575b,
  waterDeep: 0x0f4658,
  waterMid: 0x2194a9,
  waterLight: 0xd9fff8,
  soilGold: 0xf1cc74,
  pathShadow: 0x3f6653,
  ivory: 0xfff8df,
  harvestGold: 0xffd66b,
  greenhouseTeal: 0x80dcca,
  researchBlue: 0x8fb7ff,
  stewardViolet: 0xd7b1ff,
  groveGreen: 0x80c66d,
  dangerWarm: 0xffa37b,
} as const;

export const MICROVERSE_LANDMARKS: MicroVerseLandmark[] = [
  {
    id: "homestead",
    label: "Homestead",
    kind: "HOMESTEAD",
    x: 0.17,
    y: 0.72,
    scale: 1.04,
    accent: MICROVERSE_PALETTE.harvestGold,
    assetPath: "/assets/landmarks/homestead-active.png",
    destination: "homestead",
  },
  {
    id: "explorer-map",
    label: "Explorer's Map",
    kind: "EXPLORER_MAP",
    x: 0.32,
    y: 0.25,
    scale: 0.98,
    accent: MICROVERSE_PALETTE.researchBlue,
    assetPath: "/assets/landmarks/explorer-map-active.png",
    destination: "explorer",
  },
  {
    id: "governance-hall",
    label: "Governance Hall",
    kind: "GOVERNANCE_HALL",
    x: 0.78,
    y: 0.23,
    scale: 1.2,
    accent: MICROVERSE_PALETTE.greenhouseTeal,
    assetPath: "/assets/landmarks/governance-hall-active.png",
    destination: "governance",
  },
  {
    id: "harvest-ledger",
    label: "Harvest Ledger",
    kind: "HARVEST_LEDGER",
    x: 0.55,
    y: 0.76,
    scale: 0.96,
    accent: MICROVERSE_PALETTE.harvestGold,
    assetPath: "/assets/landmarks/harvest-ledger-active.png",
    destination: "harvest",
  },
  {
    id: "seedbot-terminal",
    label: "SeedBot Terminal",
    kind: "SEEDBOT_TERMINAL",
    x: 0.84,
    y: 0.73,
    scale: 1.02,
    accent: MICROVERSE_PALETTE.harvestGold,
    assetPath: "/assets/landmarks/seedbot-terminal-active.png",
    destination: "seedbot",
  },
  {
    id: "stewards-glade",
    label: "Steward's Glade",
    kind: "STEWARD_GLADE",
    x: 0.9,
    y: 0.46,
    scale: 0.96,
    accent: MICROVERSE_PALETTE.stewardViolet,
    assetPath: "/assets/landmarks/stewards-glade-active.png",
  },
  {
    id: "lorehouse",
    label: "Lorehouse",
    kind: "LOREHOUSE",
    x: 0.52,
    y: 0.16,
    scale: 0.94,
    accent: MICROVERSE_PALETTE.researchBlue,
    assetPath: "/assets/landmarks/lorehouse-active.png",
  },
  {
    id: "treasury-grove",
    label: "Treasury Grove",
    kind: "TREASURY_GROVE",
    x: 0.12,
    y: 0.43,
    scale: 0.9,
    accent: MICROVERSE_PALETTE.harvestGold,
    assetPath: "/assets/landmarks/treasury-grove-active.png",
  },
];

export const MICROVERSE_PROJECT_TILE_ASSETS: Record<ProjectLifecycleVisualState, MicroVerseProjectTileAsset> = {
  EMPTY: {
    lifecycle: "EMPTY",
    state: "OPEN",
    assetPath: "/assets/project-tiles/project-open.png",
    targetWidth: 286,
  },
  PREPARING: {
    lifecycle: "PREPARING",
    state: "ACTIVE",
    assetPath: "/assets/project-tiles/project-active.png",
    targetWidth: 304,
  },
  ACTIVE: {
    lifecycle: "ACTIVE",
    state: "ACTIVE",
    assetPath: "/assets/project-tiles/project-active.png",
    targetWidth: 304,
  },
  MILESTONE: {
    lifecycle: "MILESTONE",
    state: "MILESTONE",
    assetPath: "/assets/project-tiles/project-milestone.png",
    targetWidth: 322,
  },
  HARVEST: {
    lifecycle: "HARVEST",
    state: "HARVEST",
    assetPath: "/assets/project-tiles/project-harvest.png",
    targetWidth: 332,
  },
  COMPLETED: {
    lifecycle: "COMPLETED",
    state: "COMPLETED",
    assetPath: "/assets/project-tiles/project-completed.png",
    targetWidth: 304,
  },
  PAUSED: {
    lifecycle: "PAUSED",
    state: "PAUSED",
    assetPath: "/assets/project-tiles/project-paused.png",
    targetWidth: 296,
  },
};

export const MICROVERSE_ASSET_SPECS = assetSpecs as MicroVerseAssetSpec[];
