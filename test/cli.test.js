import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, sandbox } from "./helpers.js";

function project() {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  const cli = (args, input, cwd = box.project) => run(cwd, box.home, args, input);
  return { ...box, cli };
}

test("init wires both hooks and the MCP server, keeping what was there", () => {
  const { project: root, cli } = project();
  mkdirSync(join(root, ".claude"));
  writeFileSync(
    join(root, ".claude", "settings.json"),
    JSON.stringify({ model: "opus", hooks: { SessionStart: [{ hooks: [{ type: "command", command: "other" }] }] } }),
  );
  writeFileSync(join(root, ".mcp.json"), JSON.stringify({ mcpServers: { other: { command: "x" } } }));

  assert.equal(cli(["init"]).code, 0);
  const settings = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
  assert.equal(settings.model, "opus");
  assert.deepEqual(
    settings.hooks.SessionStart.flatMap((g) => g.hooks.map((h) => h.command)),
    ["other", "llmmemory session-start"],
  );
  assert.equal(settings.hooks.UserPromptSubmit[0].hooks[0].command, "llmmemory prompt");
  const mcp = JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8"));
  assert.deepEqual(Object.keys(mcp.mcpServers), ["other", "llmmemory"]);

  // Running it again adds nothing twice.
  cli(["init"]);
  const again = JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8"));
  assert.equal(again.hooks.SessionStart.length, 2);

  const status = JSON.parse(cli(["status", "--json"]).stdout);
  assert.deepEqual(status.agents.claude, { session: true, prompt: true, mcp: true });
  assert.deepEqual(status.agents.cursor, { session: false, prompt: null, mcp: false });
});

test("init refuses to overwrite settings it cannot parse", () => {
  const { project: root, cli } = project();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude", "settings.json"), "{ not json");
  const result = cli(["init"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /will not overwrite/);
  assert.equal(readFileSync(join(root, ".claude", "settings.json"), "utf8"), "{ not json");
});

test("init --no-mcp leaves .mcp.json alone", () => {
  const { project: root, cli } = project();
  cli(["init", "--no-mcp"]);
  assert.equal(existsSync(join(root, ".mcp.json")), false);
});

test("add, list, search, show and forget work from a subdirectory", () => {
  const { project: root, cli } = project();
  cli(["init", "--no-mcp"]);
  const sub = join(root, "src", "deep");
  mkdirSync(sub, { recursive: true });

  assert.equal(cli(["add", "Deploys", "run", "through", "ship.sh.", "--tags", "deploy,ci"], undefined, sub).code, 0);
  assert.equal(cli(["add", "-", "--global", "--name", "tone"], "Keep answers short.\n", sub).code, 0);
  assert.ok(existsSync(join(root, ".llmmemory", "memories", "deploys-run-through-ship-sh.md")));

  const listed = JSON.parse(cli(["list", "--json"], undefined, sub).stdout);
  assert.deepEqual(listed.map((m) => [m.name, m.scope]), [["deploys-run-through-ship-sh", "project"], ["tone", "global"]]);

  assert.match(cli(["search", "deploy"], undefined, sub).stdout, /^deploys-run-through-ship-sh  project  \[deploy, ci\]  score [\d.]+\n  Deploys run through ship\.sh\./);
  assert.match(cli(["show", "tone"], undefined, sub).stdout, /Keep answers short\./);
  assert.equal(cli(["forget", "tone", "--project"], undefined, sub).code, 1);
  assert.equal(cli(["forget", "tone"], undefined, sub).code, 0);
  assert.equal(JSON.parse(cli(["list", "--json"], undefined, sub).stdout).length, 1);
});

test("bad arguments fail with a short message", () => {
  const { cli } = project();
  assert.match(cli(["list", "--bogus"]).stderr, /Unknown option '--bogus'\. Run llmmemory --help/);
  assert.match(cli(["search", "--name", "x"]).stderr, /search does not take --name/);
  assert.match(cli(["add"]).stderr, /add needs a fact/);
  assert.match(cli(["add", "x", "--name", "../x"]).stderr, /Invalid name/);
  assert.equal(cli(["status", "extra"]).code, 1);
  assert.equal(cli(["nope"]).code, 1);
});

test("clean unwires everything and keeps the memories", () => {
  const { project: root, cli } = project();
  mkdirSync(join(root, ".claude"));
  writeFileSync(join(root, ".claude", "settings.json"), JSON.stringify({ model: "opus" }));
  cli(["init"]);
  cli(["add", "Keep me."]);
  assert.equal(cli(["clean"]).code, 0);
  assert.deepEqual(JSON.parse(readFileSync(join(root, ".claude", "settings.json"), "utf8")), { model: "opus" });
  assert.deepEqual(JSON.parse(readFileSync(join(root, ".mcp.json"), "utf8")), { mcpServers: {} });
  assert.ok(existsSync(join(root, ".llmmemory", "memories", "keep-me.md")));
});
