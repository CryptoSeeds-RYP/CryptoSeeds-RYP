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

export type DevnetDeploymentInspection = {
  executionMode: "READ_ONLY";
  cluster: AppConfig["cluster"];
  deployment: AppConfig["protocolDeployment"];
  minimumMintSolRequired: number;
  minimumDeploySolRecommended: number;
  authority: DevnetAuthorityInspection;
  mint: DevnetMintInspection;
  program: DevnetProgramInspection;
  blockers: string[];
  warnings: string[];
  nextActions: string[];
};

const MIN_MINT_SOL = 0.1;
const MIN_DEPLOY_SOL = 3;
const BPF_UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";

export function buildDevnetDeploymentInspectionPreview({
  config = appConfig,
}: {
  config?: Pick<
    AppConfig,
    "adminAuthorityAddress" | "cluster" | "protocolDeployment" | "protocolProgramId" | "rypDecimals" | "rypMintAddress"
  >;
} = {}): DevnetDeploymentInspection {
  return validateDevnetDeploymentInspection({
    executionMode: "READ_ONLY",
    cluster: config.cluster,
    deployment: config.protocolDeployment,
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
  }, { rypDecimals: config.rypDecimals });
}

export async function readDevnetDeploymentInspection({
  config = appConfig,
  connection,
}: {
  config?: Pick<
    AppConfig,
    "adminAuthorityAddress" | "cluster" | "protocolDeployment" | "protocolProgramId" | "rypDecimals" | "rypMintAddress"
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
  if (!inspection.authority.fundedForMint) {
    return [
      `Fund ${inspection.authority.address ?? "the devnet authority"} with at least ${inspection.minimumMintSolRequired} devnet SOL; ${inspection.minimumDeploySolRecommended} SOL is recommended.`,
      "npm run devnet:funding:packet -- --env .env.devnet.example",
      "npm run devnet:next -- --env .env.devnet.example",
    ];
  }
  if (inspection.mint.status !== "PRESENT" || !inspection.mint.isMint) {
    return [
      "npm run devnet:mint:test -- --env .env.devnet.example",
      "npm run devnet:next -- --env .env.devnet.example",
    ];
  }
  if (inspection.program.status !== "PRESENT" || !inspection.program.executable) {
    return [
      "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
      "npm run devnet:next -- --env .env.devnet.example",
    ];
  }
  return [
    "npm run devnet:init:protocol -- --env .env.devnet.example",
    "npm run testnet:readiness -- --profile read-only --env .env.devnet.example",
  ];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}
