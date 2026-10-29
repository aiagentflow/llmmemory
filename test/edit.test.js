import assert from "node:assert/strict";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, sandbox } from "./helpers.js";

function setup() {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  // An editor that appends a line, standing in for a person typing.
  const append = join(box.dir, "append-editor");
  writeFileSync(append, '#!/bin/sh\necho "Also on Fridays." >> "$1"\n');
  chmodSync(append, 0o755);
  const cli = (args, env = {}) => run(box.project, box.home, args, undefined, { VISUAL: "", EDITOR: append, ...env });
  cli(["init", "--no-mcp"]);
  cli(["add", "Deploys run on Thursdays.", "--name", "deploys"]);
  cli(["add", "Deploys are fine any day.", "--name", "deploys", "--global"]);
  return { ...box, cli };
}

test("edit opens the memory and refreshes its updated date only when it changed", () => {
  const { project, home, cli } = setup();
  const path = join(project, ".llmmemory", "memories", "deploys.md");
  const before = JSON.parse(cli(["show", "deploys", "--json"]).stdout);

  assert.match(cli(["edit", "deploys", "--json"], { EDITOR: "true" }).stdout, /"changed":false/);
  assert.equal(JSON.parse(cli(["show", "deploys", "--json"]).stdout).updated, before.updated);

  // An editor with flags runs through the shell.
  assert.match(cli(["edit", "deploys"], { EDITOR: "true --wait" }).stdout, /No changes to "deploys"/);

  assert.match(cli(["edit", "deploys"]).stdout, /Updated project memory "deploys"/);
  const after = JSON.parse(cli(["show", "deploys", "--json"]).stdout);
  assert.equal(after.body, "Deploys run on Thursdays.\nAlso on Fridays.");
  assert.equal(after.created, before.created);
  assert.ok(after.updated > before.updated);
  assert.match(readFileSync(path, "utf8"), /^---\nname: deploys\n/);

  cli(["edit", "deploys", "--global"]);
  assert.match(readFileSync(join(home, "memories", "deploys.md"), "utf8"), /any day\.\nAlso on Fridays\./);
});

test("edit fails clearly for an unknown name or a broken editor", () => {
  const { cli } = setup();
  assert.match(cli(["edit", "nope"]).stderr, /No memory named "nope"/);
  assert.match(cli(["edit", "deploys"], { EDITOR: "no-such-editor-xyz" }).stderr, /Could not run the editor "no-such-editor-xyz"/);
  assert.match(cli(["edit"]).stderr, /edit needs a name/);
});
