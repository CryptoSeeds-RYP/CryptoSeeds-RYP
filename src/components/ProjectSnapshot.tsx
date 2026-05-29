import { Landmark } from "lucide-react";
import type { Project, StakingTier } from "../types";
import { canAccess } from "../domain/tiering";
import { formatLabel } from "../utils/format";
import { StateLine } from "./StateLine";

export function ProjectSnapshot({
  project,
  activeTier,
  eligibleProjects,
}: {
  project: Project;
  activeTier: StakingTier;
  eligibleProjects: number;
}) {
  return (
    <section className="side-panel">
      <div className="panel-title">
        <Landmark size={18} />
        <strong>Project Snapshot</strong>
      </div>
      <strong className="intent-title">{project.name}</strong>
      <div className="state-lines">
        <StateLine label="Risk" value={project.riskLevel} />
        <StateLine label="Status" value={formatLabel(project.status)} />
        <StateLine label="Required" value={project.requiredTier} />
        <StateLine label="Eligible" value={canAccess(project.requiredTier, activeTier) ? "Yes" : "No"} />
        <StateLine label="Open slots" value={`${eligibleProjects}`} />
      </div>
    </section>
  );
}

