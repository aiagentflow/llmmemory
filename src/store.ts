import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { similar } from "./search.js";

export const STORE_DIR = ".llmmemory";
const MEMORIES = "memories";

export type Scope = "project" | "global";

export interface Memory {
  /** File name without .md, unique within its scope. */
  name: string;
  /** One line, shown in the index every session starts with. */
  description: string;
  tags: string[];
  created: string;
  updated: string;
  body: string;
  scope: Scope;
  path: string;
}

export interface NewMemory {
  fact: string;
  name?: string;
  description?: string;
  tags?: string[];
  scope: Scope;
}

/**
 * Writes a file so that a reader sees the old text or the new, never half of
 * one: agents and hooks read the store while others write to it. The temp
 * file sits next to the target, so the rename stays on one filesystem.
 */
export function writeAtomic(path: string, text: string): void {
  const temp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(temp, text, "utf8");
  try {
    renameSync(temp, path);
  } catch (error) {
    rmSync(temp, { force: true });
    throw error;
  }
}

/** The global store, shared by every project. LLMMEMORY_HOME moves it, mainly for tests. */
export function globalDir(): string {
  return process.env.LLMMEMORY_HOME ?? join(homedir(), STORE_DIR);
}

/** A path as people read it: relative inside the current directory, ~ inside the home directory. */
export function displayPath(path: string): string {
  const here = relative(process.cwd(), path);
  if (here !== "" && !here.startsWith("..") && !here.startsWith(sep)) return here;
  const home = homedir();
  return path === home || path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
}

