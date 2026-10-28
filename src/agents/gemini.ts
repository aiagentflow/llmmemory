import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasJsonMcp, registeredSpecs, registerJsonMcp, registerSpecs, unregisterJsonMcp, unregisterSpecs, type HookSpec } from "../settings.js";
import { hookContext } from "./claude.js";
import { str, type Agent } from "./types.js";

/** Gemini CLI keeps hooks and MCP servers in the same settings file. */
const CONFIG = join(".gemini", "settings.json");

/** BeforeAgent fires once the user submits a prompt; its context is appended to that turn. */
const SESSION = "llmmemory session-start --agent gemini";

const SPECS: HookSpec[] = [
  { event: "SessionStart", command: SESSION },
  { event: "BeforeAgent", command: "llmmemory prompt --agent gemini" },
];

export const gemini: Agent = {
  name: "gemini",
  label: "Gemini CLI",
  hooksPath: CONFIG,
  mcpPath: CONFIG,
  sessionCommand: SESSION,
  probe: (root) => ({ session_id: "llmmemory-doctor", cwd: root, hook_event_name: "SessionStart", source: "startup" }),
  setupNote: "Gemini CLI connects project MCP servers only in trusted folders: run gemini trust in this project.",
  detect: (root) => existsSync(join(root, ".gemini")),

  wiring(root) {
    const [session, prompt] = registeredSpecs(root, CONFIG, SPECS);
    return { session, prompt, mcp: hasJsonMcp(root, CONFIG) };
  },
  registerHooks: (root) => registerSpecs(root, CONFIG, SPECS),
  unregisterHooks: (root) => unregisterSpecs(root, CONFIG, SPECS),
  registerMcp: (root) => registerJsonMcp(root, CONFIG),
  unregisterMcp: (root) => unregisterJsonMcp(root, CONFIG),

  parse: (input) => ({
    dirs: [str(input.cwd), process.env.GEMINI_PROJECT_DIR, process.cwd()],
    sessionId: str(input.session_id),
    prompt: str(input.prompt),
  }),
  sessionOutput: (context) => hookContext("SessionStart", context),
  promptOutput: (context) => hookContext("BeforeAgent", context),
};
