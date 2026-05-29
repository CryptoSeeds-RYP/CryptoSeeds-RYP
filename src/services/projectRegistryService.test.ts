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

  it("evaluates project eligibility through the adapter", async () => {
    const service = createFixtureProjectRegistryService(projects);

    await expect(service.evaluateProject("solar-water-node", "SPROUT")).resolves.toMatchObject({
      eligible: true,
    });
    await expect(service.evaluateProject("missing-project", "FRUIT")).resolves.toBeUndefined();
  });
});

