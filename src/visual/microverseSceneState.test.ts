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
      projectId: "chestnut-spain",
      slotIndex: 0,
      label: "Iberian Chestnut Grove",
      category: "Regenerative agriculture",
      lifecycle: "MILESTONE",
      visualKind: "GROVE",
      riskLevel: "MEDIUM",
      projectStatus: "OPEN",
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
      slotIndex: 2,
      label: "Open field",
      category: "Unassigned",
      lifecycle: "EMPTY",
      visualKind: "OPEN_FIELD",
      status: "EMPTY",
      progress: 0,
    });
    expect(scene.plots[2].projectId).toBeUndefined();
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
