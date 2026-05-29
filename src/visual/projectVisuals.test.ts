import { describe, expect, it } from "vitest";
import { projects, projectParticipations } from "../fixtures/protocolFixtures";
import { lifecycleForProjectPlot, visualKindForProject } from "./projectVisuals";

describe("project visuals", () => {
  it("maps project categories to visual kinds", () => {
    expect(visualKindForProject(projects.find((project) => project.id === "chestnut-spain"))).toBe("GROVE");
    expect(visualKindForProject(projects.find((project) => project.id === "hemp-greenhouse"))).toBe(
      "RESEARCH_GREENHOUSE",
    );
    expect(visualKindForProject(projects.find((project) => project.id === "solar-water-node"))).toBe("WATER_NODE");
    expect(visualKindForProject(projects.find((project) => project.id === "steward-glade"))).toBe(
      "DONATION_GLADE",
    );
    expect(visualKindForProject()).toBe("OPEN_FIELD");
  });

  it("derives lifecycle state from project and participation status", () => {
    const chestnut = projects.find((project) => project.id === "chestnut-spain")!;
    const chestnutParticipation = projectParticipations.find((item) => item.projectId === "chestnut-spain")!;

    expect(lifecycleForProjectPlot({ project: chestnut, participation: chestnutParticipation })).toBe("MILESTONE");
    expect(
      lifecycleForProjectPlot({
        project: { ...chestnut, status: "PAUSED" },
        participation: chestnutParticipation,
      }),
    ).toBe("PAUSED");
    expect(
      lifecycleForProjectPlot({
        project: chestnut,
        participation: { ...chestnutParticipation, status: "HARVEST_AVAILABLE" },
      }),
    ).toBe("HARVEST");
    expect(
      lifecycleForProjectPlot({
        project: chestnut,
        participation: { ...chestnutParticipation, status: "PREPARED" },
      }),
    ).toBe("PREPARING");
    expect(lifecycleForProjectPlot({ project: chestnut })).toBe("EMPTY");
  });
});
