import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasJsonMcp, load, registerJsonMcp, save, unregisterJsonMcp } from "../settings.js";
import { str, strings, type Agent } from "./types.js";

const CONFIG = join(".cursor", "hooks.json");
const MCP = join(".cursor", "mcp.json");
const EVENT = "sessionStart";
const SESSION = "llmmemory session-start --agent cursor";

interface Handler {
  command?: string;
  [key: string]: unknown;
}

function handlers(root: string): Record<string, Handler[]> {
  const hooks = load(root, CONFIG).hooks;
  return hooks && typeof hooks === "object" ? (hooks as Record<string, Handler[]>) : {};
}

/**
 * Cursor's hooks.json is a flat list of commands per event. Its prompt hook
 * can only allow or block a message, not add to it, so Cursor gets the index
 * at session start and recalls the rest through the MCP server.
 */
export const cursor: Agent = {
  name: "cursor",
  label: "Cursor",
  hooksPath: CONFIG,
  mcpPath: MCP,
  sessionCommand: SESSION,
  probe: (root) => ({ conversation_id: "llmmemory-doctor", hook_event_name: "sessionStart", workspace_roots: [root] }),
  detect: (root) => existsSync(join(root, ".cursor")),

  wiring(root) {
    const list = handlers(root)[EVENT];
    const session = Array.isArray(list) && list.some((h) => h.command === SESSION);
    return { session, prompt: null, mcp: hasJsonMcp(root, MCP) };
  },
  registerHooks(root) {
    const config = load(root, CONFIG);
    const hooks = handlers(root);
    const list = Array.isArray(hooks[EVENT]) ? hooks[EVENT] : [];
    if (list.some((h) => h.command === SESSION)) return false;
    config.version ??= 1;
    config.hooks = { ...hooks, [EVENT]: [...list, { command: SESSION }] };
    save(root, CONFIG, config);
    return true;
  },
  unregisterHooks(root) {
    if (!existsSync(join(root, CONFIG))) return false;
    const config = load(root, CONFIG);
    const hooks = handlers(root);
    const list = Array.isArray(hooks[EVENT]) ? hooks[EVENT] : [];
    const kept = list.filter((h) => h.command !== SESSION);
    if (kept.length === list.length) return false;
    if (kept.length > 0) hooks[EVENT] = kept;
    else delete hooks[EVENT];
    config.hooks = hooks;
    save(root, CONFIG, config);
    return true;
  },
  registerMcp: (root) => registerJsonMcp(root, MCP),
  unregisterMcp: (root) => unregisterJsonMcp(root, MCP),

  parse: (input) => ({
    dirs: [str(input.cwd), ...strings(input.workspace_roots), process.env.CURSOR_PROJECT_DIR, process.cwd()],
    sessionId: str(input.session_id) ?? str(input.conversation_id),
  }),
  sessionOutput: (context) => JSON.stringify({ additional_context: context }),
  promptOutput: () => "",
};
