import { allowLocalEndpoints, loadAgentTimeoutMs } from "./config.ts";
import { checkEndpoint, type Agent } from "./agent.ts";

export class ForwardError extends Error {}

const MAX_ANSWER_CHARS = 8000;

/**
 * Forward the question to the chosen agent at the endpoint read from its own ENS record.
 * https only (localhost http allowed in dev), no redirects, explicit timeout.
 */
export async function forward(
  agent: Agent,
  question: string,
  opts: { timeoutMs?: number; allowLocal?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const { timeoutMs = loadAgentTimeoutMs(), allowLocal = allowLocalEndpoints(), fetchImpl = fetch } = opts;
  const url = checkEndpoint(agent.endpoint, allowLocal); // re-checked right before the call
  if (!url) throw new ForwardError("The helper's endpoint is not a safe https URL.");

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/plain" },
      body: JSON.stringify({ question }),
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new ForwardError("The helper took too long to respond.");
    throw new ForwardError("The helper could not be reached.");
  }
  if (!res.ok) throw new ForwardError(`The helper returned HTTP ${res.status}.`);

  const text = (await res.text()).slice(0, MAX_ANSWER_CHARS * 2);
  let answer = text;
  try {
    const json = JSON.parse(text) as { answer?: unknown };
    if (typeof json.answer === "string") answer = json.answer;
  } catch {
    /* plain-text answer */
  }
  answer = answer.trim().slice(0, MAX_ANSWER_CHARS);
  if (!answer) throw new ForwardError("The helper returned an empty answer.");
  return answer;
}
