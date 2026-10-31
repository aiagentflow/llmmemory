import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeAtomic } from "./store.js";

export const MCP_NAME = "llmmemory";
/** How every agent starts the MCP server. */
export const MCP_SERVER = { command: "llmmemory", args: ["mcp"] };

interface HookHandler {
  type?: string;
  command?: string;
  [key: string]: unknown;
}

interface MatcherGroup {
  matcher?: string;
  hooks?: HookHandler[];
  [key: string]: unknown;
}

export type Json = Record<string, unknown>;

export interface HookSpec {
  event: string;
  command: string;
  matcher?: string;
}

/** Raised instead of silently replacing a config file llmmemory cannot parse. */
export class SettingsError extends Error {}

/** A JSON config file as an object; {} when it does not exist yet. */
export function load(root: string, file: string): Json {
  const path = join(root, file);
  if (!existsSync(path)) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    parsed = undefined;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SettingsError(
      `${file} is not a JSON object. llmmemory will not overwrite it: fix or move the file, then run again.`,
    );
  }
  return parsed as Json;
}

export function save(root: string, file: string, value: Json): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeAtomic(join(root, file), `${JSON.stringify(value, null, 2)}\n`);
}

function groups(config: Json, event: string): MatcherGroup[] {
  const hooks = config.hooks as Record<string, MatcherGroup[]> | undefined;
  return Array.isArray(hooks?.[event]) ? hooks[event] : [];
}

function hasSpec(config: Json, spec: HookSpec): boolean {
  return groups(config, spec.event).some((group) => (group.hooks ?? []).some((h) => h.command === spec.command));
}

/**
 * Hooks in Claude Code's shape: `hooks` keyed by event, each a list of
 * matcher groups holding commands. Codex and Gemini CLI use the same shape
 * under their own file and event names.
 */
export function registeredSpecs(root: string, file: string, specs: HookSpec[]): boolean[] {
  const config = load(root, file);
  return specs.map((spec) => hasSpec(config, spec));
}

/** Adds the hooks that are missing without disturbing hooks already there. */
export function registerSpecs(root: string, file: string, specs: HookSpec[]): boolean {
  const config = load(root, file);
  let added = false;
  for (const spec of specs) {
    if (hasSpec(config, spec)) continue;
    const hooks = (config.hooks ??= {}) as Record<string, MatcherGroup[]>;
    const group: MatcherGroup = { hooks: [{ type: "command", command: spec.command }] };
    if (spec.matcher !== undefined) group.matcher = spec.matcher;
    hooks[spec.event] = [...groups(config, spec.event), group];
    added = true;
  }
  if (added) save(root, file, config);
  return added;
}

export function unregisterSpecs(root: string, file: string, specs: HookSpec[]): boolean {
  if (!existsSync(join(root, file))) return false;
  const config = load(root, file);
  const ours = new Set(specs.map((spec) => spec.command));
  const hooks = (config.hooks ?? {}) as Record<string, MatcherGroup[]>;
  let removed = false;

  for (const event of Object.keys(hooks)) {
    const kept = groups(config, event)
      .map((group) => {
        const handlers = (group.hooks ?? []).filter((h) => !(h.command !== undefined && ours.has(h.command)));
        if (handlers.length !== (group.hooks ?? []).length) removed = true;
        return { ...group, hooks: handlers };
      })
      .filter((group) => group.hooks.length > 0);
    if (kept.length > 0) hooks[event] = kept;
    else delete hooks[event];
  }

  if (!removed) return false;
  if (Object.keys(hooks).length === 0) delete config.hooks;
  save(root, file, config);
  return true;
}

function servers(config: Json): Json | undefined {
  const value = config.mcpServers;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;
}

/** The MCP server in a JSON file with a top-level `mcpServers` object, the shape most agents share. */
export function hasJsonMcp(root: string, file: string): boolean {
  return servers(load(root, file))?.[MCP_NAME] !== undefined;
}

export function registerJsonMcp(root: string, file: string): boolean {
  const config = load(root, file);
  const list = servers(config) ?? {};
  if (list[MCP_NAME] !== undefined) return false;
  list[MCP_NAME] = { ...MCP_SERVER };
  config.mcpServers = list;
  save(root, file, config);
  return true;
}

export function unregisterJsonMcp(root: string, file: string): boolean {
  if (!existsSync(join(root, file))) return false;
  const config = load(root, file);
  const list = servers(config);
  if (list?.[MCP_NAME] === undefined) return false;
  delete list[MCP_NAME];
  save(root, file, config);
  return true;
}

/** Codex keeps MCP servers in TOML. llmmemory owns one table and edits nothing else in the file. */
const TOML_TABLE = `[mcp_servers.${MCP_NAME}]`;
const TOML_BLOCK = `${TOML_TABLE}\ncommand = "${MCP_SERVER.command}"\nargs = [${MCP_SERVER.args.map((a) => `"${a}"`).join(", ")}]\n`;

function tomlLines(root: string, file: string): string[] | null {
  const path = join(root, file);
  return existsSync(path) ? readFileSync(path, "utf8").split("\n") : null;
}

export function hasTomlMcp(root: string, file: string): boolean {
  return (tomlLines(root, file) ?? []).some((line) => line.trim() === TOML_TABLE);
}

export function registerTomlMcp(root: string, file: string): boolean {
  if (hasTomlMcp(root, file)) return false;
  const text = (tomlLines(root, file) ?? []).join("\n");
  const sep = text === "" ? "" : text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeAtomic(join(root, file), `${text}${sep}${TOML_BLOCK}`);
  return true;
}

/** Removes llmmemory's table: its header up to the next table header. */
export function unregisterTomlMcp(root: string, file: string): boolean {
  const lines = tomlLines(root, file);
  if (!lines) return false;
  const start = lines.findIndex((line) => line.trim() === TOML_TABLE);
  if (start < 0) return false;
  let end = start + 1;
  while (end < lines.length && !lines[end].trim().startsWith("[")) end += 1;
  const kept = [...lines.slice(0, start), ...lines.slice(end)].join("\n");
  writeAtomic(join(root, file), kept.replace(/\n{3,}/g, "\n\n").replace(/^\n+/, ""));
  return true;
}
