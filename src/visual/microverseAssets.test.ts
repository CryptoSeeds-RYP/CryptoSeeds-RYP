import { describe, expect, it } from "vitest";
import {
  MICROVERSE_ASSETS,
  MICROVERSE_ASSET_SPECS,
  MICROVERSE_LANDMARKS,
  MICROVERSE_PALETTE,
  MICROVERSE_PROJECT_TILE_ASSETS,
} from "./microverseAssets";
import { MICROVERSE_PLOT_POSITIONS } from "./microverseSceneState";
import type { ProjectLifecycleVisualState } from "./projectVisuals";

describe("microverse visual asset registry", () => {
  it("keeps core asset paths rooted in the public assets directory", () => {
    expect(MICROVERSE_ASSETS.conceptPlate).toMatch(/^\/assets\//);
    expect(MICROVERSE_ASSETS.atlasManifest).toMatch(/^\/assets\//);
  });

  it("defines a complete first-pass landmark set inside normalized world coordinates", () => {
    expect(MICROVERSE_LANDMARKS.map((landmark) => landmark.kind)).toEqual([
      "HOMESTEAD",
      "EXPLORER_MAP",
      "GOVERNANCE_HALL",
      "HARVEST_LEDGER",
      "SEEDBOT_TERMINAL",
      "STEWARD_GLADE",
      "LOREHOUSE",
      "TREASURY_GROVE",
    ]);

    MICROVERSE_LANDMARKS.forEach((landmark) => {
      expect(landmark.x).toBeGreaterThan(0);
      expect(landmark.x).toBeLessThan(1);
      expect(landmark.y).toBeGreaterThan(0);
      expect(landmark.y).toBeLessThan(1);
      expect(landmark.scale).toBeGreaterThan(0);
      expect(landmark.assetPath).toMatch(/^\/assets\/landmarks\//);
      expect(landmark.gate.story.length).toBeGreaterThan(30);
      expect(landmark.gate.unlockHint.length).toBeGreaterThan(20);
    });
  });

  it("maps MVP landmarks to app destinations", () => {
    const destinations = MICROVERSE_LANDMARKS.flatMap((landmark) => landmark.destination ?? []);
    expect(destinations).toEqual(["homestead", "explorer", "governance", "harvest", "seedbot"]);
  });

  it("keeps future districts visible as story gates instead of live destinations", () => {
    const futureDistricts = MICROVERSE_LANDMARKS.filter((landmark) => !landmark.destination);

    expect(futureDistricts.map((landmark) => landmark.id)).toEqual([
      "stewards-glade",
      "lorehouse",
      "treasury-grove",
    ]);
    expect(futureDistricts.every((landmark) => landmark.gate.status !== "OPEN")).toBe(true);
    expect(MICROVERSE_LANDMARKS.find((landmark) => landmark.id === "seedbot-terminal")?.gate.status).toBe("ACCESS_LOCKED");
  });

  it("maps every project lifecycle state to a runtime tile asset", () => {
    const lifecycleStates: ProjectLifecycleVisualState[] = [
      "EMPTY",
      "PREPARING",
      "ACTIVE",
      "MILESTONE",
      "HARVEST",
      "COMPLETED",
      "PAUSED",
    ];

    expect(Object.keys(MICROVERSE_PROJECT_TILE_ASSETS).sort()).toEqual([...lifecycleStates].sort());

    lifecycleStates.forEach((state) => {
      const asset = MICROVERSE_PROJECT_TILE_ASSETS[state];
      expect(asset.lifecycle).toBe(state);
      expect(asset.assetPath).toMatch(/^\/assets\/project-tiles\//);
      expect(asset.targetWidth).toBeGreaterThanOrEqual(280);
      expect(asset.targetWidth).toBeLessThanOrEqual(340);
    });
  });

  it("keeps the strategy-map layout spatially readable", () => {
    expect(minDistance(MICROVERSE_LANDMARKS)).toBeGreaterThan(0.18);
    expect(minDistance(MICROVERSE_PLOT_POSITIONS)).toBeGreaterThan(0.14);

    MICROVERSE_PLOT_POSITIONS.forEach((plot) => {
      const nearestLandmark = Math.min(...MICROVERSE_LANDMARKS.map((landmark) => distance(plot, landmark)));
      expect(nearestLandmark).toBeGreaterThan(0.11);
    });
  });

  it("keeps palette values as Pixi-compatible numeric colors", () => {
    Object.values(MICROVERSE_PALETTE).forEach((color) => {
      expect(Number.isInteger(color)).toBe(true);
      expect(color).toBeGreaterThanOrEqual(0x000000);
      expect(color).toBeLessThanOrEqual(0xffffff);
    });
  });

  it("registers runtime and concept assets with explicit quality gates", () => {
    expect(MICROVERSE_ASSET_SPECS.length).toBeGreaterThanOrEqual(2);

    MICROVERSE_ASSET_SPECS.forEach((asset) => {
      expect(asset.id).toMatch(/^[a-z0-9-]+$/);
      expect(asset.path).toMatch(/^\/assets\//);
      expect(asset.targetWidth).toBeGreaterThan(0);
      expect(asset.targetHeight).toBeGreaterThan(0);
      expect(asset.maxBytes).toBeGreaterThan(0);
      expect(asset.notes.length).toBeGreaterThan(12);
    });
  });
});

function minDistance(points: Array<{ x: number; y: number }>) {
  let minimum = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    points.slice(index + 1).forEach((candidate) => {
      minimum = Math.min(minimum, distance(point, candidate));
    });
  });
  return minimum;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
