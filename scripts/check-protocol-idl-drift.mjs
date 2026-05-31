import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const idlPath = path.join(repoRoot, "target", "idl", "cryptoseeds_protocol.json");
const specPath = path.join(repoRoot, "src", "solana", "protocolInstructionSpecs.json");
const accountLayoutPath = path.join(repoRoot, "src", "solana", "protocolAccountLayouts.json");

if (!existsSync(idlPath)) {
  throw new Error(
    `Missing generated Anchor IDL at ${idlPath}. Run npm run protocol:build:wsl before checking protocol drift.`,
  );
}

const idl = JSON.parse(readFileSync(idlPath, "utf8"));
const specs = JSON.parse(readFileSync(specPath, "utf8"));
const accountLayouts = JSON.parse(readFileSync(accountLayoutPath, "utf8"));

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

for (const [accountName, layout] of Object.entries(accountLayouts)) {
  const idlAccount = idl.accounts.find((account) => account.name === accountName);
  if (!idlAccount) {
    throw new Error(`IDL is missing account ${accountName}`);
  }

  const idlType = idl.types.find((type) => type.name === accountName);
  if (!idlType) {
    throw new Error(`IDL is missing account type ${accountName}`);
  }

  assertEqual(`${accountName} discriminator`, bytesToHex(idlAccount.discriminator), layout.discriminatorHex);
  assertJsonEqual(
    `${accountName} field order`,
    idlType.type.fields.map((field) => field.name),
    layout.fields.map((field) => field.name),
  );

  const expectedFields = computeFieldLayout(idlType.type.fields);
  assertJsonEqual(`${accountName} field layout`, expectedFields, layout.fields);
  assertEqual(
    `${accountName} minimum account length`,
    expectedFields.reduce((lastByte, field) => Math.max(lastByte, field.offset + field.size), 8),
    layout.minimumLength,
  );
}

console.log(
  `Protocol IDL drift check passed for ${Object.keys(specs).length} frontend instruction plans and ${Object.keys(accountLayouts).length} account layouts.`,
);

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

function computeFieldLayout(fields) {
  let offset = 8;
  return fields.map((field) => {
    const type = normalizeType(field.type);
    const size = byteSize(field.type);
    const layout = {
      name: field.name,
      type,
      offset,
      size,
    };
    offset += size;
    return layout;
  });
}

function normalizeType(type) {
  if (typeof type === "string") return type;
  if (type.array) return `array:${normalizeType(type.array[0])}:${type.array[1]}`;
  if (type.defined) return `defined:${type.defined.name}`;
  throw new Error(`Unsupported IDL type: ${JSON.stringify(type)}`);
}

function byteSize(type) {
  if (typeof type === "string") {
    if (type === "pubkey") return 32;
    if (type === "u64" || type === "i64") return 8;
    if (type === "u16") return 2;
    if (type === "u8" || type === "bool") return 1;
  }

  if (type.array) {
    return byteSize(type.array[0]) * type.array[1];
  }

  if (type.defined) {
    return 1;
  }

  throw new Error(`Unsupported IDL byte size for type: ${JSON.stringify(type)}`);
}
