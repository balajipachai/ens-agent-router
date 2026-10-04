import { test } from "node:test";
import assert from "node:assert/strict";
import { HELPERS } from "../agents/serve.ts";

test("the three helpers are distinct specialists on distinct endpoints", () => {
  assert.equal(HELPERS.length, 3);
  assert.equal(new Set(HELPERS.map((h) => h.port)).size, 3);
  assert.equal(new Set(HELPERS.map((h) => h.system)).size, 3);
});

test("each helper carries its own domain grounding", () => {
  const byId = Object.fromEntries(HELPERS.map((h) => [h.id, h.system]));
  assert.match(byId.contracts!, /NDA|liability|net 30/);
  assert.match(byId.brand!, /tagline|house style/i);
  assert.match(byId.invoices!, /ledger|#1042/);
  // Domain knowledge does not leak across helpers.
  assert.doesNotMatch(byId.brand!, /ledger|liability/);
  assert.doesNotMatch(byId.invoices!, /House style|liability/i);
  assert.doesNotMatch(byId.contracts!, /ledger|House style/);
});
