import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { candidates, importMemories, type Imported } from "../import.js";
import { search } from "../search.js";
import { displayPath, getMemory, listMemories, parse, removeMemory, saveMemory, serialize, type Memory, type Scope } from "../store.js";

function out(text: string): number {
  process.stdout.write(`${text}\n`);
  return 0;
}

function fail(text: string): number {
  process.stderr.write(`${text}\n`);
  return 1;
}

/** Two lines per memory, so a long summary never wraps into the next name. */
function entry(memory: Memory, extra = ""): string {
  const tags = memory.tags.length > 0 ? `  [${memory.tags.join(", ")}]` : "";
  return `${memory.name}  ${memory.scope}${tags}${extra}\n  ${memory.description}`;
}

export interface AddOptions {
  json: boolean;
  scope: Scope;
  name?: string;
  description?: string;
  tags?: string[];
}

export function add(root: string, fact: string, options: AddOptions): number {
  try {
    const { memory, updated } = saveMemory(root, { fact, ...options });
    if (options.json) return out(JSON.stringify({ ...memory, updated }));
    return out(`${updated ? "Updated" : "Saved"} ${memory.scope} memory "${memory.name}"\n  ${displayPath(memory.path)}`);
  } catch (error) {
    return fail((error as Error).message);
  }
}

export function list(root: string, options: { json: boolean; scope?: Scope }): number {
  const memories = listMemories(root, options.scope ? [options.scope] : undefined);
  if (options.json) return out(JSON.stringify(memories, null, 2));
  if (memories.length === 0) return out('No memories yet. Save one with: llmmemory add "<fact>"');
  return out(memories.map((m) => entry(m)).join("\n"));
}

export function find(root: string, query: string, options: { json: boolean; limit: number }): number {
  const hits = search(listMemories(root), query, options.limit);
  if (options.json) return out(JSON.stringify(hits, null, 2));
  if (hits.length === 0) return out("No memories match.");
  return out(hits.map((hit) => entry(hit.memory, `  score ${hit.score.toFixed(2)}`)).join("\n"));
}

export function show(root: string, name: string, options: { json: boolean; scope?: Scope }): number {
  const memory = getMemory(root, name, options.scope);
  if (!memory) return fail(`No memory named "${name}".`);
  if (options.json) return out(JSON.stringify(memory, null, 2));
  return out(`${entry(memory)}\n  updated ${memory.updated.slice(0, 10)}, ${displayPath(memory.path)}\n\n${memory.body}`);
}

export function forget(root: string, name: string, options: { json: boolean; scope?: Scope }): number {
  const memory = removeMemory(root, name, options.scope);
  if (!memory) return fail(`No memory named "${name}".`);
  if (options.json) return out(JSON.stringify({ forgot: memory.name, scope: memory.scope }));
  return out(`Forgot ${memory.scope} memory "${memory.name}".`);
}

export function importFrom(root: string, paths: string[], options: { json: boolean; scope: Scope; dryRun: boolean }): number {
  let results: Imported[];
  try {
    results = importMemories(root, candidates(root, paths), options.scope, options.dryRun);
  } catch (error) {
    return fail((error as Error).message);
  }
  if (options.json) return out(JSON.stringify(results, null, 2));
  if (results.length === 0) return out("Nothing to import: no CLAUDE.md, AGENTS.md, GEMINI.md or Claude Code memory found.");
  const added = results.filter((r) => r.status === "imported").length;
  const lines = results.map((r) => `${r.status === "imported" ? "+" : "="} ${r.name}  from ${displayPath(r.source)}${r.status === "exists" ? "  (already saved)" : ""}`);
  const verb = options.dryRun ? "Would import" : "Imported";
  return out(`${lines.join("\n")}\n${verb} ${added} ${options.scope} ${added === 1 ? "memory" : "memories"}, ${results.length - added} already saved.`);
}

/**
 * Opens a memory in the user's editor. The updated date moves only when the
 * text changed, so opening a memory to read it does not make it look fresh.
 */
export function edit(root: string, name: string, options: { json: boolean; scope?: Scope }, now = new Date()): number {
  const memory = getMemory(root, name, options.scope);
  if (!memory) return fail(`No memory named "${name}".`);
  const editor = process.env.VISUAL || process.env.EDITOR || "vi";
  const before = readFileSync(memory.path, "utf8");
  // Through the shell, so an editor with flags such as "code --wait" works.
  const result = spawnSync("sh", ["-c", `${editor} "$1"`, "sh", memory.path], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    return fail(`Could not run the editor "${editor}". Set VISUAL or EDITOR, or edit ${displayPath(memory.path)} by hand.`);
  }
  const after = readFileSync(memory.path, "utf8");
  const changed = after !== before;
  if (changed) {
    const edited = parse(after, memory.name);
    writeFileSync(memory.path, serialize({ ...edited, created: edited.created || memory.created, updated: now.toISOString() }), "utf8");
  }
  if (options.json) return out(JSON.stringify({ name: memory.name, scope: memory.scope, changed }));
  return out(changed ? `Updated ${memory.scope} memory "${memory.name}".` : `No changes to "${memory.name}".`);
}
