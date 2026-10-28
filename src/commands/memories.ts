import { search } from "../search.js";
import { displayPath, getMemory, listMemories, removeMemory, saveMemory, type Memory, type Scope } from "../store.js";

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
