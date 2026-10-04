import { test } from "node:test";
import assert from "node:assert/strict";
import { discover } from "../src/directory.ts";
import { forward, ForwardError } from "../src/forward.ts";
import { handleQuestion, type Deps } from "../src/pipeline.ts";
import { fakeRpc } from "./helpers.ts";

const discovery = await discover("studio.eth", fakeRpc(), false);
const pick = (name: string | null) => async () => JSON.stringify({ agent: name, reason: "because" });

function deps(over: Partial<Deps>): Deps {
  return { discover: async () => discovery, chat: pick("invoices.eth"), forward: async () => "ok", ...over };
}

test("the forwarded URL is the one read from the chosen agent's ENS record", async () => {
  const seen: string[] = [];
  const fakeFetch = (async (url: URL, init: RequestInit) => {
    seen.push(String(url));
    assert.ok(init.signal, "request must carry a timeout signal");
    assert.equal(init.redirect, "error");
    return new Response(JSON.stringify({ answer: "14 days overdue" }), { status: 200 });
  }) as unknown as typeof fetch;

  const out = await handleQuestion("overdue invoice?", deps({
    forward: (a, q) => forward(a, q, { fetchImpl: fakeFetch, allowLocal: false, timeoutMs: 1000 }),
  }));
  assert.deepEqual(seen, ["https://invoices.example.com/ask"]);
  assert.equal(out.status === "answered" && out.agent.name, "invoices.eth");
  assert.equal(out.status === "answered" && out.answer, "14 days overdue");
});

test("a non-https endpoint is never called", async () => {
  let called = false;
  const fakeFetch = (async () => ((called = true), new Response("x"))) as unknown as typeof fetch;
  const agent = { ...discovery.agents[0]!, endpoint: "http://evil.example.com/ask" };
  await assert.rejects(forward(agent, "q", { fetchImpl: fakeFetch, allowLocal: false }), ForwardError);
  assert.equal(called, false);
});

test("a hung helper is cut off by the timeout", async () => {
  const hang = ((_u: URL, init: RequestInit) =>
    new Promise((_, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)))) as unknown as typeof fetch;
  await assert.rejects(forward(discovery.agents[0]!, "q", { fetchImpl: hang, allowLocal: false, timeoutMs: 20 }), /too long/);
});

test("when the model picks nobody (or someone undiscovered) nothing is forwarded", async () => {
  for (const choice of [null, "ghost.eth"]) {
    let forwarded = false;
    const out = await handleQuestion("unrelated", deps({ chat: pick(choice), forward: async () => ((forwarded = true), "x") }));
    assert.equal(out.status, "no-agent");
    assert.equal(forwarded, false);
  }
});

test("helper failure is reported with the helper's name, not as a crash", async () => {
  const out = await handleQuestion("q", deps({ forward: async () => { throw new ForwardError("The helper could not be reached."); } }));
  assert.equal(out.status, "agent-error");
  assert.equal(out.status === "agent-error" && out.agent.name, "invoices.eth");
});
