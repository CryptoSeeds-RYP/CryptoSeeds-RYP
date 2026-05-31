import { AlertTriangle, FileCog, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { appConfig } from "../config/env";
import { adminActionPreviews, buildAdminAccess } from "../domain/admin";
import { formatLabel } from "../utils/format";
import { ViewHeader } from "../components/ViewHeader";

export function AdminView({
  walletAddress,
  demoMode,
}: {
  walletAddress?: string;
  demoMode: boolean;
}) {
  const access = buildAdminAccess({ config: appConfig, walletAddress, demoMode });

  return (
    <div className="location-view admin-view">
      <ViewHeader icon={FileCog} label="Admin Dashboard" value={formatLabel(access.status)} />
      <section className={`governance-section admin-access-panel ${access.canOpenDashboard ? "unlocked" : "locked"}`}>
        <div className="view-header">
          <div>
            {access.canOpenDashboard ? <ShieldCheck size={20} /> : <LockKeyhole size={20} />}
            <strong>{access.canOpenDashboard ? "Testing Authority Unlocked" : "Admin Locked"}</strong>
          </div>
          <span>Proposal-only control surface</span>
        </div>
        <div className="policy-strip admin-policy-strip">
          <div>
            <span>Configured authority</span>
            <strong>{access.configuredAdminAddress ?? "Not configured"}</strong>
          </div>
          <div>
            <span>Connected wallet</span>
            <strong>{access.walletAddress ?? "No wallet connected"}</strong>
          </div>
          <div>
            <span>Execution</span>
            <strong>{access.canExecuteActions ? "Enabled" : "Blocked in MVP"}</strong>
          </div>
        </div>
        {(access.blockers.length > 0 || access.warnings.length > 0) && (
          <div className="admin-blocker-list">
            {access.blockers.map((blocker) => (
              <span key={blocker}><AlertTriangle size={14} /> {blocker}</span>
            ))}
            {access.warnings.map((warning) => (
              <span className="warning" key={warning}><AlertTriangle size={14} /> {warning}</span>
            ))}
          </div>
        )}
      </section>

      <section className="governance-section">
        <div className="view-header">
          <div>
            <WalletCards size={20} />
            <strong>Admin Action Drafts</strong>
          </div>
          <span>{access.canDraftActions ? "Drafting enabled" : "Connect configured admin"}</span>
        </div>
        <div className="authority-grid ops-grid">
          {adminActionPreviews.map((action) => (
            <article className={`authority-card admin-action-card ${action.status.toLowerCase()}`} key={action.id}>
              <div className="authority-card-top">
                <FileCog size={17} />
                <span>{formatLabel(action.status)}</span>
              </div>
              <strong>{action.label}</strong>
              <p>{action.description}</p>
              <em>{formatLabel(action.category)} / {action.executionRule}</em>
              <button disabled={!access.canDraftActions}>
                {access.canDraftActions ? "Prepare Draft" : "Locked"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

