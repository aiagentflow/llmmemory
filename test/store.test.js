import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  describe as summarize,
  findRoot,
  getMemory,
  listMemories,
  parse,
  removeMemory,
  saveMemory,
  slugify,
  validName,
  writeAtomic,
} from "../dist/store.js";
import { sandbox } from "./helpers.js";

test("slugify keeps a short readable name", () => {
  assert.equal(slugify("Deploys go through scripts/ship.sh, never push to main!"), "deploys-go-through-scripts-ship-sh");
  assert.equal(slugify("???"), "memory");
  assert.equal(slugify("Café über"), "cafe-uber");
});

test("describe takes the first sentence and cuts long ones at a word", () => {
  assert.equal(summarize("Staging server is heron-7. Deploys run on Thursdays."), "Staging server is heron-7. Deploys run on Thursdays.");
  assert.equal(summarize(`A first sentence that is long enough to stand on its own. Second.`), "A first sentence that is long enough to stand on its own.");
  const long = summarize("word ".repeat(40));
  assert.ok(long.length <= 104 && long.endsWith("..."));
});

test("saved memories round-trip through Markdown with frontmatter", () => {
  const { project } = sandbox();
  const { memory } = saveMemory(project, { fact: "Use pnpm, not npm.", tags: ["Tooling", "tooling"], scope: "project" });
  const text = readFileSync(memory.path, "utf8");
  assert.match(text, /^---\nname: use-pnpm-not-npm\ndescription: Use pnpm, not npm\.\ntags: \[tooling\]\n/);
  const [read] = listMemories(project, ["project"]);
  assert.equal(read.body, "Use pnpm, not npm.");
  assert.deepEqual(read.tags, ["tooling"]);
});

test("a taken name gets a number; an explicit name updates in place", () => {
  const { project } = sandbox();
  const first = saveMemory(project, { fact: "Same words.", scope: "project" }, new Date("2026-01-01"));
  const second = saveMemory(project, { fact: "Same words.", scope: "project" });
  assert.equal(second.memory.name, "same-words-2");

  const updated = saveMemory(project, { fact: "New words.", name: "same-words", scope: "project" });
  assert.equal(updated.updated, true);
  assert.equal(updated.memory.created, first.memory.created);
  assert.equal(getMemory(project, "same-words").body, "New words.");
  assert.equal(listMemories(project).length, 2);
});

test("names cannot escape the store", () => {
  const { project } = sandbox();
  assert.equal(validName("../secrets"), false);
  assert.equal(validName("a/b"), false);
  assert.throws(() => saveMemory(project, { fact: "x", name: "../x", scope: "project" }), /Invalid name/);
  assert.equal(removeMemory(project, "../../etc/passwd"), undefined);
});

test("hand-written files without frontmatter still load", () => {
  const parsed = parse("Just a note about caching. More detail.", "note");
  assert.equal(parsed.name, "note");
  assert.equal(parsed.description, "Just a note about caching. More detail.");
  assert.deepEqual(parse("---\ntags: a, \"b\"\n---\nbody", "x").tags, ["a", "b"]);
});

test("frontmatter written by hand or by other tools reads as meant", () => {
  const parsed = parse(
    [
      "---",
      'name: "polar-billing"',
      'description: "Billing runs on Polar: not \\"Stripe\\""',
      "metadata:",
      "  type: project",
      "  description: nested, not the summary",
      "tags:",
      "  - billing",
      "  - 'payments'",
      "updated: '2026-10-01T00:00:00Z'",
      "---",
      "",
      "Billing runs on Polar.",
    ].join("\n"),
    "polar-billing",
  );
  assert.equal(parsed.description, 'Billing runs on Polar: not "Stripe"');
  assert.deepEqual(parsed.tags, ["billing", "payments"]);
  assert.equal(parsed.updated, "2026-10-01T00:00:00Z");
  assert.equal(parsed.body, "Billing runs on Polar.");
  // What llmmemory writes itself still reads back the same.
  assert.deepEqual(parse("---\ndescription: It's fine: really.\ntags: [a, b]\n---\nx", "y").tags, ["a", "b"]);
  assert.equal(parse("---\ndescription: It's fine: really.\n---\nx", "y").description, "It's fine: really.");
});

test("project and global memories are kept apart, project first", () => {
  const { project } = sandbox();
  saveMemory(project, { fact: "Global fact.", name: "fact", scope: "global" });
  saveMemory(project, { fact: "Project fact.", name: "fact", scope: "project" });
  assert.equal(getMemory(project, "fact").body, "Project fact.");
  assert.equal(getMemory(project, "fact", "global").body, "Global fact.");
  assert.equal(removeMemory(project, "fact", "global").scope, "global");
  assert.equal(listMemories(project).length, 1);
});

test("findRoot walks up to the initialized project but not to the global store", () => {
  const { dir, project } = sandbox();
  mkdirSync(join(project, ".llmmemory", "memories"), { recursive: true });
  mkdirSync(join(project, "a", "b"), { recursive: true });
  assert.equal(findRoot(join(project, "a", "b")), project);

  // The global store at ~/.llmmemory must not make the home directory a project.
  const user = join(dir, "user");
  process.env.LLMMEMORY_HOME = join(user, ".llmmemory");
  mkdirSync(join(user, ".llmmemory", "memories"), { recursive: true });
  mkdirSync(join(user, "code"));
  assert.equal(findRoot(join(user, "code")), null);
});

test("writes replace the file whole and leave no temp files behind", () => {
  const root = mkdtempSync(join(tmpdir(), "llmmemory-atomic-"));
  const path = join(root, "note.md");
  writeAtomic(path, "first");
  writeAtomic(path, "second");
  assert.equal(readFileSync(path, "utf8"), "second");
  assert.deepEqual(readdirSync(root), ["note.md"]);
  // A failed rename cleans up after itself: here the target is a directory.
  mkdirSync(join(root, "dir.md"));
  assert.throws(() => writeAtomic(join(root, "dir.md"), "x"));
  assert.deepEqual(readdirSync(root).sort(), ["dir.md", "note.md"]);
});
