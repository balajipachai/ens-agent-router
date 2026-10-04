// Live check: routes each recorded case with the real model against the fixture studio and
// verifies the chosen helper. Needs LLM_API_KEY. Nothing is forwarded.
import { readFileSync } from "node:fs";
import { discover } from "../src/directory.ts";
import { route } from "../src/router.ts";
import { fakeRpc } from "../test/helpers.ts";

interface Case { id: string; question: string; expectedAgent: string | null }
const { cases } = JSON.parse(readFileSync(new URL("../cases/routing.json", import.meta.url), "utf8")) as { cases: Case[] };
const { agents } = await discover("studio.eth", fakeRpc(), false);

let failures = 0;
for (const c of cases) {
  const d = await route(c.question, agents);
  const got = d.status === "chosen" ? d.agent.name : null;
  const ok = got === c.expectedAgent;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.id}: got ${got} want ${c.expectedAgent}`);
  failures += ok ? 0 : 1;
}
process.exit(failures ? 1 : 0);
