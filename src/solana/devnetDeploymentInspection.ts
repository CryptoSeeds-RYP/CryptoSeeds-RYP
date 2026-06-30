import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { appConfig, type AppConfig } from "../config/env";
import { RYP_MINT_ADDRESS } from "../domain/token";

export type DevnetDeploymentReadStatus = "PREVIEW_ONLY" | "MISSING" | "PRESENT" | "DECODE_ERROR";

export type DevnetAuthorityInspection = {
  address?: string;
  status: DevnetDeploymentReadStatus;
  lamports?: number;
  sol?: number;
  fundedForMint: boolean;
  fundedForDeploy: boolean;
  message: string;
};

export type DevnetMintInspection = {
  address: string;
  status: DevnetDeploymentReadStatus;
  isMint?: boolean;
  decimals?: number;
  mintAuthority?: string | null;
  freezeAuthority?: string | null;
  supply?: string;
  owner?: string;
  message: string;
};

export type DevnetProgramInspection = {
  address: string;
  status: DevnetDeploymentReadStatus;
  executable?: boolean;
  owner?: string;
  lamports?: number;
  dataLength?: number;
  message: string;
};

export type DevnetOperatorHandoff = {
  activeStep:
    | "fund_devnet_authority"
    | "create_devnet_test_mint"
    | "deploy_devnet_program"
    | "initialize_devnet_protocol";
  command: string;
  resumeCommand: string;
  afterCompletionCommand: string;
  requiresExternalAction: boolean;
  requiresExplicitApproval: boolean;
  risk: "READ_ONLY" | "DEVNET_MUTATION";
  operatorRule: string;
};

export type DevnetDeploymentInspection = {
  executionMode: "READ_ONLY";
  cluster: AppConfig["cluster"];
  deployment: AppConfig["protocolDeployment"];
  opsEnvFile: string;
  minimumMintSolRequired: number;
  minimumDeploySolRecommended: number;
  authority: DevnetAuthorityInspection;
  mint: DevnetMintInspection;
  program: DevnetProgramInspection;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
  operatorHandoff: DevnetOperatorHandoff;
};

const MIN_MINT_SOL = 0.1;
const MIN_DEPLOY_SOL = 3;
const BPF_UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";

export function buildDevnetDeploymentInspectionPreview({
  config = appConfig,
}: {
  config?: Pick<
    AppConfig,
    | "adminAuthorityAddress"
    | "cluster"
    | "opsEnvFile"
    | "protocolDeployment"
    | "protocolProgramId"
    | "rypDecimals"
    | "rypMintAddress"
  >;
} = {}): DevnetDeploymentInspection {
  return validateDevnetDeploymentInspection({
    executionMode: "READ_ONLY",
    cluster: config.cluster,
    deployment: config.protocolDeployment,
    opsEnvFile: config.opsEnvFile,
    minimumMintSolRequired: MIN_MINT_SOL,
    minimumDeploySolRecommended: MIN_DEPLOY_SOL,
    authority: {
      address: config.adminAuthorityAddress,
      status: "PREVIEW_ONLY",
      fundedForMint: false,
      fundedForDeploy: false,
      message: "Devnet authority balance has not been read.",
    },
    mint: {
      address: config.rypMintAddress,
      status: "PREVIEW_ONLY",
      message: "Devnet RYP mint account has not been read.",
    },
    program: {
      address: config.protocolProgramId,
      status: "PREVIEW_ONLY",
      message: "Devnet program account has not been read.",
    },
    blockers: [],
    warnings: ["Devnet deployment inspection is read-only."],
    nextActions: [],
    operatorHandoff: buildOperatorHandoff("fund_devnet_authority", config.opsEnvFile),
  }, { rypDecimals: config.rypDecimals });
}

export async function readDevnetDeploymentInspection({
  config = appConfig,
  connection,
}: {
  config?: Pick<
    AppConfig,
    | "adminAuthorityAddress"
    | "cluster"
    | "opsEnvFile"
    | "protocolDeployment"
    | "protocolProgramId"
    | "rypDecimals"
    | "rypMintAddress"
  >;
  connection: Connection;
}): Promise<DevnetDeploymentInspection> {
  const preview = buildDevnetDeploymentInspectionPreview({ config });
  const [authority, mint, program] = await Promise.all([
    readAuthority({ address: config.adminAuthorityAddress, connection }),
    readMint({ address: config.rypMintAddress, connection }),
    readProgram({ address: config.protocolProgramId, connection }),
  ]);

  return validateDevnetDeploymentInspection({
    ...preview,
    authority,
    mint,
    program,
  }, { rypDecimals: config.rypDecimals });
}

