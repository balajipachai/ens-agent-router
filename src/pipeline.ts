import type { Agent } from "./agent.ts";
import { getAgents, type Discovery } from "./directory.ts";
import { forward, ForwardError } from "./forward.ts";
import { chat } from "./llm.ts";
import type { ChatMessage } from "./prompt.ts";
import { route, type Decision } from "./router.ts";

export interface Deps {
  discover: () => Promise<Discovery>;
  chat: (m: ChatMessage[]) => Promise<string>;
  forward: (agent: Agent, question: string) => Promise<string>;
}

const defaultDeps: Deps = {
  discover: getAgents,
  chat: (m) => chat(m),
  forward: (a, q) => forward(a, q),
};

export type Outcome =
  | { status: "answered"; agent: { name: string; description: string }; reason: string; answer: string; agentsConsidered: number }
  | { status: "no-agent"; message: string; agentsConsidered: number }
  | { status: "agent-error"; agent: { name: string; description: string }; message: string; agentsConsidered: number };

export async function handleQuestion(question: string, deps: Deps = defaultDeps): Promise<Outcome> {
  const { agents } = await deps.discover();
  const decision: Decision = await route(question, agents, { chat: deps.chat });

  if (decision.status === "no-agent") {
    return { status: "no-agent", message: decision.message, agentsConsidered: agents.length };
  }
  const who = { name: decision.agent.name, description: decision.agent.description };
  try {
    const answer = await deps.forward(decision.agent, question);
    return { status: "answered", agent: who, reason: decision.reason, answer, agentsConsidered: agents.length };
  } catch (err) {
    if (err instanceof ForwardError) return { status: "agent-error", agent: who, message: err.message, agentsConsidered: agents.length };
    throw err;
  }
}
