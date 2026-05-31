import { Connection, PublicKey } from "@solana/web3.js";

const rpcUrl = process.env.VITE_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const mintAddress = process.env.VITE_RYP_MINT_ADDRESS ?? "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const expectedDecimals = Number(process.env.VITE_RYP_DECIMALS ?? 6);

const connection = new Connection(rpcUrl, "confirmed");
const account = await connection.getParsedAccountInfo(new PublicKey(mintAddress), "confirmed");

if (!account.value || !("parsed" in account.value.data)) {
  throw new Error(`RYP mint account could not be parsed: ${mintAddress}`);
}

const mint = account.value.data.parsed.info;
const decimals = Number(mint.decimals);
const supplyBaseUnits = String(mint.supply);
const divisor = 10 ** decimals;
const report = {
  address: mintAddress,
  ownerProgram: account.value.owner.toBase58(),
  decimals,
  supplyBaseUnits,
  supplyUiAmount: Number(supplyBaseUnits) / divisor,
  mintAuthority: mint.mintAuthority ?? null,
  freezeAuthority: mint.freezeAuthority ?? null,
};

console.log(JSON.stringify(report, null, 2));

if (report.decimals !== expectedDecimals) {
  throw new Error(`Unexpected RYP decimals: ${report.decimals}. Expected ${expectedDecimals}.`);
}

if (report.mintAuthority !== null) {
  throw new Error(`RYP mint authority is not disabled: ${report.mintAuthority}`);
}

if (report.freezeAuthority !== null) {
  throw new Error(`RYP freeze authority is not disabled: ${report.freezeAuthority}`);
}
