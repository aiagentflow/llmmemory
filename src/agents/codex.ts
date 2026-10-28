import { existsSync } from "node:fs";
import { join } from "node:path";
import { hasTomlMcp, registeredSpecs, registerSpecs, registerTomlMcp, unregisterSpecs, unregisterTomlMcp, type HookSpec } from "../settings.js";
import { claude, hookContext } from "./claude.js";
import type { Agent } from "./types.js";

const CONFIG = join(".codex", "hooks.json");
const MCP = join(".codex", "config.toml");

const SPECS: HookSpec[] = [
  { event: "SessionStart", command: "llmmemory session-start --agent codex" },
  { event: "UserPromptSubmit", command: "llmmemory prompt --agent codex" },
];

/** Codex's hook payloads follow Claude Code's, so only the wiring differs. */
export const codex: Agent = {
  ...claude,
  name: "codex",
  label: "Codex CLI",
  hooksPath: CONFIG,
  mcpPath: MCP,
  setupNote: "Codex runs project hooks only once you trust them: run /hooks in Codex and approve llmmemory's.",
  detect: (root) => existsSync(join(root, ".codex")),

  wiring(root) {
    const [session, prompt] = registeredSpecs(root, CONFIG, SPECS);
    return { session, prompt, mcp: hasTomlMcp(root, MCP) };
  },
  registerHooks: (root) => registerSpecs(root, CONFIG, SPECS),
  unregisterHooks: (root) => unregisterSpecs(root, CONFIG, SPECS),
  registerMcp: (root) => registerTomlMcp(root, MCP),
  unregisterMcp: (root) => unregisterTomlMcp(root, MCP),

  sessionOutput: (context) => hookContext("SessionStart", context),
  promptOutput: (context) => hookContext("UserPromptSubmit", context),
};
