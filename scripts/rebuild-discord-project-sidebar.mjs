import { readFile } from "node:fs/promises";
import path from "node:path";

const home = "C:\\Users\\FiercePC";
const envPath = path.join(home, ".openclaw", ".env");
const guildId = "1509503597849608212";
const apiBase = "https://discord.com/api/v10";

const channelTypes = {
  text: 0,
  category: 4,
  forum: 15,
};

const oldForumNames = new Set(["crypto-seeds-ryp", "northstar-medical"]);

const categories = [
  {
    name: "Crypto Seeds RYP",
    channels: [
      {
        name: "token-ryp",
        topic: "RYP token utility, supply, staking tiers, fee model, and token decisions.",
      },
      {
        name: "microverse",
        topic: "MicroVerse dashboard, live farm environment, project map, NFTs, rewards, and governance design.",
      },
      {
        name: "seedbot-terminal",
        topic: "Self-custodial SeedBot Terminal, strategy tools, risk controls, and wallet-approved execution.",
      },
    ],
  },
  {
    name: "NorthStar Medical",
    channels: [
      {
        name: "app",
        topic: "NorthStar Medical app product work, UX, workflows, releases, and implementation planning.",
      },
      {
        name: "patient-onboarding",
        topic: "Patient intake, onboarding flows, forms, documents, accessibility, and support experience.",
      },
      {
        name: "clinical-safety-compliance",
        topic: "Clinical governance, data protection, audit readiness, safety checks, and compliance decisions.",
      },
    ],
  },
  {
    name: "Crypto Seeds RYP Logs",
    channels: [
      {
        name: "token-ryp-log",
        topic: "Log channel for RYP token work, decisions, changes, and delivery notes.",
      },
      {
        name: "microverse-log",
        topic: "Log channel for MicroVerse design, build progress, decisions, and handoffs.",
      },
      {
        name: "seedbot-terminal-log",
        topic: "Log channel for SeedBot Terminal build progress, safety decisions, and integration notes.",
      },
    ],
  },
  {
    name: "NorthStar Medical Logs",
    channels: [
      {
        name: "app-log",
        topic: "Log channel for NorthStar Medical app progress, decisions, releases, and handoffs.",
      },
      {
        name: "patient-onboarding-log",
        topic: "Log channel for patient onboarding progress, workflow decisions, and implementation notes.",
      },
      {
        name: "clinical-safety-compliance-log",
        topic: "Log channel for clinical safety, compliance, and audit-readiness decisions.",
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function discordRequest(token, method, route, body, attempt = 1) {
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
  if (response.status === 429 && attempt <= 5) {
    const retryAfterSeconds = Number(payload?.retry_after ?? 2);
    await sleep(Math.ceil(retryAfterSeconds * 1000) + 500);
    return discordRequest(token, method, route, body, attempt + 1);
  }

  if (!response.ok) {
    const message = payload?.message ?? response.statusText;
    throw new Error(`${method} ${route} failed (${response.status}): ${message}`);
  }

  return payload;
}

async function listGuildChannels(token) {
  return discordRequest(token, "GET", `/guilds/${guildId}/channels`);
}

async function deleteOldForums(token, channels) {
  const deleted = [];
  for (const channel of channels) {
    if (oldForumNames.has(channel.name) && channel.type === channelTypes.forum) {
      await discordRequest(token, "DELETE", `/channels/${channel.id}`);
      deleted.push(channel);
    }
  }
  return deleted;
}

async function ensureCategory(token, channels, name) {
  const existing = channels.find(
    (channel) => channel.name.toLowerCase() === name.toLowerCase() && channel.type === channelTypes.category,
  );
  if (existing) return { category: existing, created: false };

  const category = await discordRequest(token, "POST", `/guilds/${guildId}/channels`, {
    name,
    type: channelTypes.category,
  });
  return { category, created: true };
}

async function ensureTextChannel(token, channels, categoryId, channel, position) {
  const existing = channels.find(
    (candidate) =>
      candidate.name === channel.name &&
      candidate.type === channelTypes.text,
  );
  if (existing) {
    if (existing.parent_id !== categoryId || existing.topic !== channel.topic) {
      const updated = await discordRequest(token, "PATCH", `/channels/${existing.id}`, {
        parent_id: categoryId,
        topic: channel.topic,
        position,
      });
      return { channel: updated, created: false, moved: existing.parent_id !== categoryId };
    }
    return { channel: existing, created: false, moved: false };
  }

  const created = await discordRequest(token, "POST", `/guilds/${guildId}/channels`, {
    name: channel.name,
    type: channelTypes.text,
    parent_id: categoryId,
    topic: channel.topic,
    position,
  });
  return { channel: created, created: true, moved: false };
}

async function applySidebarOrder(token, allChannels, results) {
  const positions = [];
  let position = 0;

  for (const categoryConfig of categories) {
    const category = allChannels.find(
      (channel) =>
        channel.name.toLowerCase() === categoryConfig.name.toLowerCase() &&
        channel.type === channelTypes.category,
    );
    if (!category) continue;

    positions.push({ id: category.id, position });
    position += 1;

    for (const channelConfig of categoryConfig.channels) {
      const channel = allChannels.find(
        (candidate) =>
          candidate.name === channelConfig.name &&
          candidate.type === channelTypes.text &&
          candidate.parent_id === category.id,
      );
      if (!channel) continue;
      positions.push({ id: channel.id, position });
      position += 1;
    }
  }

  if (positions.length > 0) {
    await discordRequest(token, "PATCH", `/guilds/${guildId}/channels`, positions);
    results.push({ type: "updated-sidebar-order", name: `${positions.length} items`, id: "guild" });
  }
}

async function main() {
  const env = await readEnv();
  const token = env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error(`DISCORD_BOT_TOKEN missing from ${envPath}`);

  let channels = await listGuildChannels(token);
  const deleted = await deleteOldForums(token, channels);
  channels = await listGuildChannels(token);

  const results = deleted.map((channel) => ({
    type: "deleted-forum",
    name: channel.name,
    id: channel.id,
  }));

  for (const categoryConfig of categories) {
    const categoryResult = await ensureCategory(token, channels, categoryConfig.name);
    if (categoryResult.created) channels.push(categoryResult.category);
    results.push({
      type: categoryResult.created ? "created-category" : "existing-category",
      name: categoryConfig.name,
      id: categoryResult.category.id,
    });

    for (let index = 0; index < categoryConfig.channels.length; index += 1) {
      const channelConfig = categoryConfig.channels[index];
      const channelResult = await ensureTextChannel(
        token,
        channels,
        categoryResult.category.id,
        channelConfig,
        index,
      );
      if (channelResult.created) channels.push(channelResult.channel);
      results.push({
        type: channelResult.created
          ? "created-channel"
          : channelResult.moved
            ? "moved-channel"
            : "existing-channel",
        name: channelConfig.name,
        id: channelResult.channel.id,
        parent: categoryConfig.name,
      });
    }
  }

  channels = await listGuildChannels(token);
  await applySidebarOrder(token, channels, results);

  for (const result of results) {
    const parent = result.parent ? ` under ${result.parent}` : "";
    console.log(`${result.type}: ${result.name}${parent} (${result.id})`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
