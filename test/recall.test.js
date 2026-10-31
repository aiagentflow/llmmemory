import assert from "node:assert/strict";
import { test } from "node:test";
import { relevant } from "../dist/hooks.js";
import { search } from "../dist/search.js";
import { CASES, MEMORIES } from "./fixtures/recall.js";

/**
 * Floors for the benchmark. Raise them when recall gets better; a change
 * that drops below them made recall worse for messages like these.
 */
const MIN_PRECISION = 0.7;
const MIN_RECALL = 0.85;
/** Share of unrelated messages that must recall nothing. */
const MIN_QUIET = 0.75;

const memories = MEMORIES.map(([name, body, tags]) => ({
  name,
  description: body,
  tags,
  body,
  scope: "project",
  created: "",
  updated: "",
  path: "",
}));

test("recall benchmark: the per-message hook adds the right memories", (t) => {
  let returned = 0;
  let correct = 0;
  let expected = 0;
  let quiet = 0;
  const misses = [];
  for (const [message, want] of CASES) {
    const got = relevant(search(memories, message, 10)).map((hit) => hit.memory.name);
    returned += got.length;
    expected += want.length;
    correct += got.filter((name) => want.includes(name)).length;
    if (want.length === 0 && got.length === 0) quiet += 1;
    const wrong = got.filter((name) => !want.includes(name));
    const missed = want.filter((name) => !got.includes(name));
    if (wrong.length > 0 || missed.length > 0) misses.push(`${message}: missed [${missed}] extra [${wrong}]`);
  }
  const precision = returned === 0 ? 1 : correct / returned;
  const recall = correct / expected;
  const unrelated = CASES.filter(([, want]) => want.length === 0).length;
  t.diagnostic(`precision ${precision.toFixed(2)}, recall ${recall.toFixed(2)}, quiet on ${quiet}/${unrelated} unrelated messages`);
  for (const miss of misses) t.diagnostic(miss);
  assert.ok(precision >= MIN_PRECISION, `precision ${precision.toFixed(2)} below ${MIN_PRECISION}`);
  assert.ok(recall >= MIN_RECALL, `recall ${recall.toFixed(2)} below ${MIN_RECALL}`);
  assert.ok(quiet / unrelated >= MIN_QUIET, `only ${quiet}/${unrelated} unrelated messages recalled nothing`);
});
