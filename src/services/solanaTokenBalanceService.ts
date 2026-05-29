import { Connection, PublicKey, type ParsedAccountData } from "@solana/web3.js";
import { appConfig } from "../config/env";

export async function readSplTokenBalance({
  ownerAddress,
  mintAddress = appConfig.rypMintAddress,
  rpcUrl = appConfig.rpcUrl,
}: {
  ownerAddress: string;
  mintAddress?: string;
  rpcUrl?: string;
}) {
  const owner = readPublicKey(ownerAddress);
  const mint = readPublicKey(mintAddress);

  if (!owner || !mint) {
    return 0;
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });

  return accounts.value.reduce((total, { account }) => {
    const data = account.data;
    if (!isParsedAccountData(data)) return total;

    return total + readParsedTokenUiAmount(data);
  }, 0);
}

function readPublicKey(value?: string) {
  if (!value) return null;

  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

function isParsedAccountData(data: Buffer | ParsedAccountData): data is ParsedAccountData {
  return typeof data === "object" && data !== null && "parsed" in data;
}

function readParsedTokenUiAmount(data: ParsedAccountData) {
  const parsed = data.parsed as {
    info?: {
      tokenAmount?: {
        uiAmount?: number | null;
      };
    };
  };

  return Number(parsed.info?.tokenAmount?.uiAmount ?? 0);
}
