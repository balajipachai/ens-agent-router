import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

test("router source contains no literal ENS names or agent endpoints", () => {
  const dir = new URL("../src/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const text = readFileSync(new URL(file, dir), "utf8");
    assert.ok(!/["'`][a-z0-9-]+(\.[a-z0-9-]+)*\.eth["'`]/i.test(text), `${file} has an ENS name literal`);
    assert.ok(!/https?:\/\/(?!api\.openai\.com)[a-z0-9.-]+\.[a-z]{2,}/i.test(text.replace(/\/\/ .*/g, "")), `${file} has a URL literal`);
  }
});
