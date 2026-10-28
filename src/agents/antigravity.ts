import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasJsonMcp, load, registerJsonMcp, save, unregisterJsonMcp } from "../settings.js";
import { str, strings, type Agent } from "./types.js";

const CONFIG = join(".agents", "hooks.json");
const MCP = join(".agents", "mcp_config.json");
const SESSION = "llmmemory session-start --agent antigravity";
/** Antigravity keys hooks.json by hook name; this is llmmemory's entry. */
const KEY = "llmmemory";

const entry = () => ({ SessionStart: [{ type: "command", command: SESSION }] });

/**
 * Antigravity's per-turn hook is not handed the user's message, so there is
 * nothing to match memories against: it gets the index at session start and
 * recalls the rest through the MCP server.
 */
export const antigravity: Agent = {
  name: "antigravity",
  label: "Antigravity CLI",
  hooksPath: CONFIG,
  mcpPath: MCP,
  detect: (root) => ["hooks.json", "rules", "workflows", "mcp_config.json"].some((name) => existsSync(join(root, ".agents", name))),

  wiring(root) {
    const ours = load(root, CONFIG)[KEY] as Record<string, unknown> | undefined;
    const session = !!ours && ours.enabled !== false && JSON.stringify(ours.SessionStart ?? null).includes(JSON.stringify(SESSION));
    return { session, prompt: null, mcp: hasJsonMcp(root, MCP) };
  },
  registerHooks(root) {
    const config = load(root, CONFIG);
    if (JSON.stringify(config[KEY]) === JSON.stringify(entry())) return false;
    config[KEY] = entry();
    save(root, CONFIG, config);
    return true;
  },
  unregisterHooks(root) {
    if (!existsSync(join(root, CONFIG))) return false;
    const config = load(root, CONFIG);
    if (!(KEY in config)) return false;
    delete config[KEY];
    save(root, CONFIG, config);
    return true;
  },
  registerMcp: (root) => registerJsonMcp(root, MCP),
  unregisterMcp: (root) => unregisterJsonMcp(root, MCP),

  parse: (input) => ({
    dirs: [...strings(input.workspacePaths), process.cwd()],
    sessionId: str(input.conversationId),
  }),
  sessionOutput: (context) => JSON.stringify({ injectSteps: [{ systemMessage: { systemMessage: context } }] }),
  promptOutput: () => "",
};