export function validateDevnetDeploymentInspection(
  inspection: DevnetDeploymentInspection,
  { rypDecimals = appConfig.rypDecimals }: { rypDecimals?: number } = {},
): DevnetDeploymentInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("Devnet deployment inspection must remain read-only.");
  }
  if (inspection.cluster !== "devnet") {
    blockers.push("Devnet deployment inspection requires VITE_SOLANA_CLUSTER=devnet.");
  }
  if (inspection.deployment !== "devnet") {
    blockers.push("Devnet deployment inspection requires VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT=devnet.");
  }
  if (!inspection.authority.address) {
    blockers.push("Devnet admin authority address is not configured.");
  }
  if (inspection.authority.status === "DECODE_ERROR") {
    blockers.push(inspection.authority.message);
  }
  if (!inspection.authority.fundedForMint) {
    blockers.push(
      `Devnet authority needs at least ${inspection.minimumMintSolRequired} SOL to create the test mint.`,
    );
  }
  if (inspection.authority.fundedForMint && !inspection.authority.fundedForDeploy) {
    warnings.push(
      `Devnet authority has mint funding; ${inspection.minimumDeploySolRecommended} SOL is recommended before deployment.`,
    );
  }

  if (inspection.mint.address === RYP_MINT_ADDRESS && inspection.cluster === "devnet") {
    blockers.push("Devnet must use the configured devnet RYP test mint, not the mainnet RYP mint.");
  }
  if (inspection.mint.status === "MISSING") blockers.push("Devnet RYP test mint account does not exist.");
  if (inspection.mint.status === "DECODE_ERROR") blockers.push(inspection.mint.message);
  if (inspection.mint.status === "PRESENT" && !inspection.mint.isMint) {
    blockers.push("Devnet RYP account exists but is not a parsed SPL mint.");
  }
  if (inspection.mint.isMint && inspection.mint.decimals !== rypDecimals) {
    blockers.push(`Devnet RYP mint decimals are ${inspection.mint.decimals}; expected ${rypDecimals}.`);
  }

  if (inspection.program.status === "MISSING") blockers.push("Devnet program account does not exist.");
  if (inspection.program.status === "DECODE_ERROR") blockers.push(inspection.program.message);
  if (inspection.program.status === "PRESENT" && !inspection.program.executable) {
    blockers.push("Devnet program account is not executable.");
  }
  if (inspection.program.owner && inspection.program.owner !== BPF_UPGRADEABLE_LOADER_ID) {
    blockers.push("Devnet program account is not owned by the upgradeable BPF loader.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
    nextActions: buildNextActions(inspection),
    operatorHandoff: buildOperatorHandoff(nextStep(inspection), inspection.opsEnvFile),
  };
}

async function readAuthority({
  address,
  connection,
}: {
  address?: string;
  connection: Connection;
}): Promise<DevnetAuthorityInspection> {
  if (!address) {
    return {
      status: "DECODE_ERROR",
      fundedForMint: false,
      fundedForDeploy: false,
      message: "Devnet authority address is not configured.",
    };
  }

  try {
    const publicKey = new PublicKey(address);
    const lamports = await connection.getBalance(publicKey, "confirmed");
    const sol = lamports / LAMPORTS_PER_SOL;
    return {
      address: publicKey.toBase58(),
      status: "PRESENT",
      lamports,
      sol,
      fundedForMint: sol >= MIN_MINT_SOL,
      fundedForDeploy: sol >= MIN_DEPLOY_SOL,
      message: `Devnet authority balance is ${sol} SOL.`,
    };
  } catch (error) {
    return {
      address,
      status: "DECODE_ERROR",
      fundedForMint: false,
      fundedForDeploy: false,
      message: `Devnet authority balance read failed: ${errorMessage(error)}.`,
    };
  }
}

async function readMint({
  address,
  connection,
}: {
  address: string;
  connection: Connection;
}): Promise<DevnetMintInspection> {
  try {
    const publicKey = new PublicKey(address);
    const account = await connection.getParsedAccountInfo(publicKey, "confirmed");
    if (!account.value) {
      return {
        address: publicKey.toBase58(),
        status: "MISSING",
        message: "Devnet RYP test mint account was not found.",
      };
    }
    if (!("parsed" in account.value.data) || account.value.data.parsed.type !== "mint") {
      return {
        address: publicKey.toBase58(),
        status: "PRESENT",
        isMint: false,
        owner: account.value.owner.toBase58(),
        message: "Configured devnet RYP account exists but is not a parsed SPL mint.",
      };
    }

    return {
      address: publicKey.toBase58(),
      status: "PRESENT",
      isMint: true,
      decimals: Number(account.value.data.parsed.info.decimals),
      freezeAuthority: account.value.data.parsed.info.freezeAuthority ?? null,
      mintAuthority: account.value.data.parsed.info.mintAuthority ?? null,
      supply: account.value.data.parsed.info.supply,
      owner: account.value.owner.toBase58(),
      message: "Devnet RYP test mint decoded.",
    };
  } catch (error) {
    return {
      address,
      status: "DECODE_ERROR",
      message: `Devnet RYP test mint read failed: ${errorMessage(error)}.`,
    };
  }
}

