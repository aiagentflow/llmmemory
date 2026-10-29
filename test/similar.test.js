import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { test } from "node:test";
import { callTool } from "../dist/mcp.js";
import { similar } from "../dist/search.js";
import { run, sandbox } from "./helpers.js";

function memory(name, body) {
  return { name, description: body, tags: [], created: "", updated: "", body, scope: "project", path: "" };
}

test("similar finds a fact restated, not one that shares a word", () => {
  const store = [memory("staging-deploys", "Staging deploys happen on Thursdays after 14:00 UTC."), memory("tone", "Keep answers short.")];
  assert.equal(similar(store, "Deploys to staging happen Thursdays after 14:00.")?.name, "staging-deploys");
  assert.equal(similar(store, "The staging database is Postgres 16."), undefined);
  assert.equal(similar([], "Anything."), undefined);
});

function project() {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  const cli = (args) => run(box.project, box.home, args);
  cli(["init", "--no-mcp"]);
  cli(["add", "Staging deploys happen on Thursdays after 14:00 UTC."]);
  return { ...box, cli };
}

test("add saves a near-copy but names the memory it repeats", () => {
  const { cli } = project();
  const near = cli(["add", "Deploys to staging happen Thursdays after 14:00."]);
  assert.equal(near.code, 0);
  assert.match(near.stdout, /looks close to "staging-deploys-happen-on-thursdays".*--name staging-deploys-happen-on-thursdays/s);
  assert.equal(JSON.parse(cli(["list", "--json"]).stdout).length, 2);

  assert.doesNotMatch(cli(["add", "The staging database is Postgres 16."]).stdout, /looks close/);
  // Updating by name is the fix, so it never warns.
  const update = cli(["add", "Staging deploys happen on Thursdays after 15:00 UTC.", "--name", "staging-deploys-happen-on-thursdays"]);
  assert.doesNotMatch(update.stdout, /looks close/);
  assert.equal(JSON.parse(cli(["add", "Deploys to staging run Thursdays after 14:00 UTC.", "--json"]).stdout).similar !== undefined, true);
});

test("remember tells the agent about a near-copy", () => {
  const { project: root } = project();
  const text = callTool(root, "remember", { fact: "Deploys to staging happen Thursdays after 14:00." });
  assert.match(text, /^Saved project memory ".+"\. It looks close to "staging-deploys-happen-on-thursdays".*call remember with name/);
});
