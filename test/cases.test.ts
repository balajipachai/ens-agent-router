import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { discover } from "../src/directory.ts";
import { handleQuestion } from "../src/pipeline.ts";
import { fakeRpc } from "./helpers.ts";

interface Case { id: string; question: string; expectedAgent: string | null }
const { cases } = JSON.parse(readFileSync(new URL("../cases/routing.json", import.meta.url), "utf8")) as { cases: Case[] };
const discovery = await discover("studio.eth", fakeRpc(), false);

// The routing decision itself is made by the model (see `npm run cases`). Offline, we verify that every
// recorded expectation is consistent with discovery and that the pipeline honours a correct decision.
for (const c of cases) {
  test(`recorded case ${c.id}`, async () => {
    if (c.expectedAgent === null) {
      const out = await handleQuestion(c.question, {
        discover: async () => discovery, chat: async () => '{"agent":null}', forward: async () => { throw new Error("must not forward"); },
      });
      assert.equal(out.status, "no-agent");
      return;
    }
    const expected = discovery.agents.find((a) => a.name === c.expectedAgent);
    assert.ok(expected, `${c.expectedAgent} must be discoverable from ENS`);
    let hit = "";
    const out = await handleQuestion(c.question, {
      discover: async () => discovery,
      chat: async () => JSON.stringify({ agent: c.expectedAgent, reason: "fixture" }),
      forward: async (a) => ((hit = a.endpoint), "answer"),
    });
    assert.equal(out.status, "answered");
    assert.equal(hit, expected.endpoint);
  });
}
