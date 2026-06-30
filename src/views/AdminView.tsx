import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { AlertTriangle, Database, FileCog, Landmark, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { appConfig } from "../config/env";
import { adminActionPreviews, buildAdminAccess, buildAdminProtocolPreviews } from "../domain/admin";
import { basisPointsToPercent, feeRoutePolicies } from "../domain/feeRouter";
import {
  buildProtocolConfigInspectionPreview,
  readProtocolConfigInspection,
  type ProtocolConfigInspection,
} from "../solana/protocolConfigInspection";
import {
  buildRewardAccountInspectionPreview,
  readRewardAccountInspection,
  type RewardAccountInspection,
} from "../solana/rewardAccountInspection";
import {
  buildGovernanceStateInspectionPreview,
  buildProjectStateInspectionPreview,
  buildStakePositionInspectionPreview,
  readGovernanceStateInspection,
  readProjectStateInspection,
  readStakePositionInspection,
  type GovernanceStateInspection,
  type ProjectStateInspection,
  type StakePositionInspection,
} from "../solana/protocolStateInspection";
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
  const stateInspectionWallet = normalizeOptionalPublicKey(walletAddress ?? access.configuredAdminAddress);
  const [protocolInspection, setProtocolInspection] = useState<ProtocolConfigInspection>(() =>
    buildProtocolConfigInspectionPreview(),
  );
  const [stakeInspection, setStakeInspection] = useState<StakePositionInspection | undefined>(() =>
    stateInspectionWallet ? buildStakePositionInspectionPreview({ ownerAddress: stateInspectionWallet }) : undefined,
  );
  const [governanceInspection, setGovernanceInspection] = useState<GovernanceStateInspection>(() =>
    buildGovernanceStateInspectionPreview({
      proposalId: appConfig.governanceInspectionProposalId,
      walletAddress: stateInspectionWallet,
    }),
  );
  const [projectInspection, setProjectInspection] = useState<ProjectStateInspection>(() =>
    buildProjectStateInspectionPreview({
      projectId: appConfig.projectInspectionId,
      walletAddress: stateInspectionWallet,
    }),
  );
  const [rewardInspection, setRewardInspection] = useState<RewardAccountInspection>(() =>
    buildRewardAccountInspectionPreview({ epochId: appConfig.rewardInspectionEpochId }),
  );

  useEffect(() => {
    let cancelled = false;
    const preview = buildProtocolConfigInspectionPreview();
    setProtocolInspection(preview);

    if (appConfig.protocolDeployment === "placeholder") return undefined;

    readProtocolConfigInspection({ connection })
      .then((inspection) => {
        if (!cancelled) setProtocolInspection(inspection);
      })
      .catch((error) => {
        if (cancelled) return;
        setProtocolInspection({
          ...preview,
          warnings: [
            ...preview.warnings,
            `Protocol config RPC read failed: ${error instanceof Error ? error.message : "unknown error"}.`,
          ],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connection]);

  useEffect(() => {
    if (!stateInspectionWallet) {
      setStakeInspection(undefined);
      return undefined;
    }

    let cancelled = false;
    const preview = buildStakePositionInspectionPreview({ ownerAddress: stateInspectionWallet });
    setStakeInspection(preview);

    if (appConfig.protocolDeployment === "placeholder") return undefined;

    readStakePositionInspection({ connection, ownerAddress: stateInspectionWallet })
      .then((inspection) => {
        if (!cancelled) setStakeInspection(inspection);
      })
      .catch((error) => {
        if (cancelled) return;
        setStakeInspection({
          ...preview,
          warnings: [
            ...preview.warnings,
            `Stake position RPC read failed: ${error instanceof Error ? error.message : "unknown error"}.`,
          ],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connection, stateInspectionWallet]);

  useEffect(() => {
    let cancelled = false;
    const preview = buildGovernanceStateInspectionPreview({
      proposalId: appConfig.governanceInspectionProposalId,
      walletAddress: stateInspectionWallet,
    });
    setGovernanceInspection(preview);

    if (appConfig.protocolDeployment === "placeholder") return undefined;

    readGovernanceStateInspection({
      connection,
      proposalId: appConfig.governanceInspectionProposalId,
      walletAddress: stateInspectionWallet,
    })
      .then((inspection) => {
        if (!cancelled) setGovernanceInspection(inspection);
      })
      .catch((error) => {
        if (cancelled) return;
        setGovernanceInspection({
          ...preview,
          warnings: [
            ...preview.warnings,
            `Governance state RPC read failed: ${error instanceof Error ? error.message : "unknown error"}.`,
          ],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connection, stateInspectionWallet]);

  useEffect(() => {
    let cancelled = false;
    const preview = buildProjectStateInspectionPreview({
      projectId: appConfig.projectInspectionId,
      walletAddress: stateInspectionWallet,
    });
    setProjectInspection(preview);

    if (appConfig.protocolDeployment === "placeholder") return undefined;

    readProjectStateInspection({
      connection,
      projectId: appConfig.projectInspectionId,
      walletAddress: stateInspectionWallet,
    })
      .then((inspection) => {
        if (!cancelled) setProjectInspection(inspection);
      })
      .catch((error) => {
        if (cancelled) return;
        setProjectInspection({
          ...preview,
          warnings: [
            ...preview.warnings,
            `Project state RPC read failed: ${error instanceof Error ? error.message : "unknown error"}.`,
          ],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connection, stateInspectionWallet]);

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

      <section className="governance-section protocol-config-inspector">
        <div className="view-header">
          <div>
            <Database size={20} />
            <strong>Protocol Config Inspector</strong>
          </div>
          <span>{formatLabel(protocolInspection.executionMode)} / no config execution</span>
        </div>
        <div className="policy-strip reward-policy-strip">
          <div>
            <span>Program</span>
            <strong>{shortAddress(protocolInspection.programId)}</strong>
          </div>
          <div>
            <span>Config PDA</span>
            <strong>{shortAddress(protocolInspection.configAddress)}</strong>
          </div>
          <div>
            <span>RYP Vault</span>
            <strong>{shortAddress(protocolInspection.rypVaultAddress)}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{formatLabel(protocolInspection.status)}</strong>
          </div>
        </div>
        {(protocolInspection.blockers.length > 0 || protocolInspection.warnings.length > 0) && (
          <div className="policy-note-list">
            {protocolInspection.blockers.map((blocker) => (
              <span className="critical" key={blocker}>{blocker}</span>
            ))}
            {protocolInspection.warnings.map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        )}
        <div className="authority-grid ops-grid reward-account-grid">
          <article className={`authority-card reward-account-card ${protocolInspection.status.toLowerCase()}`}>
            <div className="authority-card-top">
              <Database size={17} />
              <span>{formatLabel(protocolInspection.status)}</span>
            </div>
            <strong>Protocol Config</strong>
            <p>{protocolInspection.message}</p>
            <em>
              {protocolInspection.decoded
                ? `${basisPointsToPercent(protocolInspection.decoded.baseFeeBps)} base fee / paused: ${protocolInspection.decoded.paused} / modules: ${formatModulePauses(protocolInspection.decoded.activeModulePauses)}`
                : "Base fee, pause state, and stake totals pending"}
            </em>
            <code>{protocolInspection.configAddress}</code>
          </article>
          <article className={`authority-card reward-account-card ${protocolInspection.status.toLowerCase()}`}>
            <div className="authority-card-top">
              <Landmark size={17} />
              <span>Tier Policy</span>
            </div>
            <strong>Staking Thresholds</strong>
            <p>
              {protocolInspection.decoded
                ? protocolInspection.decoded.tierThresholds.map(formatRypBaseUnits).join(" / ")
                : "Seed / Sprout / Sapling / Tree / Fruit thresholds pending"}
            </p>
            <em>
              {protocolInspection.decoded
                ? `${protocolInspection.decoded.tierFeeReductionBps.join(" / ")} bps reductions`
                : "Tier fee reductions pending"}
            </em>
            <code>{protocolInspection.rypMintAddress}</code>
          </article>
          <article className={`authority-card reward-account-card ${protocolInspection.status.toLowerCase()}`}>
            <div className="authority-card-top">
              <ShieldCheck size={17} />
              <span>Authorities</span>
            </div>
            <strong>Control Keys</strong>
            <p>
              {protocolInspection.decoded
                ? `Protocol ${shortAddress(protocolInspection.decoded.authority)} / Projects ${shortAddress(protocolInspection.decoded.projectAuthority)}`
                : "Protocol and project authorities pending"}
            </p>
            <em>
              {protocolInspection.decoded
                ? `Total staked ${formatRypBaseUnits(protocolInspection.decoded.totalStaked)}`
                : "Total staked pending"}
            </em>
            <code>{protocolInspection.rypVaultAddress}</code>
          </article>
        </div>
      </section>

      <section className="governance-section protocol-state-inspector">
        <div className="view-header">
          <div>
            <Database size={20} />
            <strong>Protocol State Inspectors</strong>
          </div>
          <span>Read-only account visibility</span>
        </div>
        <div className="policy-strip reward-policy-strip">
          <div>
            <span>Wallet Target</span>
            <strong>{stateInspectionWallet ? shortAddress(stateInspectionWallet) : "No wallet"}</strong>
          </div>
          <div>
            <span>Proposal ID</span>
            <strong>#{governanceInspection.proposalId}</strong>
          </div>
          <div>
            <span>Project ID</span>
            <strong>#{projectInspection.projectId}</strong>
          </div>
          <div>
            <span>Execution</span>
            <strong>Read only</strong>
          </div>
        </div>
        {stateInspectionMessages(stakeInspection, governanceInspection, projectInspection).length > 0 && (
          <div className="policy-note-list">
            {stateInspectionMessages(stakeInspection, governanceInspection, projectInspection).map((message) => (
              <span className={message.kind === "blocker" ? "critical" : undefined} key={message.text}>
                {message.text}
              </span>
            ))}
          </div>
        )}
        <div className="authority-grid ops-grid reward-account-grid">
          <article className={`authority-card reward-account-card ${stakeInspection?.status.toLowerCase() ?? "preview_only"}`}>
            <div className="authority-card-top">
              <WalletCards size={17} />
              <span>{formatLabel(stakeInspection?.status ?? "PREVIEW_ONLY")}</span>
            </div>
            <strong>Stake Position</strong>
            <p>{stakeInspection?.message ?? "Connect a wallet or configure admin authority to derive a stake position PDA."}</p>
            <em>
              {stakeInspection?.decoded
                ? `${formatRypBaseUnits(stakeInspection.decoded.stakedAmount)} / ${formatLabel(stakeInspection.decoded.tier)}`
                : "Stake amount and tier pending"}
            </em>
            <code>{stakeInspection?.positionAddress ?? "Wallet target required"}</code>
          </article>
          <article className={`authority-card reward-account-card ${governanceInspection.proposalStatus.toLowerCase()}`}>
            <div className="authority-card-top">
              <Landmark size={17} />
              <span>{formatLabel(governanceInspection.proposalStatus)}</span>
            </div>
            <strong>Governance Proposal</strong>
            <p>{governanceInspection.proposalMessage}</p>
            <em>
              {governanceInspection.proposal
                ? `${formatLabel(governanceInspection.proposal.status)} / ${governanceInspection.proposal.yesVotes}-${governanceInspection.proposal.noVotes}`
                : "Proposal state pending"}
            </em>
            <code>{governanceInspection.proposalAddress}</code>
          </article>
          <article className={`authority-card reward-account-card ${governanceInspection.voteRecordStatus.toLowerCase()}`}>
            <div className="authority-card-top">
              <ShieldCheck size={17} />
              <span>{formatLabel(governanceInspection.voteRecordStatus)}</span>
            </div>
            <strong>Vote Record</strong>
            <p>{governanceInspection.voteRecordMessage}</p>
            <em>
              {governanceInspection.voteRecord
                ? `${governanceInspection.voteRecord.approve ? "Approved" : "Rejected"} / ${governanceInspection.voteRecord.votedAt}`
                : "Wallet vote state pending"}
            </em>
            <code>{governanceInspection.voteRecordAddress ?? "Wallet target required"}</code>
          </article>
          <article className={`authority-card reward-account-card ${projectInspection.projectStatus.toLowerCase()}`}>
            <div className="authority-card-top">
              <FileCog size={17} />
              <span>{formatLabel(projectInspection.projectStatus)}</span>
            </div>
            <strong>Project Record</strong>
            <p>{projectInspection.projectMessage}</p>
            <em>
              {projectInspection.project
                ? `${formatLabel(projectInspection.project.status)} / ${formatLabel(projectInspection.project.fundingModel)}`
                : "Project status and funding model pending"}
            </em>
            <code>{projectInspection.projectAddress}</code>
          </article>
          <article className={`authority-card reward-account-card ${projectInspection.participationStatus.toLowerCase()}`}>
            <div className="authority-card-top">
              <WalletCards size={17} />
              <span>{formatLabel(projectInspection.participationStatus)}</span>
            </div>
            <strong>Participation Record</strong>
            <p>{projectInspection.participationMessage}</p>
            <em>
              {projectInspection.participation
                ? `${formatRypBaseUnits(projectInspection.participation.participationAmount)} / ${formatLabel(projectInspection.participation.status)}`
                : "Wallet participation state pending"}
            </em>
            <code>{projectInspection.participationAddress ?? "Wallet target required"}</code>
          </article>
        </div>
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

function formatModulePauses(modules: string[]) {
  return modules.length > 0 ? modules.map(formatLabel).join(" / ") : "None";
}

function normalizeOptionalPublicKey(address: string | undefined) {
  try {
    return address ? new PublicKey(address).toBase58() : undefined;
  } catch {
    return undefined;
  }
}

function stateInspectionMessages(
  stakeInspection: StakePositionInspection | undefined,
  governanceInspection: GovernanceStateInspection,
  projectInspection: ProjectStateInspection,
) {
  const messages = [
    ...(stakeInspection?.blockers ?? []).map((text) => ({ kind: "blocker" as const, text })),
    ...governanceInspection.blockers.map((text) => ({ kind: "blocker" as const, text })),
    ...projectInspection.blockers.map((text) => ({ kind: "blocker" as const, text })),
    ...(stakeInspection?.warnings ?? []).map((text) => ({ kind: "warning" as const, text })),
    ...governanceInspection.warnings.map((text) => ({ kind: "warning" as const, text })),
    ...projectInspection.warnings.map((text) => ({ kind: "warning" as const, text })),
  ];
  const seen = new Set<string>();
  return messages.filter((message) => {
    if (seen.has(message.text)) return false;
    seen.add(message.text);
    return true;
  });
}

function formatRypBaseUnits(value: string) {
  try {
    const decimals = BigInt(appConfig.rypDecimals);
    const divisor = 10n ** decimals;
    const raw = BigInt(value);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    if (fraction === 0n) return `${whole.toLocaleString()} RYP`;
    const fractionText = fraction.toString().padStart(appConfig.rypDecimals, "0").replace(/0+$/, "");
    return `${whole.toLocaleString()}.${fractionText} RYP`;
  } catch {
    return `${value} base units`;
  }
}
