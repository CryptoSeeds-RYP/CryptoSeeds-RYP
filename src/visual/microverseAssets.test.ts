import { describe, expect, it } from "vitest";
import {
  MICROVERSE_ASSETS,
  MICROVERSE_ASSET_SPECS,
  MICROVERSE_LANDMARKS,
  MICROVERSE_PALETTE,
} from "./microverseAssets";

describe("microverse visual asset registry", () => {
  it("keeps core asset paths rooted in the public assets directory", () => {
    expect(MICROVERSE_ASSETS.conceptPlate).toMatch(/^\/assets\//);
    expect(MICROVERSE_ASSETS.fallbackTerrain).toMatch(/^\/assets\//);
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
    });
  });

  it("maps MVP landmarks to app destinations", () => {
    const destinations = MICROVERSE_LANDMARKS.flatMap((landmark) => landmark.destination ?? []);
    expect(destinations).toEqual(["homestead", "explorer", "governance", "harvest", "seedbot"]);
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
