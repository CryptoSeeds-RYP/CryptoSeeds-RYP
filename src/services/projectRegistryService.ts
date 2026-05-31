import type { Project, StakingTier } from "../domain/microverse";
import { evaluateProjectEligibility } from "../domain/projectRegistry";
import type { ProjectRegistryService } from "./adapters";

export function createFixtureProjectRegistryService(projects: Project[]): ProjectRegistryService {
  return {
    async listProjects() {
      return projects.map(cloneProject);
    },
    async getProject(projectId) {
      const project = projects.find((candidate) => candidate.id === projectId);
      return project ? cloneProject(project) : undefined;
    },
    async evaluateProject(projectId: string, activeTier: StakingTier) {
      const project = projects.find((candidate) => candidate.id === projectId);
      return project ? evaluateProjectEligibility(project, activeTier) : undefined;
    },
  };
}

function cloneProject(project: Project): Project {
  return {
    ...project,
    disclosure: { ...project.disclosure, conflictNotes: [...project.disclosure.conflictNotes] },
    documents: project.documents.map((document) => ({ ...document })),
    governance: { ...project.governance },
    impactMetrics: [...project.impactMetrics],
    milestones: [...project.milestones],
    operator: { ...project.operator },
    receivingAccount: { ...project.receivingAccount },
  };
}
