import { loadLlmConfig, type LlmConfig } from "./config.ts";
import type { ChatMessage } from "./prompt.ts";

export class LlmUnavailableError extends Error {}

/** Call an OpenAI-compatible chat completions endpoint with an explicit timeout. */
export async function chat(
  messages: ChatMessage[],
  config: LlmConfig = loadLlmConfig(),
): Promise<string> {
  if (!config.apiKey) {
    throw new LlmUnavailableError("LLM_API_KEY is not configured on the server.");
  }
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
    signal: AbortSignal.timeout(config.timeoutMs),
  });
  if (!res.ok) {
    throw new LlmUnavailableError(`Model provider returned HTTP ${res.status}.`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new LlmUnavailableError("Model provider returned no content.");
  return text.trim();
}
