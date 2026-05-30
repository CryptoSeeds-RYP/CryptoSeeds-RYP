import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const assetSpecs = JSON.parse(
  await readFile(join(repoRoot, "src", "visual", "microverseAssetSpecs.json"), "utf8"),
);

const failures = [];

for (const spec of assetSpecs) {
  const filePath = join(repoRoot, "public", spec.path.replace(/^\/assets\//, "assets/"));
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) {
    failures.push(`${spec.id}: missing file at ${spec.path}`);
    continue;
  }

  if (fileStat.size > spec.maxBytes) {
    failures.push(`${spec.id}: ${fileStat.size} bytes exceeds ${spec.maxBytes} byte budget`);
  }

  const buffer = await readFile(filePath);
  const dimensions = readImageDimensions(buffer, spec.path);
  if (!dimensions) {
    failures.push(`${spec.id}: unsupported or unreadable image dimensions`);
    continue;
  }

  if (dimensions.width !== spec.targetWidth || dimensions.height !== spec.targetHeight) {
    failures.push(
      `${spec.id}: ${dimensions.width}x${dimensions.height} does not match ${spec.targetWidth}x${spec.targetHeight}`,
    );
  }

  if (spec.role === "LANDMARK" && !imageHasAlpha(buffer, spec.path)) {
    failures.push(`${spec.id}: landmark assets must include an alpha channel`);
  }

  console.log(
    `${spec.id} ${spec.role}: ${dimensions.width}x${dimensions.height}, ${fileStat.size} bytes, productionReady=${spec.productionReady}`,
  );
}

if (failures.length > 0) {
  console.error("\nVisual asset audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("\nVisual asset audit passed.");

function imageHasAlpha(buffer, path) {
  if (buffer.length >= 26 && buffer.toString("ascii", 1, 4) === "PNG") {
    const colorType = buffer[25];
    return colorType === 4 || colorType === 6;
  }

  return path.endsWith(".webp");
}

function readImageDimensions(buffer, path) {
  if (buffer.length >= 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return readJpegDimensions(buffer);
  }

  if (path.endsWith(".webp")) {
    return readWebpDimensions(buffer);
  }

  return null;
}

function readJpegDimensions(buffer) {
  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    return null;
  }

  const format = buffer.toString("ascii", 12, 16);
  if (format === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (format === "VP8 ") {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (format === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}