/** The nearest directory at or above `from` holding a project store, or null. */
export function findRoot(from: string): string | null {
  let dir = resolve(from);
  for (;;) {
    // The home directory's .llmmemory is the global store, not a project.
    if (existsSync(join(dir, STORE_DIR, MEMORIES)) && join(dir, STORE_DIR) !== globalDir()) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function memoriesDir(root: string, scope: Scope): string {
  return scope === "global" ? join(globalDir(), MEMORIES) : join(root, STORE_DIR, MEMORIES);
}

/** Lowercase words joined by hyphens, short enough to read in a list. */
export function slugify(text: string): string {
  // Named after the first sentence only, even when the summary has two.
  const words = text
    .split(/[.!?](?:\s|$)/)[0]
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter((w) => w.length > 0);
  let slug = "";
  for (const word of words.slice(0, 6)) {
    const next = slug ? `${slug}-${word}` : word;
    if (next.length > 40 && slug) break;
    slug = next;
  }
  return slug.slice(0, 40) || "memory";
}

/** The first sentence of a fact, cut at a word boundary to fit one line. */
export function describe(fact: string): string {
  const line = fact.trim().split(/\n/)[0];
  const sentences = line.match(/.+?[.!?](?=\s|$)/g)?.map((s) => s.trim()) ?? [line];
  let sentence = sentences[0];
  // A short first sentence says too little on its own; take the next one if both fit.
  if (sentence.length < 50 && sentences[1] && sentence.length + sentences[1].length < 100) sentence += ` ${sentences[1]}`;
  if (sentence.length <= 100) return sentence;
  const cut = sentence.slice(0, 100);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 40 ? cut.lastIndexOf(" ") : 100)}...`;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function serialize(memory: Pick<Memory, "name" | "description" | "tags" | "created" | "updated" | "body">): string {
  const lines = [
    "---",
    `name: ${memory.name}`,
    `description: ${oneLine(memory.description)}`,
    ...(memory.tags.length > 0 ? [`tags: [${memory.tags.join(", ")}]`] : []),
    `created: ${memory.created}`,
    `updated: ${memory.updated}`,
    "---",
    "",
    memory.body.trim(),
    "",
  ];
  return lines.join("\n");
}

/** A YAML scalar without its quotes. */
function unquote(value: string): string {
  if (/^".*"$/.test(value)) return value.slice(1, -1).replace(/\\(["\\])/g, "$1");
  if (/^'.*'$/.test(value)) return value.slice(1, -1).replace(/''/g, "'");
  return value;
}

/**
 * Reads a memory file. Files are meant to be edited by hand, so anything
 * missing falls back to something sensible instead of failing: no frontmatter
 * means the whole file is the body.
 */
export function parse(text: string, fallbackName: string): Omit<Memory, "scope" | "path"> {
  const fields: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  let body = text;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (match) {
    body = text.slice(match[0].length);
    let key = "";
    for (const line of match[1].split(/\r?\n/)) {
      // "- item" under a key with no value is a block list; other indented lines belong to a nested map.
      const item = line.match(/^\s*-\s+(.*)$/);
      if (item && key && fields[key] === "") {
        (lists[key] ??= []).push(unquote(item[1].trim()));
        continue;
      }
      if (/^\s/.test(line)) continue;
      const at = line.indexOf(":");
      if (at <= 0) continue;
      key = line.slice(0, at).trim();
      fields[key] = unquote(line.slice(at + 1).trim());
    }
  }
  const tags = lists.tags ?? (fields.tags ?? "")
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((t) => unquote(t.trim()))
    .filter((t) => t.length > 0);
  body = body.trim();
  return {
    name: fallbackName,
    description: fields.description || describe(body),
    tags,
    created: fields.created ?? "",
    updated: fields.updated ?? fields.created ?? "",
    body,
  };
}

export function listMemories(root: string, scopes: Scope[] = ["project", "global"]): Memory[] {
  const out: Memory[] = [];
  for (const scope of scopes) {
    const dir = memoriesDir(root, scope);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".md")) continue;
      const path = join(dir, file);
      try {
        out.push({ ...parse(readFileSync(path, "utf8"), file.slice(0, -3)), scope, path });
      } catch {
        // An unreadable file is skipped rather than breaking every session.
      }
    }
  }
  return out;
}

/** A memory by name, the project's copy first. */
export function getMemory(root: string, name: string, scope?: Scope): Memory | undefined {
  return listMemories(root, scope ? [scope] : ["project", "global"]).find((m) => m.name === name);
}

/** Only names slugify could have produced, so a name can never point outside the store. */
export function validName(name: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}-]{0,63}$/u.test(name);
}

/**
 * Saves a memory. With a name that already exists the memory is updated in
 * place, keeping its created date; without one a fresh name is derived from
 * the description, numbered if it is taken.
 */
export function saveMemory(root: string, input: NewMemory, now = new Date()): { memory: Memory; updated: boolean; similar?: Memory } {
  const fact = input.fact.trim();
  if (fact === "") throw new Error("A memory needs some text.");
  if (input.name !== undefined && !validName(input.name)) {
    throw new Error(`Invalid name "${input.name}": use letters, digits and hyphens.`);
  }
  const dir = memoriesDir(root, input.scope);
  mkdirSync(dir, { recursive: true });

  const description = oneLine(input.description ?? describe(fact));
  let name = input.name;
  const existing = name ? getMemory(root, name, input.scope) : undefined;
  // A new memory that mostly repeats an old one is still saved, but the caller is told.
  const near = existing ? undefined : similar(listMemories(root, [input.scope]), fact);
  if (!name) {
    const base = slugify(description);
    name = base;
    for (let n = 2; existsSync(join(dir, `${name}.md`)); n += 1) name = `${base}-${n}`;
  }

  const stamp = now.toISOString();
  const memory: Memory = {
    name,
    description,
    tags: [...new Set((input.tags ?? existing?.tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))],
    created: existing?.created || stamp,
    updated: stamp,
    body: fact,
    scope: input.scope,
    path: join(dir, `${name}.md`),
  };
  writeAtomic(memory.path, serialize(memory));
  return { memory, updated: existing !== undefined, similar: near };
}

/** Days without an update before a memory is worth checking again. */
const STALE_DAYS = 182;

/** The month a memory was last updated, when that was long enough ago to doubt it. */
export function staleSince(memory: Pick<Memory, "updated">, now = new Date()): string | undefined {
  const updated = Date.parse(memory.updated);
  if (Number.isNaN(updated) || now.getTime() - updated < STALE_DAYS * 86_400_000) return undefined;
  return memory.updated.slice(0, 7);
}

export function removeMemory(root: string, name: string, scope?: Scope): Memory | undefined {
  const memory = validName(name) ? getMemory(root, name, scope) : undefined;
  if (memory) rmSync(memory.path);
  return memory;
}
