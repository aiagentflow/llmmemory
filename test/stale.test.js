import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { sessionContext } from "../dist/context.js";
import { staleSince } from "../dist/store.js";
import { run, sandbox } from "./helpers.js";

const NOW = new Date("2026-10-29T00:00:00Z");

function memory(name, updated) {
  return { name, description: `About ${name}.`, tags: [], created: updated, updated, body: "x", scope: "project", path: "" };
}

test("memories untouched for about six months are marked stale", () => {
  assert.equal(staleSince(memory("old", "2026-03-01T00:00:00Z"), NOW), "2026-03");
  assert.equal(staleSince(memory("fresh", "2026-09-01T00:00:00Z"), NOW), undefined);
  assert.equal(staleSince(memory("hand-written", ""), NOW), undefined);
});

test("the session index marks stale memories and says what that means", () => {
  const text = sessionContext([memory("old", "2026-03-01T00:00:00Z"), memory("fresh", "2026-10-01T00:00:00Z")], true, NOW);
  assert.match(text, /^- old: About old\. \(updated 2026-03\)$/m);
  assert.match(text, /^- fresh: About fresh\.$/m);
  assert.match(text, /has not changed in months/);
  assert.doesNotMatch(sessionContext([memory("fresh", "2026-10-01T00:00:00Z")], true, NOW), /has not changed in months/);
});

test("the index stays within its size cap with stale markers", () => {
  const many = Array.from({ length: 500 }, (_, i) => memory(`memory-number-${i}`, "2025-01-01T00:00:00Z"));
  const lines = sessionContext(many, true, NOW).split("\n").filter((l) => l.startsWith("- "));
  assert.ok(lines.join("\n").length <= 6000);
  assert.ok(lines.length < 500);
});

test("list shows when a stale memory was last updated", () => {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  run(box.project, box.home, ["init", "--no-mcp"]);
  writeFileSync(
    join(box.project, ".llmmemory", "memories", "old-fact.md"),
    "---\nname: old-fact\ndescription: An old fact.\ncreated: 2020-01-05T00:00:00Z\nupdated: 2020-01-05T00:00:00Z\n---\n\nAn old fact.\n",
  );
  run(box.project, box.home, ["add", "A new fact."]);
  const listed = run(box.project, box.home, ["list"]).stdout;
  assert.match(listed, /^old-fact  project  updated 2020-01\n/m);
  assert.match(listed, /^a-new-fact  project\n/m);
});
