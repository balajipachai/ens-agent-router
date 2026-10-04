import { loadLlmConfig, type LlmConfig } from "./config.ts";
import type { ChatMessage } from "./prompt.ts";

export class LlmUnavailableError extends Error {}

/**
 * Call an OpenAI-compatible chat completions endpoint with an explicit timeout.
 * The API key is optional so keyless local providers (e.g. Ollama) work.
 */
export async function chat(
  messages: ChatMessage[],
  config: LlmConfig = loadLlmConfig(),
): Promise<string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: config.model, messages, temperature: 0.3 }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw err;
    throw new LlmUnavailableError("Could not reach the model provider. Check LLM_BASE_URL.");
  }
  if (res.status === 401 || res.status === 403) {
    throw new LlmUnavailableError("The model provider rejected the request. Set LLM_API_KEY, or use a free/local provider (see .env.example).");
  }
  if (!res.ok) throw new LlmUnavailableError(`Model provider returned HTTP ${res.status}.`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new LlmUnavailableError("Model provider returned no content.");
  return text.trim();
}
