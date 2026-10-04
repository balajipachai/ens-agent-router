export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string | undefined;
  timeoutMs: number;
}

function positiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function loadLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  return {
    baseUrl: (env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: env.LLM_MODEL || "gpt-4o-mini",
    apiKey: env.LLM_API_KEY || undefined,
    timeoutMs: positiveInt(env.LLM_TIMEOUT_MS, 20_000),
  };
}

export const loadPort = (env: NodeJS.ProcessEnv = process.env) => positiveInt(env.PORT, 3000);
export const loadAgentTimeoutMs = (env: NodeJS.ProcessEnv = process.env) => positiveInt(env.AGENT_TIMEOUT_MS, 15_000);
export const loadAgentsTtlMs = (env: NodeJS.ProcessEnv = process.env) => positiveInt(env.AGENTS_TTL_MS, 60_000);
export const allowLocalEndpoints = (env: NodeJS.ProcessEnv = process.env) => env.ALLOW_LOCALHOST_ENDPOINTS === "true";
export const loadDirectoryName = (env: NodeJS.ProcessEnv = process.env) => env.DIRECTORY_NAME?.trim() || undefined;
