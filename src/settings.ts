import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const SETTINGS_PATH = join(".claude", "settings.json");
export const MCP_PATH = ".mcp.json";
export const SESSION_COMMAND = "llmmemory session-start";
export const PROMPT_COMMAND = "llmmemory prompt";
export const MCP_NAME = "llmmemory";

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

type Json = Record<string, unknown>;

interface Settings {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

export interface HookSpec {
  event: string;
  command: string;
}

/** The index of memories when a session starts, and the ones that match each prompt. */
export const SPECS: HookSpec[] = [
  { event: "SessionStart", command: SESSION_COMMAND },
  { event: "UserPromptSubmit", command: PROMPT_COMMAND },
];

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

function save(root: string, file: string, value: Json): void {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function has(settings: Settings, spec: HookSpec): boolean {
  return (settings.hooks?.[spec.event] ?? []).some((group) =>
    (group.hooks ?? []).some((handler) => handler.command === spec.command),
  );
}

export function registeredHooks(root: string): boolean[] {
  const settings = load(root, SETTINGS_PATH) as Settings;
  return SPECS.map((spec) => has(settings, spec));
}

/** Adds the hooks that are missing without disturbing hooks already there. */
export function registerHooks(root: string): boolean {
  const settings = load(root, SETTINGS_PATH) as Settings;
  let added = false;
  for (const spec of SPECS) {
    if (has(settings, spec)) continue;
    settings.hooks ??= {};
    settings.hooks[spec.event] ??= [];
    settings.hooks[spec.event].push({ hooks: [{ type: "command", command: spec.command }] });
    added = true;
  }
  if (added) save(root, SETTINGS_PATH, settings);
  return added;
}

export function unregisterHooks(root: string): boolean {
  if (!existsSync(join(root, SETTINGS_PATH))) return false;
  const settings = load(root, SETTINGS_PATH) as Settings;
  const ours = new Set(SPECS.map((spec) => spec.command));
  let removed = false;

  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    const kept = groups
      .map((group) => {
        const handlers = (group.hooks ?? []).filter((handler) => {
          const match = handler.command !== undefined && ours.has(handler.command);
          if (match) removed = true;
          return !match;
        });
        return { ...group, hooks: handlers };
      })
      .filter((group) => (group.hooks ?? []).length > 0);
    if (kept.length > 0) settings.hooks![event] = kept;
    else delete settings.hooks![event];
  }

  if (!removed) return false;
  if (Object.keys(settings.hooks ?? {}).length === 0) delete settings.hooks;
  save(root, SETTINGS_PATH, settings);
  return true;
}

function servers(config: Json): Json | undefined {
  const value = config.mcpServers;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : undefined;
}

export function isMcpRegistered(root: string): boolean {
  return servers(load(root, MCP_PATH))?.[MCP_NAME] !== undefined;
}

/** Adds the MCP server to the project's .mcp.json, leaving other servers alone. */
export function registerMcp(root: string): boolean {
  const config = load(root, MCP_PATH);
  const list = servers(config) ?? {};
  if (list[MCP_NAME] !== undefined) return false;
  list[MCP_NAME] = { command: "llmmemory", args: ["mcp"] };
  config.mcpServers = list;
  save(root, MCP_PATH, config);
  return true;
}

export function unregisterMcp(root: string): boolean {
  if (!existsSync(join(root, MCP_PATH))) return false;
  const config = load(root, MCP_PATH);
  const list = servers(config);
  if (list?.[MCP_NAME] === undefined) return false;
  delete list[MCP_NAME];
  save(root, MCP_PATH, config);
  return true;
}
