import type { Project, StakingTier } from "../domain/microverse";
import { evaluateProjectEligibility } from "../domain/projectRegistry";
import type { ProjectRegistryService } from "./adapters";

export function createFixtureProjectRegistryService(projects: Project[]): ProjectRegistryService {
  return {
    async listProjects() {
      return projects;
    },
    async getProject(projectId) {
      return projects.find((project) => project.id === projectId);
    },
    async evaluateProject(projectId: string, activeTier: StakingTier) {
      const project = projects.find((candidate) => candidate.id === projectId);
      return project ? evaluateProjectEligibility(project, activeTier) : undefined;
    },
  };
}

