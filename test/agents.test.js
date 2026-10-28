import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, sandbox } from "./helpers.js";

function project() {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  const cli = (args, input) => run(box.project, box.home, args, input);
  const json = (file) => JSON.parse(readFileSync(join(box.project, file), "utf8"));
  return { ...box, cli, json };
}

const ALL = "claude,codex,gemini,cursor,antigravity";

test("init wires every agent in its own config format", () => {
  const { project: root, cli, json } = project();
  const result = cli(["init", "--agents", ALL, "--json"]);
  assert.equal(result.code, 0);
  const agents = JSON.parse(result.stdout).agents;
  assert.deepEqual(agents.codex, { session: true, prompt: true, mcp: true });
  assert.deepEqual(agents.gemini, { session: true, prompt: true, mcp: true });
  assert.deepEqual(agents.cursor, { session: true, prompt: null, mcp: true });
  assert.deepEqual(agents.antigravity, { session: true, prompt: null, mcp: true });

  const codexHooks = json(".codex/hooks.json").hooks;
  assert.equal(codexHooks.UserPromptSubmit[0].hooks[0].command, "llmmemory prompt --agent codex");
  assert.match(readFileSync(join(root, ".codex/config.toml"), "utf8"), /\[mcp_servers\.llmmemory\]\ncommand = "llmmemory"\nargs = \["mcp"\]/);

  const gemini = json(".gemini/settings.json");
  assert.equal(gemini.hooks.BeforeAgent[0].hooks[0].command, "llmmemory prompt --agent gemini");
  assert.deepEqual(gemini.mcpServers.llmmemory, { command: "llmmemory", args: ["mcp"] });

  const cursor = json(".cursor/hooks.json");
  assert.equal(cursor.version, 1);
  assert.deepEqual(cursor.hooks.sessionStart, [{ command: "llmmemory session-start --agent cursor" }]);
  assert.ok(json(".cursor/mcp.json").mcpServers.llmmemory);

  assert.deepEqual(json(".agents/hooks.json").llmmemory, {
    SessionStart: [{ type: "command", command: "llmmemory session-start --agent antigravity" }],
  });
  assert.ok(json(".agents/mcp_config.json").mcpServers.llmmemory);
  assert.match(JSON.parse(result.stdout).notes[0], /\/hooks in Codex/);
});

test("by default init wires Claude Code plus the agents the project already uses", () => {
  const { project: root, cli } = project();
  mkdirSync(join(root, ".gemini"));
  mkdirSync(join(root, ".cursor"));
  const agents = JSON.parse(cli(["init", "--json"]).stdout).agents;
  assert.deepEqual(Object.keys(agents), ["claude", "gemini", "cursor"]);
  assert.equal(existsSync(join(root, ".codex")), false);
});

test("init rejects an unknown agent", () => {
  const { cli } = project();
  const result = cli(["init", "--agents", "claude,copilot"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown agent: copilot/);
});

test("Codex's config.toml keeps everything else when llmmemory comes and goes", () => {
  const { project: root, cli } = project();
  mkdirSync(join(root, ".codex"));
  const original = 'model = "gpt-5"\n\n[mcp_servers.other]\ncommand = "other"\n';
  writeFileSync(join(root, ".codex/config.toml"), original);
  cli(["init", "--agents", "codex"]);
  cli(["init", "--agents", "codex"]);
  const text = readFileSync(join(root, ".codex/config.toml"), "utf8");
  assert.equal(text.match(/\[mcp_servers\.llmmemory\]/g).length, 1);
  cli(["clean"]);
  assert.equal(readFileSync(join(root, ".codex/config.toml"), "utf8"), original);
});

test("clean unwires every agent and keeps other hooks", () => {
  const { project: root, cli, json } = project();
  mkdirSync(join(root, ".cursor"));
  writeFileSync(join(root, ".cursor/hooks.json"), JSON.stringify({ version: 1, hooks: { sessionStart: [{ command: "mine" }] } }));
  cli(["init", "--agents", ALL]);
  const result = cli(["clean", "--json"]);
  assert.deepEqual(JSON.parse(result.stdout).unwired, ["claude", "codex", "gemini", "cursor", "antigravity"]);
  assert.deepEqual(json(".cursor/hooks.json").hooks, { sessionStart: [{ command: "mine" }] });
  assert.deepEqual(json(".agents/hooks.json"), {});
  assert.deepEqual(json(".gemini/settings.json"), { mcpServers: {} });
  const status = JSON.parse(cli(["status", "--json"]).stdout).agents;
  assert.ok(Object.values(status).every((w) => !w.session && !w.mcp && w.prompt !== true));
});

function sessionContext(stdout, agent) {
  const out = JSON.parse(stdout);
  if (agent === "cursor") return out.additional_context;
  if (agent === "antigravity") return out.injectSteps[0].systemMessage.systemMessage;
  assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
  return out.hookSpecificOutput.additionalContext;
}

test("each agent gets the memory index in the shape it reads", () => {
  const { project: root, cli } = project();
  cli(["init", "--agents", ALL]);
  cli(["add", "Deploys go through ship.sh.", "--tags", "deploy"]);
  const payloads = {
    claude: { cwd: root },
    codex: { cwd: root, source: "startup" },
    gemini: { cwd: root, source: "startup" },
    cursor: { conversation_id: "c1", workspace_roots: [root] },
    antigravity: { conversationId: "a1", workspacePaths: [root] },
  };
  for (const [agent, payload] of Object.entries(payloads)) {
    const result = run("/", process.env.LLMMEMORY_HOME, ["session-start", "--agent", agent], JSON.stringify(payload));
    assert.equal(result.code, 0, agent);
    const text = sessionContext(result.stdout, agent);
    assert.match(text, /deploys-go-through-ship-sh/, agent);
    // Agents without a per-message hook are told to look memories up themselves.
    const auto = agent === "claude" || agent === "codex" || agent === "gemini";
    assert.equal(/added to it automatically/.test(text), auto, agent);
    assert.equal(/Only this index is loaded/.test(text), !auto, agent);
  }
});

test("Codex and Gemini CLI recall memories for each message", () => {
  const { project: root, cli } = project();
  cli(["init", "--agents", "codex,gemini"]);
  cli(["add", "Deploys go through ship.sh.", "--tags", "deploy"]);
  for (const [agent, event] of [["codex", "UserPromptSubmit"], ["gemini", "BeforeAgent"]]) {
    const payload = { session_id: randomUUID(), cwd: root, prompt: "how do I deploy?" };
    const out = JSON.parse(cli(["prompt", "--agent", agent], JSON.stringify(payload)).stdout);
    assert.equal(out.hookSpecificOutput.hookEventName, event);
    assert.match(out.hookSpecificOutput.additionalContext, /<memory name="deploys-go-through-ship-sh"/);
  }
});

test("an unknown --agent on a hook falls back to Claude Code instead of failing", () => {
  const { project: root, cli } = project();
  cli(["init", "--no-mcp"]);
  const result = cli(["session-start", "--agent", "nope"], JSON.stringify({ cwd: root }));
  assert.equal(result.code, 0);
  assert.equal(JSON.parse(result.stdout).hookSpecificOutput.hookEventName, "SessionStart");
});
