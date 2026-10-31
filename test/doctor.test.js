import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { delimiter } from "node:path";
import { test } from "node:test";
import { run, sandbox } from "./helpers.js";

function setup() {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  const cli = (args, env) => run(box.project, box.home, args, undefined, env);
  return { ...box, cli };
}

test("doctor runs every wired hook and the MCP server", () => {
  const { bin, cli } = setup();
  cli(["init", "--agents", "claude,codex,gemini,cursor,antigravity"]);
  const result = cli(["doctor", "--json"], { PATH: `${bin}${delimiter}${process.env.PATH ?? process.env.Path}` });
  const report = JSON.parse(result.stdout);
  assert.equal(result.code, 0, result.stdout);
  assert.equal(report.ok, true);
  assert.deepEqual(report.checks.map((c) => c.name), [
    "Claude Code session hook",
    "Codex CLI session hook",
    "Gemini CLI session hook",
    "Cursor session hook",
    "Antigravity CLI session hook",
    "MCP server",
  ]);
  assert.match(report.checks.at(-1).detail, /5 tools/);
});

test("doctor fails loudly when llmmemory is not on the agent's PATH", () => {
  const { dir, cli } = setup();
  cli(["init", "--no-mcp"]);
  // A PATH with nothing on it: the shell itself is found without one.
  const result = cli(["doctor"], { PATH: dir });
  assert.equal(result.code, 1);
  assert.match(result.stdout, /FAIL  Claude Code session hook\s+llmmemory is not on the PATH/);
});

test("doctor says so when nothing is wired", () => {
  const { cli } = setup();
  const result = cli(["doctor"]);
  assert.equal(result.code, 1);
  assert.match(result.stdout, /Nothing is wired/);
});
