import { describe, expect, it } from "vitest";
import { projectParticipations, projects } from "../fixtures/protocolFixtures";
import {
  activeParticipations,
  buildProjectSlots,
  createPreparedParticipation,
  hasProjectParticipation,
  nextAvailableProjectSlot,
} from "./participation";

describe("project participation", () => {
  it("builds project slots with active participation metadata", () => {
    const slots = buildProjectSlots({
      slotCount: 3,
      participations: projectParticipations,
      projects,
    });

    expect(slots).toHaveLength(3);
    expect(slots[0].project?.id).toBe("chestnut-spain");
    expect(slots[1].project?.id).toBe("solar-water-node");
    expect(slots[2].project).toBeUndefined();
  });

  it("filters completed participations out of active state", () => {
    const active = activeParticipations([
      ...projectParticipations,
      {
        ...projectParticipations[0],
        id: "completed",
        status: "COMPLETED",
        slotIndex: 2,
      },
    ]);

    expect(active.map((participation) => participation.id)).not.toContain("completed");
  });

  it("finds the next available project slot", () => {
    expect(nextAvailableProjectSlot(projectParticipations, 3)).toBe(2);
    expect(nextAvailableProjectSlot(projectParticipations, 2)).toBeUndefined();
  });

  it("creates prepared participation with disclosure provenance", () => {
    const glade = projects.find((project) => project.id === "steward-glade")!;
    const participation = createPreparedParticipation({
      project: glade,
      walletAddress: "demo-wallet",
      participations: projectParticipations,
      slotCount: 4,
      now: "2026-05-29T15:00:00.000Z",
    });

    expect(participation).toMatchObject({
      projectId: "steward-glade",
      status: "PREPARED",
      slotIndex: 2,
      acknowledgedDisclosureRef: "project:steward-glade:document:glade-risk:v1.0",
    });
  });

  it("prevents duplicate active project participation", () => {
    const chestnut = projects.find((project) => project.id === "chestnut-spain")!;

    expect(hasProjectParticipation(projectParticipations, "chestnut-spain")).toBe(true);
    expect(
      createPreparedParticipation({
        project: chestnut,
        walletAddress: "demo-wallet",
        participations: projectParticipations,
        slotCount: 4,
      }),
    ).toBeUndefined();
  });
});
