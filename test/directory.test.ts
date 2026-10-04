import { test } from "node:test";
import assert from "node:assert/strict";
import { discover } from "../src/directory.ts";
import { FIXTURES, fakeRpc } from "./helpers.ts";

test("agents come from ENS records; endpoints are the ones each agent published", async () => {
  const d = await discover("studio.eth", fakeRpc(), false);
  const byName = Object.fromEntries(d.agents.map((a) => [a.name, a.endpoint]));
  assert.equal(byName["invoices.eth"], "https://invoices.example.com/ask");
  assert.equal(byName["contracts.eth"], "https://contracts.example.com/ask");
});

test("malformed, insecure, invalid and unreachable agents are skipped; the rest are discovered", async () => {
  const d = await discover("studio.eth", fakeRpc(), false);
  assert.deepEqual(d.agents.map((a) => a.name).sort(), ["brand.eth", "contracts.eth", "invoices.eth"]);
  const reasons = Object.fromEntries(d.skipped.map((s) => [s.name, s.reason]));
  assert.equal(reasons["broken.eth"], "malformed-record");
  assert.equal(reasons["bad-url.eth"], "malformed-record");
  assert.equal(reasons["unreachable.eth"], "lookup-failed");
  assert.equal(reasons["Not A Name"], "invalid-name");
});

test("an unset directory yields no agents rather than an error", async () => {
  const d = await discover("studio.eth", fakeRpc({ "studio.eth": {} }), false);
  assert.deepEqual(d.agents, []);
});

test("a helper published later is picked up with no code change", async () => {
  const data = structuredClone(FIXTURES);
  const before = await discover("studio.eth", fakeRpc(data), false);
  assert.ok(!before.agents.some((a) => a.name === "late.eth"));

  data["studio.eth"]!["app.agent-router.agents"] += ", late.eth";
  const after = await discover("studio.eth", fakeRpc(data), false);
  assert.ok(after.agents.some((a) => a.name === "late.eth"));
});
