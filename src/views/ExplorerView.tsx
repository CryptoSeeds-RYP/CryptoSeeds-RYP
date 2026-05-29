import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Map, ShieldAlert } from "lucide-react";
import { ViewHeader } from "../components/ViewHeader";
import { participationForProject, projectParticipationBlockingReasons } from "../domain/participation";
import { canAccess } from "../domain/tiering";
import type { Project, ProjectParticipation, StakingTier } from "../types";
import { formatLabel } from "../utils/format";

export function ExplorerView({
  activeTier,
  projects,
  participations,
  projectSlotsUnlocked,
  selectedProject,
  selectedProjectId,
  onProjectSelect,
  onPrepareProject,
}: {
  activeTier: StakingTier;
  projects: Project[];
  participations: ProjectParticipation[];
  projectSlotsUnlocked: number;
  selectedProject: Project;
  selectedProjectId: string;
  onProjectSelect: (project: Project) => void;
  onPrepareProject: (project: Project) => void;
}) {
  const [acknowledgedProjectId, setAcknowledgedProjectId] = useState<string | undefined>();
  const selectedEligible = canAccess(selectedProject.requiredTier, activeTier);
  const riskAcknowledged = acknowledgedProjectId === selectedProject.id;
  const blockingReasons = projectParticipationBlockingReasons({
    project: selectedProject,
    activeTier,
    participations,
    slotCount: projectSlotsUnlocked,
  });
  const selectedParticipation = participationForProject(participations, selectedProject.id);
  const canPrepare = blockingReasons.length === 0 && riskAcknowledged;

  useEffect(() => {
    setAcknowledgedProjectId(undefined);
  }, [selectedProject.id]);

  return (
    <div className="location-view">
      <ViewHeader icon={Map} label="Explorer's Map" value="Approved project pipeline" />
      <div className="project-grid">
        {projects.map((project) => {
          const eligible = canAccess(project.requiredTier, activeTier);
          const participation = participationForProject(participations, project.id);
          return (
            <button
              key={project.id}
              className={`project-card ${selectedProjectId === project.id ? "selected" : ""}`}
              onClick={() => onProjectSelect(project)}
            >
              <div className="project-card-top">
                <span className={`risk-pill ${project.riskLevel.toLowerCase()}`}>{project.riskLevel}</span>
                <span className="status-pill">{formatLabel(project.status)}</span>
              </div>
              <strong>{project.name}</strong>
              <span>{project.category} - {project.location}</span>
              <div className="progress-track">
                <span style={{ width: `${project.progress}%` }} />
              </div>
              <div className="project-footer">
                <span>{project.requiredTier}</span>
                <span>{participation ? formatLabel(participation.status) : eligible ? "Eligible" : "Locked"}</span>
              </div>
            </button>
          );
        })}
      </div>

      <section className="project-detail-panel" aria-label="Selected project details">
        <div className="project-detail-main">
          <div className="project-card-top">
            <span className={`risk-pill ${selectedProject.riskLevel.toLowerCase()}`}>
              {selectedProject.riskLevel}
            </span>
            <span className="status-pill">{formatLabel(selectedProject.status)}</span>
          </div>
          <div>
            <span>{selectedProject.category} - {selectedProject.location}</span>
            <h2>{selectedProject.name}</h2>
            <p>{selectedProject.summary}</p>
          </div>
          <div className="project-detail-grid">
            <DetailItem label="Operator" value={selectedProject.operator.name} />
            <DetailItem label="Verification" value={formatLabel(selectedProject.operator.verificationStatus)} />
            <DetailItem label="Required Tier" value={selectedProject.requiredTier} />
            <DetailItem label="Governance" value={formatLabel(selectedProject.governance.status)} />
            <DetailItem label="Updates" value={selectedProject.updateCadence} />
          </div>
        </div>

        <div className="project-review-grid">
          <section className="review-block risk-block">
            <div className="panel-title">
              <ShieldAlert size={18} />
              <strong>Risk Review</strong>
            </div>
            <p>{selectedProject.riskDisclosure}</p>
            <p>{selectedProject.participationTerms}</p>
            <label className="acknowledgement-row">
              <input
                type="checkbox"
                checked={riskAcknowledged}
                onChange={(event) =>
                  setAcknowledgedProjectId(event.target.checked ? selectedProject.id : undefined)
                }
              />
              <span>I have reviewed the risk disclosure for this project.</span>
            </label>
            {blockingReasons.length > 0 && (
              <div className="eligibility-list">
                {blockingReasons.map((reason) => (
                  <span key={reason}>{reason}</span>
                ))}
              </div>
            )}
            {selectedParticipation && (
              <div className="eligibility-list ready-list">
                <span>{formatLabel(selectedParticipation.status)} in slot {selectedParticipation.slotIndex + 1}</span>
                <span>{selectedParticipation.acknowledgedDisclosureRef}</span>
              </div>
            )}
            <button className="primary-action" disabled={!canPrepare} onClick={() => onPrepareProject(selectedProject)}>
              <CheckCircle2 size={17} />
              Prepare Wallet Preview
            </button>
          </section>

          <section className="review-block">
            <div className="panel-title">
              <FileText size={18} />
              <strong>Documents</strong>
            </div>
            <ul>
              {selectedProject.documents.map((document) => (
                <li key={document.id}>
                  <strong>{document.title}</strong>
                  <span>{formatLabel(document.type)} - {document.version} - {formatLabel(document.status)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="review-block">
            <div className="panel-title">
              <CheckCircle2 size={18} />
              <strong>Milestones</strong>
            </div>
            <ol>
              {selectedProject.milestones.map((milestone) => (
                <li key={milestone}>{milestone}</li>
              ))}
            </ol>
          </section>

          <section className="review-block">
            <div className="panel-title">
              <Map size={18} />
              <strong>Impact Metrics</strong>
            </div>
            <ul>
              {selectedProject.impactMetrics.map((metric) => (
                <li key={metric}>{metric}</li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
