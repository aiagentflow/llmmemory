import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { handle } from "../dist/mcp.js";
import { CLI, sandbox } from "./helpers.js";

function call(root, name, args) {
  return handle(root, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }).result;
}

test("initialize agrees on a protocol version it supports", () => {
  const { project } = sandbox();
  const asked = handle(project, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } });
  assert.equal(asked.result.protocolVersion, "2025-03-26");
  const unknown = handle(project, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
  assert.equal(unknown.result.protocolVersion, "2025-06-18");
  assert.equal(handle(project, { jsonrpc: "2.0", method: "notifications/initialized" }), null);
  assert.equal(handle(project, { jsonrpc: "2.0", id: 3, method: "nope" }).error.code, -32601);
});

test("tools remember, recall, read, list and forget", () => {
  const { project } = sandbox();
  const names = handle(project, { jsonrpc: "2.0", id: 1, method: "tools/list" }).result.tools.map((t) => t.name);
  assert.deepEqual(names, ["remember", "recall", "read_memory", "forget", "list_memories"]);

  assert.match(call(project, "remember", { fact: "Use pnpm in this repo.", tags: ["tooling"] }).content[0].text, /Saved project memory "use-pnpm-in-this-repo"/);
  assert.match(call(project, "remember", { fact: "Use bun now.", name: "use-pnpm-in-this-repo" }).content[0].text, /Updated/);
  assert.match(call(project, "recall", { query: "package manager bun" }).content[0].text, /Use bun now\./);
  assert.match(call(project, "read_memory", { name: "use-pnpm-in-this-repo" }).content[0].text, /tags: tooling/);
  assert.match(call(project, "list_memories", {}).content[0].text, /use-pnpm-in-this-repo \(project\)/);
  assert.match(call(project, "forget", { name: "use-pnpm-in-this-repo" }).content[0].text, /Forgot/);
  assert.equal(call(project, "recall", { query: "bun" }).content[0].text, "No memories match.");
});

test("bad tool input comes back as a tool error, not a crash", () => {
  const { project } = sandbox();
  const missing = call(project, "remember", {});
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /fact must be/);
  assert.equal(call(project, "forget", { name: "../../x" }).isError, true);
  assert.equal(call(project, "remember", { fact: "x", scope: "everywhere" }).isError, true);
});

test("the stdio server answers line by line", async () => {
  const { project, home } = sandbox();
  mkdirSync(join(project, ".llmmemory", "memories"), { recursive: true });
  const child = spawn(process.execPath, [CLI, "mcp"], { cwd: project, env: { ...process.env, LLMMEMORY_HOME: home } });
  const lines = [];
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    const parts = buffer.split("\n");
    buffer = parts.pop();
    lines.push(...parts.filter(Boolean).map((l) => JSON.parse(l)));
  });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  child.stdin.write("{broken\n");
  send({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "remember", arguments: { fact: "Over stdio." } } });
  child.stdin.end();
  await new Promise((resolve) => child.on("close", resolve));

  assert.deepEqual(lines.map((l) => l.id), [1, null, 2]);
  assert.equal(lines[1].error.code, -32700);
  assert.match(lines[2].result.content[0].text, /Saved project memory "over-stdio"/);
});
