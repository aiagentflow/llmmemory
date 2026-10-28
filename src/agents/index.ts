import { antigravity } from "./antigravity.js";
import { claude } from "./claude.js";
import { codex } from "./codex.js";
import { cursor } from "./cursor.js";
import { gemini } from "./gemini.js";
import type { Agent } from "./types.js";

export type { Agent, HookInput, Wiring } from "./types.js";

/** Every agent llmmemory can wire, in the order they are reported. */
export const AGENTS: Agent[] = [claude, codex, gemini, cursor, antigravity];

export function agentNamed(name: string): Agent | undefined {
  return AGENTS.find((agent) => agent.name === name);
}

/** The agents named in a comma-separated list, or the first unknown name. */
export function parseAgents(list: string): { agents: Agent[] } | { unknown: string } {
  const agents: Agent[] = [];
  for (const name of list.split(",").map((n) => n.trim()).filter((n) => n.length > 0)) {
    const agent = agentNamed(name);
    if (!agent) return { unknown: name };
    if (!agents.includes(agent)) agents.push(agent);
  }
  return { agents };
}

export { antigravity, claude, codex, cursor, gemini };
