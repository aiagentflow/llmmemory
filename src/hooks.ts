import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recallContext, sessionContext } from "./context.js";
import { search, type Hit } from "./search.js";
import { findRoot, listMemories } from "./store.js";

/** Memories recalled for one prompt at most. */
const RECALL_LIMIT = 3;

interface HookInput {
  session_id?: string;
  cwd?: string;
  prompt?: string;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function readInput(): Promise<HookInput> {
  try {
    const parsed: unknown = JSON.parse(await readStdin());
    return parsed && typeof parsed === "object" ? (parsed as HookInput) : {};
  } catch {
    return {};
  }
}

function rootFor(input: HookInput): string {
  for (const dir of [input.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd()]) {
    if (!dir) continue;
    const root = findRoot(dir);
    if (root) return root;
  }
  return input.cwd ?? process.cwd();
}

function emit(event: string, context: string): void {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } })}\n`);
}

/** SessionStart hook: hands the agent the index of memories. Never fails a session. */
export async function sessionStart(): Promise<number> {
  try {
    const input = await readInput();
    emit("SessionStart", sessionContext(listMemories(rootFor(input))));
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

/** UserPromptSubmit hook: adds the memories that match the prompt. */
export async function promptHook(): Promise<number> {
  try {
    const input = await readInput();
    if (!input.prompt) return 0;
    const seen = readSeen(input.session_id);
    const key = (hit: Hit) => `${hit.memory.scope}:${hit.memory.name}`;
    const hits = relevant(search(listMemories(rootFor(input)), input.prompt, 10)).filter((hit) => !seen.has(key(hit)));
    if (hits.length === 0) return 0;
    for (const hit of hits) seen.add(key(hit));
    writeSeen(input.session_id, seen);
    emit("UserPromptSubmit", recallContext(hits));
  } catch {
    // Never get in the way of the user's message.
  }
  return 0;
}
