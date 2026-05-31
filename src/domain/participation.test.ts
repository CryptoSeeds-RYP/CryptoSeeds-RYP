import { describe, expect, it } from "vitest";
import { projectParticipations, projects } from "../fixtures/protocolFixtures";
import {
  activeParticipations,
  buildProjectSlots,
  createPreparedParticipation,
  hasProjectParticipation,
  nextAvailableProjectSlot,
  participationForProject,
  projectParticipationBlockingReasons,
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
      activeTier: "SEED",
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
        activeTier: "FRUIT",
        walletAddress: "demo-wallet",
        participations: projectParticipations,
        slotCount: 4,
      }),
    ).toBeUndefined();
  });

  it("refuses to prepare participation for empty wallets or ineligible projects", () => {
    const glade = projects.find((project) => project.id === "steward-glade")!;
    const hemp = projects.find((project) => project.id === "hemp-greenhouse")!;

    expect(
      createPreparedParticipation({
        project: glade,
        activeTier: "SEED",
        walletAddress: "   ",
        participations: [],
        slotCount: 4,
      }),
    ).toBeUndefined();
    expect(
      createPreparedParticipation({
        project: hemp,
        activeTier: "FRUIT",
        walletAddress: "demo-wallet",
        participations: [],
        slotCount: 4,
      }),
    ).toBeUndefined();
  });

  it("returns active participation by project id", () => {
    expect(participationForProject(projectParticipations, "solar-water-node")?.status).toBe("ACTIVE");
    expect(participationForProject(projectParticipations, "missing")).toBeUndefined();
  });

  it("explains participation blocking reasons", () => {
    const chestnut = projects.find((project) => project.id === "chestnut-spain")!;
    const hemp = projects.find((project) => project.id === "hemp-greenhouse")!;

    expect(
      projectParticipationBlockingReasons({
        project: chestnut,
        activeTier: "FRUIT",
        participations: projectParticipations,
        slotCount: 3,
      }),
    ).toContain("Project is already in your MicroVerse");

    expect(
      projectParticipationBlockingReasons({
        project: hemp,
        activeTier: "SEED",
        participations: projectParticipations,
        slotCount: 2,
      }),
    ).toEqual(
      expect.arrayContaining([
        "Requires SAPLING tier",
        "Participation is not open",
        "Governance approval is not complete",
        "No open project slot",
      ]),
    );
  });
});
