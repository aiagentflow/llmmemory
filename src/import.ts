import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { describe, listMemories, parse, saveMemory, slugify, validName, type Scope } from "./store.js";

/** Instruction files agents read at the project root, imported when no path is given. */
const INSTRUCTION_FILES = ["CLAUDE.md", "AGENTS.md", "GEMINI.md"];
/** Claude Code's index of its auto-memory, not a memory itself. */
const AUTO_MEMORY_INDEX = "MEMORY.md";

export interface Candidate {
  name: string;
  description: string;
  fact: string;
  tags: string[];
  source: string;
}

export interface Imported extends Candidate {
  status: "imported" | "exists";
}

/** Where Claude Code keeps auto-memory for a project: its path with every other character turned into a hyphen. */
export function autoMemoryDir(root: string): string {
  const config = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");
  return join(config, "projects", resolve(root).replace(/[^a-zA-Z0-9]/g, "-"), "memory");
}

function unquote(text: string): string {
  return text.replace(/^(["'])(.*)\1$/, "$2");
}

/** A file that is one memory already: Claude auto-memory, or anything else with a name in its frontmatter. */
function single(text: string, path: string): Candidate | undefined {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  const name = match?.[0].match(/^name:\s*(.+)$/m)?.[1];
  if (!name) return undefined;
  const memory = parse(text, basename(path, ".md"));
  const slug = validName(unquote(name.trim())) ? unquote(name.trim()) : slugify(unquote(name.trim()));
  if (memory.body === "") return undefined;
  return { name: slug, description: memory.description, fact: memory.body, tags: ["imported"], source: path };
}

/**
 * An instruction file such as CLAUDE.md, one memory per section. Only # and
 * ## start a section, so deeper headings stay with the text they belong to.
 * Where a file has several # headings, a ## section is named after its #
 * one too, or "Rules" under "Commit" would lose what it is about.
 */
function sections(text: string, path: string): Candidate[] {
  const file = basename(path, ".md");
  const out: Candidate[] = [];
  const headings: { level: number; title: string }[] = [];
  let fenced = false;
  const marked = text.split(/\r?\n/).map((line) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    const match = fenced ? null : line.match(/^(#{1,2})\s+(.+?)\s*#*\s*$/);
    if (match) headings.push({ level: match[1].length, title: match[2] });
    return match ? headings.length - 1 : line;
  });
  const nested = headings.filter((h) => h.level === 1).length > 1;
  let heading: string | undefined;
  let parent: string | undefined;
  let lines: string[] = [];
  const flush = () => {
    const body = lines.join("\n").trim();
    if (body !== "" && heading === undefined) {
      // Text before any heading is named after the file.
      out.push({ name: slugify(file), description: describe(body), fact: body, tags: ["imported", file.toLowerCase()], source: path });
    } else if (body !== "") {
      out.push({
        name: slugify(`${file} ${heading}`),
        description: describe(`${heading}: ${body.replace(/^[#>*\-\s]+/gm, "").replace(/\s+/g, " ")}`),
        fact: `${heading}\n\n${body}`,
        tags: ["imported", file.toLowerCase()],
        source: path,
      });
    }
    lines = [];
  };
  for (const line of marked) {
    if (typeof line === "string") {
      lines.push(line);
      continue;
    }
    flush();
    const { level, title } = headings[line];
    if (level === 1) parent = title;
    heading = level === 2 && nested && parent ? `${parent}: ${title}` : title;
  }
  flush();
  return out;
}

function fromFile(path: string): Candidate[] {
  const text = readFileSync(path, "utf8");
  const one = single(text, path);
  return one ? [one] : sections(text, path);
}

/** Every memory the given paths hold: files as they are, directories by their Markdown files. */
export function candidates(root: string, paths: string[]): Candidate[] {
  const targets = paths.length > 0
    ? paths.map((p) => resolve(p))
    : [...INSTRUCTION_FILES.map((f) => join(root, f)), autoMemoryDir(root)].filter((p) => existsSync(p));
  const out: Candidate[] = [];
  for (const target of targets) {
    if (!existsSync(target)) throw new Error(`No such file or directory: ${target}`);
    if (statSync(target).isDirectory()) {
      for (const file of readdirSync(target).sort()) {
        if (file.endsWith(".md") && file !== AUTO_MEMORY_INDEX) out.push(...fromFile(join(target, file)));
      }
    } else {
      out.push(...fromFile(target));
    }
  }
  // Two sections with the same heading are two memories; numbering keeps re-runs stable.
  const taken = new Map<string, number>();
  for (const candidate of out) {
    const n = (taken.get(candidate.name) ?? 0) + 1;
    taken.set(candidate.name, n);
    if (n > 1) candidate.name = `${candidate.name}-${n}`;
  }
  return out;
}

/**
 * Saves each candidate unless the store already has it, by name or by the
 * same text, so running import again adds nothing. Sources are only read.
 */
export function importMemories(root: string, found: Candidate[], scope: Scope, dryRun: boolean): Imported[] {
  const existing = listMemories(root, [scope]);
  const names = new Set(existing.map((m) => m.name));
  const bodies = new Set(existing.map((m) => m.body.trim()));
  const out: Imported[] = [];
  for (const candidate of found) {
    if (names.has(candidate.name) || bodies.has(candidate.fact.trim())) {
      out.push({ ...candidate, status: "exists" });
      continue;
    }
    if (!dryRun) saveMemory(root, { ...candidate, scope });
    names.add(candidate.name);
    bodies.add(candidate.fact.trim());
    out.push({ ...candidate, status: "imported" });
  }
  return out;
}
