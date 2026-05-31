import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const idlPath = path.join(repoRoot, "target", "idl", "cryptoseeds_protocol.json");
const specPath = path.join(repoRoot, "src", "solana", "protocolInstructionSpecs.json");

if (!existsSync(idlPath)) {
  throw new Error(
    `Missing generated Anchor IDL at ${idlPath}. Run npm run protocol:build:wsl before checking protocol drift.`,
  );
}

const idl = JSON.parse(readFileSync(idlPath, "utf8"));
const specs = JSON.parse(readFileSync(specPath, "utf8"));

for (const [instructionName, spec] of Object.entries(specs)) {
  const idlInstruction = idl.instructions.find((instruction) => instruction.name === instructionName);
  if (!idlInstruction) {
    throw new Error(`IDL is missing instruction ${instructionName}`);
  }

  assertEqual(`${instructionName} discriminator`, bytesToHex(idlInstruction.discriminator), spec.discriminatorHex);
  assertJsonEqual(
    `${instructionName} account order`,
    idlInstruction.accounts.map((account) => ({
      name: account.name,
      signer: Boolean(account.signer),
      writable: Boolean(account.writable),
    })),
    spec.accounts.map((account) => ({
      name: account.name,
      signer: account.signer,
      writable: account.writable,
    })),
  );
  assertJsonEqual(
    `${instructionName} args`,
    idlInstruction.args.map((arg) => arg.name),
    spec.args,
  );
}

console.log(`Protocol IDL drift check passed for ${Object.keys(specs).length} frontend instruction plans.`);

function bytesToHex(bytes) {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertJsonEqual(label, actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, received ${actualJson}`);
  }
}
