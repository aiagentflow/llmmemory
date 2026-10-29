import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, sandbox } from "./helpers.js";

const CLAUDE_MD = `# Project notes

## Commit rules

- Small focused commits.
- Never skip hooks.

\`\`\`sh
# not a heading, it is inside a fence
git commit
\`\`\`

## Empty section

## Deploys

Deploys go through scripts/ship.sh.
### Staging

Staging is heron-7.
`;

function setup() {
  const box = sandbox();
  mkdirSync(box.project, { recursive: true });
  const config = join(box.dir, "claude-config");
  const env = { CLAUDE_CONFIG_DIR: config };
  const cli = (args) => run(box.project, box.home, args, undefined, env);
  cli(["init", "--no-mcp"]);
  writeFileSync(join(box.project, "CLAUDE.md"), CLAUDE_MD);
  const auto = join(config, "projects", box.project.replace(/[^a-zA-Z0-9]/g, "-"), "memory");
  mkdirSync(auto, { recursive: true });
  writeFileSync(join(auto, "MEMORY.md"), "- [Billing](polar-billing.md) — the index\n");
  writeFileSync(
    join(auto, "polar-billing.md"),
    '---\nname: polar-billing\ndescription: "Billing runs on Polar, not Stripe"\nmetadata:\n  type: project\n---\n\nBilling runs on Polar.\n',
  );
  return { ...box, cli, auto };
}

test("import splits CLAUDE.md by section and keeps Claude auto-memory as it is", () => {
  const { project, cli, auto } = setup();
  const before = readFileSync(join(project, "CLAUDE.md"), "utf8");

  const dry = JSON.parse(cli(["import", "--dry-run", "--json"]).stdout);
  assert.deepEqual(dry.map((r) => [r.name, r.status]), [
    ["claude-commit-rules", "imported"],
    ["claude-deploys", "imported"],
    ["polar-billing", "imported"],
  ]);
  assert.deepEqual(JSON.parse(cli(["list", "--json"]).stdout), []);

  assert.equal(cli(["import"]).code, 0);
  const listed = JSON.parse(cli(["list", "--json"]).stdout);
  const billing = listed.find((m) => m.name === "polar-billing");
  assert.equal(billing.description, "Billing runs on Polar, not Stripe");
  assert.equal(billing.body, "Billing runs on Polar.");
  const deploys = listed.find((m) => m.name === "claude-deploys");
  assert.match(deploys.body, /^Deploys\n\nDeploys go through scripts\/ship\.sh\.\n### Staging/);
  assert.deepEqual(deploys.tags, ["imported", "claude"]);
  assert.match(listed.find((m) => m.name === "claude-commit-rules").body, /# not a heading/);

  // Running it again adds nothing, and the sources are untouched.
  const again = cli(["import"]);
  assert.match(again.stdout, /Imported 0 project memories, 3 already saved\./);
  assert.equal(JSON.parse(cli(["list", "--json"]).stdout).length, 3);
  assert.equal(readFileSync(join(project, "CLAUDE.md"), "utf8"), before);
  assert.match(readFileSync(join(auto, "polar-billing.md"), "utf8"), /^---\nname: polar-billing/);
});

test("import takes paths and --global", () => {
  const { dir, cli } = setup();
  const file = join(dir, "notes.md");
  writeFileSync(file, "Prefers short answers.\n");
  assert.equal(cli(["import", file, "--global"]).code, 0);
  const listed = JSON.parse(cli(["list", "--global", "--json"]).stdout);
  assert.deepEqual(listed.map((m) => [m.name, m.body]), [["notes", "Prefers short answers."]]);
  assert.match(cli(["import", join(dir, "missing.md")]).stderr, /No such file or directory/);

  // With several # headings, a ## section keeps its parent in its name.
  const agents = join(dir, "AGENTS.md");
  writeFileSync(agents, "# Commit\n\n## Rules\n\nStage files by name.\n\n# Style\n\nNo em-dashes.\n");
  const dry = JSON.parse(cli(["import", agents, "--dry-run", "--json"]).stdout);
  assert.deepEqual(dry.map((r) => r.name), ["agents-commit-rules", "agents-style"]);
  assert.equal(dry[0].fact, "Commit: Rules\n\nStage files by name.");
});
