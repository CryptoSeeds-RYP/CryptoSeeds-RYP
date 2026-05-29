import { describe, expect, it } from "vitest";
import { projectParticipations, projects } from "../fixtures/protocolFixtures";
import { activeParticipations, buildProjectSlots } from "./participation";

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
});

