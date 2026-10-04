import type { PublicClient } from "viem";
import { allowLocalEndpoints, loadAgentsTtlMs, loadDirectoryName } from "./config.ts";
import { defaultClient, normalizeEnsName } from "./ens.ts";
import { AGENT_KEYS, DIRECTORY_KEY, parseAgent, parseDirectoryList, type Agent } from "./agent.ts";

export interface Discovery {
  agents: Agent[];
  skipped: { name: string; reason: "invalid-name" | "malformed-record" | "lookup-failed" }[];
  discoveredAt: number;
}

async function readAgent(name: string, rpc: PublicClient, allowLocal: boolean): Promise<Agent | null> {
  const [description, endpoint, topics] = await Promise.all(
    (Object.values(AGENT_KEYS) as string[]).map((key) => rpc.getEnsText({ name, key })),
  );
  return parseAgent(name, { description: description ?? null, endpoint: endpoint ?? null, topics: topics ?? null }, allowLocal);
}

/**
 * Discover helpers at runtime from ENS: read the directory name's list record, then
 * each listed name's own records. A malformed or unreachable agent is skipped;
 * discovery continues for the others.
 */
export async function discover(
  directoryName: string,
  rpc: PublicClient = defaultClient(),
  allowLocal: boolean = allowLocalEndpoints(),
): Promise<Discovery> {
  const result: Discovery = { agents: [], skipped: [], discoveredAt: Date.now() };
  const listed = parseDirectoryList(await rpc.getEnsText({ name: normalizeEnsName(directoryName), key: DIRECTORY_KEY }));

  const names: string[] = [];
  for (const raw of listed) {
    try {
      const name = normalizeEnsName(raw);
      if (!names.includes(name)) names.push(name);
    } catch {
      result.skipped.push({ name: raw.slice(0, 64), reason: "invalid-name" });
    }
  }

  const settled = await Promise.allSettled(names.map((n) => readAgent(n, rpc, allowLocal)));
  settled.forEach((s, i) => {
    const name = names[i]!;
    if (s.status === "rejected") result.skipped.push({ name, reason: "lookup-failed" });
    else if (s.value === null) result.skipped.push({ name, reason: "malformed-record" });
    else result.agents.push(s.value);
  });
  return result;
}

let cache: { key: string; value: Discovery } | undefined;
let building: Promise<Discovery> | undefined;

/** Cached discovery for the configured directory; new helpers appear within AGENTS_TTL_MS, no deploy. */
export async function getAgents(): Promise<Discovery> {
  const dir = loadDirectoryName();
  if (!dir) throw new Error("DIRECTORY_NAME is not configured.");
  if (cache && cache.key === dir && Date.now() - cache.value.discoveredAt < loadAgentsTtlMs()) return cache.value;
  building ??= discover(dir)
    .then((v) => ((cache = { key: dir, value: v }), v))
    .finally(() => (building = undefined));
  return building;
}
