import assert from "node:assert/strict";
import { test } from "node:test";
import { relevant } from "../dist/hooks.js";
import { search, terms } from "../dist/search.js";

function memory(name, body, extra = {}) {
  return { name, description: body.split(".")[0], tags: [], created: "", updated: "", body, scope: "project", path: "", ...extra };
}

const memories = [
  memory("deploy-process", "Deploys go through scripts/ship.sh. Never push straight to main.", { tags: ["deploy"] }),
  memory("database", "The database is SQLite in WAL mode. Migrations live in src/db/migrations."),
  memory("style", "The user wants short answers and no preamble."),
  memory("testing", "Tests run with node --test. The database is reset before each test."),
];

test("terms drops stopwords and folds plurals", () => {
  assert.deepEqual(terms("How do I run the migrations?"), ["run", "migration"]);
  assert.deepEqual(terms("deploys deploying"), ["deploy", "deploy"]);
});

test("search ranks the memory that matches best first", () => {
  assert.equal(search(memories, "how do I deploy?")[0].memory.name, "deploy-process");
  assert.equal(search(memories, "database migrations")[0].memory.name, "database");
  assert.deepEqual(search(memories, "kubernetes"), []);
  assert.deepEqual(search(memories, "the and of"), []);
});

test("a match in the name or tags counts as strong", () => {
  const [hit] = search(memories, "deploy");
  assert.equal(hit.strong, true);
  assert.equal(hit.matched, 1);
});

test("relevant drops lone weak matches", () => {
  // "reset" only appears once, deep in a body: not worth injecting.
  assert.deepEqual(relevant(search(memories, "reset everything")), []);
  assert.equal(relevant(search(memories, "deploy this")).length, 1);
  assert.ok(relevant(search(memories, "database migrations")).some((h) => h.memory.name === "database"));
});
