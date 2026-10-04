import { z } from "zod";
import { chat } from "./llm.ts";
import { buildMessages, type ChatMessage } from "./prompt.ts";
import type { Agent } from "./agent.ts";

export type Decision =
  | { status: "chosen"; agent: Agent; reason: string }
  | { status: "no-agent"; message: string };

export const NO_AGENT_MESSAGE = "No available helper is suited to that question.";
const outputSchema = z.object({ agent: z.string().nullable(), reason: z.string().optional() });

function parseModelJson(text: string): z.infer<typeof outputSchema> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = outputSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Ask the model to pick a helper, then verify the pick is one of the discovered agents. */
export async function route(
  question: string,
  agents: Agent[],
  deps: { chat: (m: ChatMessage[]) => Promise<string> } = { chat: (m) => chat(m) },
): Promise<Decision> {
  // Explicit no-agent branch: nothing discovered, nothing to route to.
  if (agents.length === 0) return { status: "no-agent", message: NO_AGENT_MESSAGE };

  const output = parseModelJson(await deps.chat(buildMessages(question, agents)));
  const picked = output?.agent?.trim().toLowerCase();
  // Membership check: refuse anything the model names that was not discovered from ENS.
  const agent = picked ? agents.find((a) => a.name === picked) : undefined;
  if (!agent) return { status: "no-agent", message: NO_AGENT_MESSAGE };

  return { status: "chosen", agent, reason: (output?.reason ?? "").replace(/\s+/g, " ").trim().slice(0, 200) };
}
