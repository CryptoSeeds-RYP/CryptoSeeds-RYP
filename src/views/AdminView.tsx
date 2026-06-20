import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { AlertTriangle, Database, FileCog, Landmark, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { appConfig } from "../config/env";
import { adminActionPreviews, buildAdminAccess, buildAdminProtocolPreviews } from "../domain/admin";
import { basisPointsToPercent, feeRoutePolicies } from "../domain/feeRouter";
import {
  buildRewardAccountInspectionPreview,
  readRewardAccountInspection,
  type RewardAccountInspection,
} from "../solana/rewardAccountInspection";
import { formatLabel } from "../utils/format";
import { ViewHeader } from "../components/ViewHeader";

export function AdminView({
  walletAddress,
  demoMode,
}: {
  walletAddress?: string;
  demoMode: boolean;
}) {
  const { connection } = useConnection();
  const access = buildAdminAccess({ config: appConfig, walletAddress, demoMode });
  const protocolPreviews = buildAdminProtocolPreviews({
    authorityAddress: access.configuredAdminAddress,
    independentTreasuryAddress: appConfig.independentTreasuryAddress,
    rypMintAddress: appConfig.rypMintAddress,
    rypDecimals: appConfig.rypDecimals,
  });
  const [rewardInspection, setRewardInspection] = useState<RewardAccountInspection>(() =>
    buildRewardAccountInspectionPreview({ epochId: appConfig.rewardInspectionEpochId }),
  );

  useEffect(() => {
    let cancelled = false;
    const preview = buildRewardAccountInspectionPreview({ epochId: appConfig.rewardInspectionEpochId });
    setRewardInspection(preview);

    if (appConfig.protocolDeployment === "placeholder") return undefined;

    readRewardAccountInspection({ connection, epochId: appConfig.rewardInspectionEpochId })
      .then((inspection) => {
        if (!cancelled) setRewardInspection(inspection);
      })
      .catch((error) => {
        if (cancelled) return;
        setRewardInspection({
          ...preview,
          warnings: [
            ...preview.warnings,
            `Reward account RPC read failed: ${error instanceof Error ? error.message : "unknown error"}.`,
          ],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connection]);

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

      <section className="governance-section admin-protocol-preview">
        <div className="view-header">
          <div>
            <ShieldCheck size={20} />
            <strong>Protocol Transaction Previews</strong>
          </div>
          <span>Preview-only / no broadcast</span>
        </div>
        <div className="authority-grid ops-grid">
          {protocolPreviews.map((preview) => {
            const instruction = preview.plan?.instructions[0];
            return (
              <article className={`authority-card admin-protocol-card ${preview.status.toLowerCase()}`} key={preview.id}>
                <div className="authority-card-top">
                  <FileCog size={17} />
                  <span>{formatLabel(preview.status)}</span>
                </div>
                <strong>{preview.label}</strong>
                <p>{preview.description}</p>
                {preview.plan && instruction ? (
                  <div className="admin-transaction-summary">
                    <span>{formatLabel(preview.plan.action)}</span>
                    <code>{instruction.instructionName}</code>
                    <small>{shortAddress(preview.plan.feePayer)} / {instruction.accounts.length} accounts</small>
                    <small>{shortData(instruction.dataHex)}</small>
                  </div>
                ) : (
                  <div className="admin-blocker-list compact">
                    {preview.blockers.map((blocker) => (
                      <span key={blocker}><AlertTriangle size={14} /> {blocker}</span>
                    ))}
                  </div>
                )}
                <em>{preview.executionRule}</em>
              </article>
            );
          })}
        </div>
      </section>

      <section className="governance-section">
        <div className="view-header">
          <div>
            <Landmark size={20} />
            <strong>Fee Route Drafts</strong>
          </div>
          <span>Transfer fee set to 1%</span>
        </div>
        <div className="authority-grid ops-grid">
          {feeRoutePolicies.map((policy) => (
            <article className={`authority-card fee-route-card ${policy.splitStatus.toLowerCase()}`} key={policy.id}>
              <div className="authority-card-top">
                <Landmark size={17} />
                <span>{basisPointsToPercent(policy.baseFeeBps)}</span>
              </div>
              <strong>{policy.label}</strong>
              <p>{policy.splitBuckets.map(formatLabel).join(" / ")}</p>
              <em>{formatLabel(policy.enforcementLayer)} / {formatLabel(policy.splitStatus)}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="governance-section reward-inspector">
        <div className="view-header">
          <div>
            <Database size={20} />
            <strong>Reward Account Inspector</strong>
          </div>
          <span>{formatLabel(rewardInspection.executionMode)} / no reward execution</span>
        </div>
        <div className="policy-strip reward-policy-strip">
          <div>
            <span>Program</span>
            <strong>{shortAddress(rewardInspection.programId)}</strong>
          </div>
          <div>
            <span>Reward Config PDA</span>
            <strong>{shortAddress(rewardInspection.rewardConfigAddress)}</strong>
          </div>
          <div>
            <span>Epoch Preview</span>
            <strong>#{rewardInspection.epochId} / {shortAddress(rewardInspection.epochPreviewAddress)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{formatLabel(rewardInspection.rewardConfigStatus)}</strong>
          </div>
        </div>
        <div className="policy-note-list">
          {rewardInspection.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
        <div className="authority-grid ops-grid reward-account-grid">
          <article className={`authority-card reward-account-card ${rewardInspection.rewardConfigStatus.toLowerCase()}`}>
            <div className="authority-card-top">
              <Database size={17} />
              <span>{formatLabel(rewardInspection.rewardConfigStatus)}</span>
            </div>
            <strong>Reward Config</strong>
            <p>{rewardInspection.rewardConfigMessage}</p>
            <em>
              {rewardInspection.rewardConfig
                ? `${rewardInspection.rewardConfig.holderSplitBps}/${rewardInspection.rewardConfig.stakerSplitBps}/${rewardInspection.rewardConfig.treasurySplitBps} bps`
                : "Holder / staker / treasury split pending"}
            </em>
            <code>{rewardInspection.rewardConfigAddress}</code>
          </article>
          <article className={`authority-card reward-account-card ${rewardInspection.epochStatus.toLowerCase()}`}>
            <div className="authority-card-top">
              <FileCog size={17} />
              <span>{formatLabel(rewardInspection.epochStatus)}</span>
            </div>
            <strong>Draft Epoch</strong>
            <p>{rewardInspection.epochMessage}</p>
            <em>
              {rewardInspection.epoch
                ? `${formatLabel(rewardInspection.epoch.status)} / execution blocked: ${rewardInspection.epoch.executionBlocked}`
                : "Derived preview; no payout route exposed"}
            </em>
            <code>{rewardInspection.epochPreviewAddress}</code>
          </article>
          {rewardInspection.vaults.map((vault) => (
            <article className={`authority-card reward-account-card ${vault.status.toLowerCase()}`} key={vault.role}>
              <div className="authority-card-top">
                <WalletCards size={17} />
                <span>{formatLabel(vault.status)}</span>
              </div>
              <strong>{vault.label}</strong>
              <p>{vault.message}</p>
              <em>
                {vault.decoded
                  ? `${formatLabel(vault.decoded.verificationStatus)} / ${formatLabel(vault.decoded.custodyModel)}`
                  : "Verification state not loaded"}
              </em>
              <code>{vault.address}</code>
            </article>
          ))}
        </div>
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

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function shortData(dataHex: string) {
  return `${dataHex.slice(0, 18)}...${dataHex.slice(-10)} (${dataHex.length / 2} bytes)`;
}
