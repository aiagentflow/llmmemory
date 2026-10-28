import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claude, type Agent, type HookInput } from "./agents/index.js";
import { recallContext, sessionContext } from "./context.js";
import { search, type Hit } from "./search.js";
import { findRoot, listMemories } from "./store.js";

/** Memories recalled for one prompt at most. */
const RECALL_LIMIT = 3;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function readInput(agent: Agent): Promise<HookInput> {
  let payload: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(await readStdin());
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch {
    // An unreadable payload still gets the memories of the directory the hook runs in.
  }
  return agent.parse(payload);
}

function rootFor(input: HookInput): string {
  for (const dir of input.dirs) {
    if (!dir) continue;
    const root = findRoot(dir);
    if (root) return root;
  }
  return input.dirs.find((dir) => dir !== undefined) ?? process.cwd();
}

function emit(output: string): void {
  if (output !== "") process.stdout.write(`${output}\n`);
}

/** Session start hook: hands the agent the index of memories. Never fails a session. */
export async function sessionStart(agent: Agent = claude): Promise<number> {
  try {
    const root = rootFor(await readInput(agent));
    let autoRecall = false;
    try {
      autoRecall = agent.wiring(root).prompt === true;
    } catch {
      // A config file llmmemory cannot read still gets the index, with lookup instructions.
    }
    emit(agent.sessionOutput(sessionContext(listMemories(root), autoRecall)));
  } catch {
    // Memory is a nice-to-have; a broken store must not block the session.
  }
  return 0;
}

/**
 * Keeps prompts in one session from recalling the same memory twice: it is
 * already in the conversation. Lives in the temp directory because it only
 * matters while the session runs.
 */
function seenFile(sessionId: string): string {
  return join(tmpdir(), "llmmemory", `${sessionId.replace(/[^\w-]/g, "_")}.json`);
}

function readSeen(sessionId: string | undefined): Set<string> {
  if (!sessionId) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(seenFile(sessionId), "utf8")) as string[]);
  } catch {
    return new Set();
  }
}

function writeSeen(sessionId: string | undefined, seen: Set<string>): void {
  if (!sessionId) return;
  try {
    mkdirSync(join(tmpdir(), "llmmemory"), { recursive: true });
    writeFileSync(seenFile(sessionId), JSON.stringify([...seen]), "utf8");
  } catch {
    // Worst case a memory is recalled twice.
  }
}

/**
 * The memories worth adding to a prompt. A single common word matching deep
 * in a body is noise, so a hit needs a match in the name, tags or summary, or
 * at least two query terms, and must score close to the best one.
 */
export function relevant(hits: Hit[]): Hit[] {
  const top = hits[0]?.score ?? 0;
  return hits.filter((hit) => (hit.strong || hit.matched >= 2) && hit.score >= top * 0.4).slice(0, RECALL_LIMIT);
}

/** Per-prompt hook: adds the memories that match the user's message. */
export async function promptHook(agent: Agent = claude): Promise<number> {
  try {
    const input = await readInput(agent);
    if (!input.prompt) return 0;
    const seen = readSeen(input.sessionId);
    const key = (hit: Hit) => `${hit.memory.scope}:${hit.memory.name}`;
    const hits = relevant(search(listMemories(rootFor(input)), input.prompt, 10)).filter((hit) => !seen.has(key(hit)));
    if (hits.length === 0) return 0;
    for (const hit of hits) seen.add(key(hit));
    writeSeen(input.sessionId, seen);
    emit(agent.promptOutput(recallContext(hits)));
  } catch {
    // Never get in the way of the user's message.
  }
  return 0;
}
