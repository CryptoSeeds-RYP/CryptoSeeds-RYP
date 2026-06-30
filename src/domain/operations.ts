export type OperationAutomationMode = "MONITOR_ONLY" | "DRAFT_ONLY" | "APPROVAL_REQUIRED" | "BLOCKED";

export type MaintenanceRunbookItem = {
  id: string;
  label: string;
  cadence: "EVERY_COMMIT" | "DAILY" | "WEEKLY" | "BEFORE_LAUNCH" | "INCIDENT_ONLY";
  script?: string;
  automationMode: OperationAutomationMode;
  approvalRequired: boolean;
  operatorAction: string;
  aiAgentBoundary: string;
};

export type AgentSafetyRule = {
  id: string;
  label: string;
  allowed: boolean;
  detail: string;
};

export const maintenanceRunbook: MaintenanceRunbookItem[] = [
  {
    id: "app-regression-check",
    label: "App Regression Check",
    cadence: "EVERY_COMMIT",
    script: "npm.cmd test && npm.cmd run build",
    automationMode: "MONITOR_ONLY",
    approvalRequired: false,
    operatorAction: "Run tests and production build before merging visible or protocol-facing changes.",
    aiAgentBoundary: "Agent may run checks and summarize failures; it must not hide failing output.",
  },
  {
    id: "copy-visual-safety",
    label: "Copy & Visual Safety",
    cadence: "EVERY_COMMIT",
    script: "npm.cmd run copy:audit && npm.cmd run visual:audit",
    automationMode: "MONITOR_ONLY",
    approvalRequired: false,
    operatorAction: "Confirm public wording stays conservative and visual assets remain registered.",
    aiAgentBoundary: "Agent may flag risky language or asset drift; it may not approve compliance-sensitive wording by itself.",
  },
  {
    id: "ryp-token-health",
    label: "RYP Token Health",
    cadence: "DAILY",
    script: "npm.cmd run token:check",
    automationMode: "MONITOR_ONLY",
    approvalRequired: false,
    operatorAction: "Confirm mint and freeze authorities remain disabled and supply stays known.",
    aiAgentBoundary: "Agent may alert on authority/supply drift; it cannot mutate token state.",
  },
  {
    id: "devnet-protocol-state-inspection",
    label: "Devnet Protocol State Inspection",
    cadence: "BEFORE_LAUNCH",
    script: "npm.cmd run devnet:inspect:protocol -- --env .env.devnet.example",
    automationMode: "MONITOR_ONLY",
    approvalRequired: false,
    operatorAction: "Inspect deployed program, protocol config, reward config, and reward vault states before public preview review.",
    aiAgentBoundary: "Agent may run read-only inspection and summarize blockers; it must not initialize accounts or enable execution.",
  },
  {
    id: "public-readonly-testnet-gate",
    label: "Read-only Public Testnet Gate",
    cadence: "BEFORE_LAUNCH",
    script: "npm.cmd run testnet:readiness -- --profile read-only --env .env.devnet.example",
    automationMode: "DRAFT_ONLY",
    approvalRequired: true,
    operatorAction: "Confirm devnet deployment, program inspection, and ops readiness before sharing a read-only public preview.",
    aiAgentBoundary: "Agent may prepare the report; publishing a preview link or enabling wallet execution requires human approval.",
  },
  {
    id: "devnet-broadcast-gate",
    label: "Broadcast Readiness Gate",
    cadence: "BEFORE_LAUNCH",
    script: "npm.cmd run testnet:readiness -- --profile wallet-execution --env .env.devnet.example",
    automationMode: "APPROVAL_REQUIRED",
    approvalRequired: true,
    operatorAction: "Review cluster, program id, deployment status, demo mode, and broadcast flag before enabling live paths.",
    aiAgentBoundary: "Agent may prepare readiness reports; enabling broadcast requires human/multisig approval.",
  },
  {
    id: "protocol-drift-gate",
    label: "Protocol Drift Gate",
    cadence: "EVERY_COMMIT",
    script: "npm.cmd run protocol:idl:check",
    automationMode: "MONITOR_ONLY",
    approvalRequired: false,
    operatorAction: "Verify frontend instruction plans still match the Anchor IDL.",
    aiAgentBoundary: "Agent may identify drift and propose patches; protocol id or IDL changes need review.",
  },
  {
    id: "project-disclosure-review",
    label: "Project Disclosure Review",
    cadence: "WEEKLY",
    automationMode: "DRAFT_ONLY",
    approvalRequired: true,
    operatorAction: "Review project-owner accounts, charity separation, conflicts, documents, and receiving-account status.",
    aiAgentBoundary: "Agent may draft a review queue; project approvals need governance/admin approval.",
  },
  {
    id: "treasury-label-review",
    label: "Treasury Label Review",
    cadence: "WEEKLY",
    automationMode: "DRAFT_ONLY",
    approvalRequired: true,
    operatorAction: "Check treasury wallet labels, policy notes, fee split assumptions, and public reporting cadence.",
    aiAgentBoundary: "Agent may draft reports; treasury movement or policy changes require multisig approval.",
  },
  {
    id: "seedbot-permission-review",
    label: "SeedBot Permission Review",
    cadence: "BEFORE_LAUNCH",
    automationMode: "BLOCKED",
    approvalRequired: true,
    operatorAction: "Keep live execution, guarded automation, and profit-fee paths disabled until review is complete.",
    aiAgentBoundary: "Agent must not create keys, sign orders, approve agents, or broadcast SeedBot trades.",
  },
];

export const agentSafetyRules: AgentSafetyRule[] = [
  {
    id: "no-private-keys",
    label: "Private keys",
    allowed: false,
    detail: "No AI agent may request, store, transmit, paste, or generate production private keys or seed phrases.",
  },
  {
    id: "no-wallet-signing",
    label: "Wallet signing",
    allowed: false,
    detail: "No AI agent may sign wallet transactions or bypass wallet/multisig approval.",
  },
  {
    id: "no-silent-broadcast",
    label: "Silent broadcast",
    allowed: false,
    detail: "No AI agent may enable broadcast or submit live transactions without an explicit approved release gate.",
  },
  {
    id: "draft-reports",
    label: "Draft reports",
    allowed: true,
    detail: "AI agents may run checks, summarize logs, draft reports, and prepare review queues.",
  },
  {
    id: "draft-prs",
    label: "Draft code changes",
    allowed: true,
    detail: "AI agents may propose patches and draft PRs when tests and audit checks are visible.",
  },
];

export function allAutomatedRunbookItemsAvoidSigning() {
  return maintenanceRunbook
    .filter((item) => item.automationMode !== "BLOCKED")
    .every((item) => !/sign|private key|seed phrase/i.test(item.aiAgentBoundary));
}

export function approvalRequiredForSensitiveRunbookItems() {
  return maintenanceRunbook
    .filter((item) => item.automationMode === "APPROVAL_REQUIRED" || item.automationMode === "DRAFT_ONLY")
    .every((item) => item.approvalRequired);
}

export function blockedRunbookItemsRemainApprovalGated() {
  return maintenanceRunbook
    .filter((item) => item.automationMode === "BLOCKED")
    .every((item) => item.approvalRequired);
}
