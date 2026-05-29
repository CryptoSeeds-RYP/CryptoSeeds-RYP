import { describe, expect, it } from "vitest";
import { projectParticipations, projects } from "../fixtures/protocolFixtures";
import { buildProjectMilestoneViews } from "./projectLifecycle";

describe("project lifecycle", () => {
  it("marks completed, current, and upcoming milestones", () => {
    const project = projects.find((item) => item.id === "solar-water-node")!;
    const participation = projectParticipations.find((item) => item.projectId === "solar-water-node")!;

    expect(buildProjectMilestoneViews({ project, participation }).map((milestone) => milestone.state)).toEqual([
      "COMPLETED",
      "COMPLETED",
      "CURRENT",
      "UPCOMING",
    ]);
  });

  it("treats all milestones as upcoming before participation", () => {
    const project = projects.find((item) => item.id === "hemp-greenhouse")!;

    expect(new Set(buildProjectMilestoneViews({ project }).map((milestone) => milestone.state))).toEqual(
      new Set(["UPCOMING"]),
    );
  });
});
