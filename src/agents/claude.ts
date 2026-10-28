import { join } from "node:path";
import { hasJsonMcp, registeredSpecs, registerJsonMcp, registerSpecs, unregisterJsonMcp, unregisterSpecs, type HookSpec } from "../settings.js";
import { str, type Agent } from "./types.js";

const CONFIG = join(".claude", "settings.json");
const MCP = ".mcp.json";
export const SESSION_COMMAND = "llmmemory session-start";
export const PROMPT_COMMAND = "llmmemory prompt";

const SPECS: HookSpec[] = [
  { event: "SessionStart", command: SESSION_COMMAND },
  { event: "UserPromptSubmit", command: PROMPT_COMMAND },
];

/** Context in the hookSpecificOutput shape Claude Code, Codex and Gemini CLI all read. */
export function hookContext(event: string, context: string): string {
  return JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: context } });
}

export const claude: Agent = {
  name: "claude",
  label: "Claude Code",
  hooksPath: CONFIG,
  mcpPath: MCP,
  sessionCommand: SESSION_COMMAND,
  probe: (root) => ({ session_id: "llmmemory-doctor", cwd: root, hook_event_name: "SessionStart", source: "startup" }),
  // Claude Code is always wired by default, whether or not .claude/ exists yet.
  detect: () => true,

  wiring(root) {
    const [session, prompt] = registeredSpecs(root, CONFIG, SPECS);
    return { session, prompt, mcp: hasJsonMcp(root, MCP) };
  },
  registerHooks: (root) => registerSpecs(root, CONFIG, SPECS),
  unregisterHooks: (root) => unregisterSpecs(root, CONFIG, SPECS),
  registerMcp: (root) => registerJsonMcp(root, MCP),
  unregisterMcp: (root) => unregisterJsonMcp(root, MCP),

  parse: (input) => ({
    // The agent's cwd may be a subdirectory; fall back to where Claude Code was started.
    dirs: [str(input.cwd), process.env.CLAUDE_PROJECT_DIR, process.cwd()],
    sessionId: str(input.session_id),
    prompt: str(input.prompt),
  }),
  sessionOutput: (context) => hookContext("SessionStart", context),
  promptOutput: (context) => hookContext("UserPromptSubmit", context),
};
