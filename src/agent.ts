import { z } from "zod";

// Every helper describes itself on its own ENS name with these text records.
export const AGENT_KEYS = {
  description: "description", // standard ENSIP-5 key: what the helper is for
  endpoint: "app.agent-router.endpoint", // https URL that accepts POST {"question": "..."}
  topics: "app.agent-router.topics", // optional, comma-separated
  input: "app.agent-router.input", // optional: what the helper accepts, in plain words
} as const;

// Record on the directory name listing the helpers' ENS names (comma/newline separated).
export const DIRECTORY_KEY = "app.agent-router.agents";

export const DEFAULT_INPUT = "A plain-text question";

export interface Agent {
  name: string; // normalized ENS name
  description: string;
  topics: string[];
  input: string; // what it accepts
  endpoint: string; // read from the agent's own ENS record
}

export interface RawAgent {
  description: string | null;
  endpoint: string | null;
  topics: string | null;
  input?: string | null;
}

const PRIVATE_V4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const LOCAL_NAMES = /(^localhost$)|(\.localhost$)|(\.local$)|(\.internal$)/;

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    PRIVATE_V4.test(h) || LOCAL_NAMES.test(h) || h.startsWith("[") // any IPv6 literal
  );
}

/**
 * Parse an endpoint value from ENS. Only https is accepted; http is allowed solely
 * for localhost when `allowLocal` is set (development). Credentials in the URL and
 * private-network hosts are rejected.
 */
export function checkEndpoint(value: string | null | undefined, allowLocal: boolean): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === "https:") {
    if (isPrivateHost(url.hostname) && !(allowLocal && isLocalHost(url.hostname))) return null;
    return url;
  }
  if (url.protocol === "http:" && allowLocal && isLocalHost(url.hostname)) return url;
  return null;
}

function cleanText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

const descriptionSchema = z.string().min(5).max(300);

/** Validate raw ENS values. Returns null for a malformed agent so it can be skipped. */
export function parseAgent(name: string, raw: RawAgent, allowLocal: boolean): Agent | null {
  const description = descriptionSchema.safeParse(cleanText(raw.description ?? ""));
  const endpoint = checkEndpoint(raw.endpoint, allowLocal);
  if (!description.success || !endpoint) return null;
  const topics = (raw.topics ?? "")
    .split(",")
    .map((t) => cleanText(t).toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 32)
    .slice(0, 10);
  const input = cleanText(raw.input ?? "").slice(0, 100) || DEFAULT_INPUT;
  return { name, description: description.data, topics, input, endpoint: endpoint.toString() };
}

export function parseDirectoryList(raw: string | null | undefined, max = 50): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, max);
}
