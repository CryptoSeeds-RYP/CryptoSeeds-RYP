import { describe, expect, it } from "vitest";
import { projects } from "../fixtures/protocolFixtures";
import { createFixtureProjectRegistryService } from "./projectRegistryService";

describe("project registry service", () => {
  it("lists fixture projects through the adapter boundary", async () => {
    const service = createFixtureProjectRegistryService(projects);

    await expect(service.listProjects()).resolves.toHaveLength(projects.length);
  });

  it("loads projects by id", async () => {
    const service = createFixtureProjectRegistryService(projects);

    await expect(service.getProject("solar-water-node")).resolves.toMatchObject({
      name: "Solar Water Node",
    });
    await expect(service.getProject("missing-project")).resolves.toBeUndefined();
  });

  it("returns defensive copies instead of mutable fixture references", async () => {
    const service = createFixtureProjectRegistryService(projects);
    const listed = await service.listProjects();
    const loaded = await service.getProject("solar-water-node");

    listed[0].documents[0].status = "DRAFT";
    if (loaded) loaded.milestones.push("mutated milestone");

    expect(projects[0].documents[0].status).toBe("APPROVED");
    expect(projects.find((project) => project.id === "solar-water-node")?.milestones).not.toContain("mutated milestone");
  });

  it("evaluates project eligibility through the adapter", async () => {
    const service = createFixtureProjectRegistryService(projects);

    await expect(service.evaluateProject("solar-water-node", "SPROUT")).resolves.toMatchObject({
      eligible: true,
    });
    await expect(service.evaluateProject("missing-project", "FRUIT")).resolves.toBeUndefined();
  });
});
