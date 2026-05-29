import { describe, expect, it } from "vitest";
import { projectParticipations, projects } from "../fixtures/protocolFixtures";
import { buildMicroVerseSceneState } from "./microverseSceneState";

describe("microverse scene state", () => {
  it("maps unlocked project slots to plot markers", () => {
    const scene = buildMicroVerseSceneState({
      tier: "SPROUT",
      walletConnected: true,
      weather: "CLEAR",
      projectSlotsUnlocked: 3,
      projects,
      participations: projectParticipations,
    });

    expect(scene.plots).toHaveLength(3);
    expect(scene.plots[0]).toMatchObject({
      id: "chestnut-spain",
      label: "Iberian Chestnut Grove",
      status: "MILESTONE_REACHED",
      progress: 34,
    });
    expect(scene.plots[1]).toMatchObject({
      id: "solar-water-node",
      label: "Solar Water Node",
      status: "ACTIVE",
      progress: 62,
    });
    expect(scene.plots[2]).toMatchObject({
      id: "empty-2",
      label: "Open field",
      status: "EMPTY",
      progress: 0,
    });
  });

  it("preserves environment state for visual rendering", () => {
    const scene = buildMicroVerseSceneState({
      tier: "NONE",
      walletConnected: false,
      weather: "RAIN",
      projectSlotsUnlocked: 1,
      projects,
      participations: [],
    });

    expect(scene).toMatchObject({
      tier: "NONE",
      walletConnected: false,
      weather: "RAIN",
    });
  });
});