async function readProgram({
  address,
  connection,
}: {
  address: string;
  connection: Connection;
}): Promise<DevnetProgramInspection> {
  try {
    const publicKey = new PublicKey(address);
    const account = await connection.getAccountInfo(publicKey, "confirmed");
    if (!account) {
      return {
        address: publicKey.toBase58(),
        status: "MISSING",
        message: "Devnet program account was not found.",
      };
    }

    return {
      address: publicKey.toBase58(),
      status: "PRESENT",
      dataLength: account.data.length,
      executable: account.executable,
      lamports: account.lamports,
      owner: account.owner.toBase58(),
      message: "Devnet program account was found.",
    };
  } catch (error) {
    return {
      address,
      status: "DECODE_ERROR",
      message: `Devnet program account read failed: ${errorMessage(error)}.`,
    };
  }
}

function buildNextActions(inspection: DevnetDeploymentInspection) {
  const step = nextStep(inspection);
  const commands = devnetCommands(inspection.opsEnvFile);
  if (step === "fund_devnet_authority") {
    return [
      `Fund ${inspection.authority.address ?? "the devnet authority"} with at least ${inspection.minimumMintSolRequired} devnet SOL; ${inspection.minimumDeploySolRecommended} SOL is recommended.`,
      commands.fundingPacket,
      commands.next,
    ];
  }
  if (step === "create_devnet_test_mint") {
    return [
      commands.mintTest,
      commands.next,
    ];
  }
  if (step === "deploy_devnet_program") {
    return [
      commands.bootstrapDeploy,
      commands.next,
    ];
  }
  return [
    commands.initProtocol,
    commands.readOnlyReadiness,
  ];
}

function nextStep(inspection: DevnetDeploymentInspection): DevnetOperatorHandoff["activeStep"] {
  if (!inspection.authority.fundedForMint) return "fund_devnet_authority";
  if (inspection.mint.status !== "PRESENT" || !inspection.mint.isMint) return "create_devnet_test_mint";
  if (inspection.program.status !== "PRESENT" || !inspection.program.executable) return "deploy_devnet_program";
  return "initialize_devnet_protocol";
}

function buildOperatorHandoff(activeStep: DevnetOperatorHandoff["activeStep"], opsEnvFile: string): DevnetOperatorHandoff {
  const commands = devnetCommands(opsEnvFile);
  const resumeCommand = commands.next;
  const commandByStep: Record<DevnetOperatorHandoff["activeStep"], string> = {
    fund_devnet_authority: commands.fundingPacket,
    create_devnet_test_mint: commands.mintTest,
    deploy_devnet_program: commands.bootstrapDeploy,
    initialize_devnet_protocol: commands.initProtocol,
  };
  const risk = activeStep === "fund_devnet_authority" ? "READ_ONLY" : "DEVNET_MUTATION";
  const requiresExternalAction = activeStep === "fund_devnet_authority";
  const requiresExplicitApproval = risk === "DEVNET_MUTATION";

  return {
    activeStep,
    command: commandByStep[activeStep],
    resumeCommand,
    afterCompletionCommand: resumeCommand,
    requiresExternalAction,
    requiresExplicitApproval,
    risk,
    operatorRule: operatorRule({ requiresExplicitApproval, requiresExternalAction, risk }),
  };
}

function devnetCommands(opsEnvFile: string) {
  const envArg = `--env ${opsEnvFile}`;
  return {
    bootstrapDeploy: `npm run devnet:bootstrap -- ${envArg} --deploy --init-plan`,
    fundingPacket: `npm run devnet:funding:packet -- ${envArg}`,
    initProtocol: `npm run devnet:init:protocol -- ${envArg}`,
    mintTest: `npm run devnet:mint:test -- ${envArg}`,
    next: `npm run devnet:next -- ${envArg}`,
    readOnlyReadiness: `npm run testnet:readiness -- --profile read-only ${envArg}`,
  };
}

function operatorRule({
  requiresExplicitApproval,
  requiresExternalAction,
  risk,
}: Pick<DevnetOperatorHandoff, "requiresExplicitApproval" | "requiresExternalAction" | "risk">) {
  if (requiresExternalAction) {
    return "External action required first; use the funding packet, fund devnet SOL externally, then rerun devnet:next.";
  }
  if (requiresExplicitApproval) {
    return "Review the printed report and approve this devnet mutation before running the command.";
  }
  if (risk === "READ_ONLY") {
    return "Safe to run as a read-only inspection or report command; rerun devnet:next afterward.";
  }
  return "Review before running the next action; the risk level is not recognized.";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}
