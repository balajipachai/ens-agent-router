import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEndpoint, parseAgent, parseDirectoryList } from "../src/agent.ts";

test("https endpoints are accepted", () => {
  assert.equal(checkEndpoint("https://a.example.com/ask", false)?.protocol, "https:");
});

test("non-https endpoints are rejected", () => {
  for (const bad of ["http://a.example.com", "ftp://a.example.com", "javascript:alert(1)", "//a.example.com", "not a url", "", null]) {
    assert.equal(checkEndpoint(bad as string | null, false), null, String(bad));
  }
});

test("http is allowed only for localhost and only when explicitly enabled", () => {
  assert.equal(checkEndpoint("http://localhost:4001/ask", false), null);
  assert.ok(checkEndpoint("http://localhost:4001/ask", true));
  assert.equal(checkEndpoint("http://evil.example.com", true), null);
});

test("credentials and private-network hosts are rejected", () => {
  assert.equal(checkEndpoint("https://user:pass@a.example.com", false), null);
  for (const host of ["10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "127.0.0.1", "[::1]", "db.internal", "printer.local"]) {
    assert.equal(checkEndpoint(`https://${host}/x`, false), null, host);
  }
});

test("a record missing its endpoint or description is malformed", () => {
  assert.equal(parseAgent("a.eth", { description: "Does useful things for clients", endpoint: null, topics: null }, false), null);
  assert.equal(parseAgent("a.eth", { description: "", endpoint: "https://a.example.com", topics: null }, false), null);
  const ok = parseAgent("a.eth", { description: "Does useful things for clients", endpoint: "https://a.example.com/x", topics: "A, b" }, false);
  assert.deepEqual(ok?.topics, ["a", "b"]);
});

test("directory list is split, trimmed, deduplicated and bounded", () => {
  assert.deepEqual(parseDirectoryList("a.eth, b.eth\nA.eth,, a.eth"), ["a.eth", "b.eth", "A.eth"]);
  assert.equal(parseDirectoryList(Array.from({ length: 200 }, (_, i) => `x${i}.eth`).join(",")).length, 50);
});
