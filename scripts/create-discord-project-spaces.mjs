import { readFile } from "node:fs/promises";
import path from "node:path";

const home = "C:\\Users\\FiercePC";
const envPath = path.join(home, ".openclaw", ".env");
const guildId = "1509503597849608212";
const apiBase = "https://discord.com/api/v10";

const forumType = 15;
const autoArchiveOneWeek = 10080;

const spaces = [
  {
    name: "crypto-seeds-ryp",
    topic: "CryptoSeeds RYP project planning, protocol work, MicroVerse design, and SeedBot Terminal coordination.",
    threads: [
      {
        name: "Token RYP",
        content:
          "RYP token utility, supply, staking tiers, fee model, governance access, and token-specific decisions.",
      },
      {
        name: "MicroVerse",
        content:
          "Farm dashboard, Explorer's Map, project progression, rewards, NFTs, governance hall, and live environment design.",
      },
      {
        name: "SeedBot Terminal",
        content:
          "Self-custodial trading tools, strategy automation, risk controls, and wallet-approved execution.",
      },
    ],
  },
  {
    name: "northstar-medical",
    topic: "NorthStar Medical app, clinical workflow, patient onboarding, compliance, and operational planning.",
    threads: [
      {
        name: "App",
        content: "NorthStar Medical app product work, UX, workflows, releases, and implementation planning.",
      },
      {
        name: "Patient Onboarding",
        content: "Patient intake, onboarding flows, forms, documents, accessibility, and support experience.",
      },
      {
        name: "Clinical Safety & Compliance",
        content: "Clinical governance, data protection, audit readiness, safety checks, and compliance decisions.",
      },
    ],
  },
];

async function readEnv() {
  const text = await readFile(envPath, "utf8");
  const env = {};
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^"|"$/g, "");
    env[key] = value;
  }
  return env;
}

async function discordRequest(token, method, route, body) {
  const response = await fetch(`${apiBase}${route}`, {
    method,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message ?? response.statusText;
    throw new Error(`${method} ${route} failed (${response.status}): ${message}`);
  }

  return payload;
}

async function listGuildChannels(token) {
  return discordRequest(token, "GET", `/guilds/${guildId}/channels`);
}

async function ensureForum(token, channels, space) {
  const existing = channels.find((channel) => channel.name === space.name);
  if (existing) {
    if (existing.type !== forumType) {
      throw new Error(
        `Channel ${space.name} already exists but is not a forum channel. Existing id: ${existing.id}`,
      );
    }
    return { channel: existing, created: false };
  }

  const channel = await discordRequest(token, "POST", `/guilds/${guildId}/channels`, {
    name: space.name,
    type: forumType,
    topic: space.topic,
    default_auto_archive_duration: autoArchiveOneWeek,
  });

  return { channel, created: true };
}

async function listKnownThreads(token, channelId) {
  const [active, archived] = await Promise.all([
    discordRequest(token, "GET", `/guilds/${guildId}/threads/active`),
    discordRequest(token, "GET", `/channels/${channelId}/threads/archived/public?limit=100`),
  ]);

  const activeThreads = (active.threads ?? []).filter((thread) => thread.parent_id === channelId);
  return [...activeThreads, ...(archived.threads ?? [])];
}

async function ensureThread(token, channelId, thread) {
  const existingThreads = await listKnownThreads(token, channelId);
  const existing = existingThreads.find(
    (candidate) => candidate.name.toLowerCase() === thread.name.toLowerCase(),
  );
  if (existing) return { thread: existing, created: false };

  const created = await discordRequest(token, "POST", `/channels/${channelId}/threads`, {
    name: thread.name,
    auto_archive_duration: autoArchiveOneWeek,
    message: {
      content: thread.content,
    },
  });

  return { thread: created, created: true };
}

async function main() {
  const env = await readEnv();
  const token = env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error(`DISCORD_BOT_TOKEN missing from ${envPath}`);

  const channels = await listGuildChannels(token);
  const results = [];

  for (const space of spaces) {
    const forumResult = await ensureForum(token, channels, space);
    results.push({
      type: forumResult.created ? "created-channel" : "existing-channel",
      name: space.name,
      id: forumResult.channel.id,
    });

    for (const thread of space.threads) {
      const threadResult = await ensureThread(token, forumResult.channel.id, thread);
      results.push({
        type: threadResult.created ? "created-thread" : "existing-thread",
        name: thread.name,
        id: threadResult.thread.id,
        parent: space.name,
      });
    }
  }

  for (const result of results) {
    const parent = result.parent ? ` in ${result.parent}` : "";
    console.log(`${result.type}: ${result.name}${parent} (${result.id})`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

