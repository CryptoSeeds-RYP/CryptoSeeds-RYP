import { Landmark } from "lucide-react";
import type { Project, ProjectParticipation, StakingTier } from "../types";
import { canAccess } from "../domain/tiering";
import { formatLabel } from "../utils/format";
import { StateLine } from "./StateLine";

export function ProjectSnapshot({
  project,
  participation,
  activeTier,
  eligibleProjects,
}: {
  project: Project;
  participation?: ProjectParticipation;
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
        <StateLine label="Participation" value={participation ? formatLabel(participation.status) : "None"} />
        {participation && <StateLine label="Slot" value={`${participation.slotIndex + 1}`} />}
      </div>
      {participation && (
        <p className="snapshot-note">
          Disclosure: {participation.acknowledgedDisclosureRef}
        </p>
      )}
    </section>
  );
}
