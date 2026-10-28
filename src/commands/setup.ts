import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { AGENTS, type Agent, type Wiring } from "../agents/index.js";
import { SettingsError } from "../settings.js";
import { displayPath, globalDir, listMemories, memoriesDir, STORE_DIR } from "../store.js";

function report(json: boolean, data: object, lines: string[]): number {
  process.stdout.write(json ? `${JSON.stringify(data, null, 2)}\n` : `${lines.join("\n")}\n`);
  return 0;
}

function settingsFailure(error: unknown): number {
  if (!(error instanceof SettingsError)) throw error;
  process.stderr.write(`${error.message}\n`);
  return 1;
}

function isWired(wiring: Wiring): boolean {
  return wiring.session || wiring.prompt === true || wiring.mcp;
}

/** What one agent gets, in words. */
function describeWiring(agent: Agent, wiring: Wiring): string {
  const parts = [
    `memory index ${wiring.session ? "on" : "off"}`,
    wiring.prompt === null ? "recall by MCP only" : `auto recall ${wiring.prompt ? "on" : "off"}`,
    `MCP ${wiring.mcp ? "on" : "off"}`,
  ];
  return `  ${agent.label.padEnd(16)}${parts.join(", ")}`;
}

export interface InitOptions {
  json: boolean;
  mcp: boolean;
  /** The agents to wire; by default Claude Code plus any agent the project already uses. */
  agents?: Agent[];
}

export function init(root: string, options: InitOptions): number {
  try {
    const agents = options.agents ?? AGENTS.filter((agent) => agent.detect(root));
    const store = memoriesDir(root, "project");
    const created = !existsSync(store);
    mkdirSync(store, { recursive: true });
    mkdirSync(memoriesDir(root, "global"), { recursive: true });

    const wired = agents.map((agent) => {
      agent.registerHooks(root);
      if (options.mcp) agent.registerMcp(root);
      return { agent, wiring: agent.wiring(root) };
    });
    const notes = agents.flatMap((agent) => (agent.setupNote ? [agent.setupNote] : []));

    return report(
      options.json,
      { store, created, agents: Object.fromEntries(wired.map(({ agent, wiring }) => [agent.name, wiring])), notes },
      [
        `${created ? "Created" : "Found"} ${join(STORE_DIR, "memories")}/ for this project's memories.`,
        `Global memories live in ${displayPath(memoriesDir(root, "global"))}/.`,
        "",
        "Wired:",
        ...wired.map(({ agent, wiring }) => describeWiring(agent, wiring)),
        ...(notes.length > 0 ? ["", ...notes] : []),
        ...(options.mcp && agents.some((agent) => agent.name === "claude")
          ? ["", "Claude Code asks you to approve the project's MCP server once."]
          : []),
        "",
        "Memories are Markdown files. Commit .llmmemory/ to share them with your team, or add it to",
        ".gitignore to keep them to yourself.",
      ],
    );
  } catch (error) {
    return settingsFailure(error);
  }
}

export function status(root: string, options: { json: boolean }): number {
  try {
    const memories = listMemories(root);
    const project = memories.filter((m) => m.scope === "project").length;
    const initialized = existsSync(memoriesDir(root, "project"));
    const agents = AGENTS.map((agent) => ({ agent, wiring: agent.wiring(root) }));
    // An agent the project does not use and llmmemory never wired is noise.
    const shown = agents.filter(({ agent, wiring }) => isWired(wiring) || (agent.name !== "claude" && agent.detect(root)));
    const notes = shown.flatMap(({ agent, wiring }) => (agent.setupNote && isWired(wiring) ? [agent.setupNote] : []));

    return report(
      options.json,
      {
        root,
        initialized,
        project,
        global: memories.length - project,
        agents: Object.fromEntries(agents.map(({ agent, wiring }) => [agent.name, wiring])),
      },
      [
        `Project:  ${displayPath(root) || "."}${initialized ? "" : "  (not initialized: run llmmemory init)"}`,
        `Memories: ${project} project, ${memories.length - project} global (${displayPath(globalDir())})`,
        "Agents:",
        ...(shown.length > 0 ? shown.map(({ agent, wiring }) => describeWiring(agent, wiring)) : ["  none wired"]),
        ...(notes.length > 0 ? ["", ...notes] : []),
      ],
    );
  } catch (error) {
    return settingsFailure(error);
  }
}

/** Unwires llmmemory from every agent. Memories are the user's data and are never deleted here. */
export function clean(root: string, options: { json: boolean }): number {
  try {
    const removed = AGENTS.filter((agent) => {
      const hooks = agent.unregisterHooks(root);
      const mcp = agent.unregisterMcp(root);
      return hooks || mcp;
    });
    return report(options.json, { unwired: removed.map((agent) => agent.name) }, [
      removed.length > 0 ? `Unwired ${removed.map((agent) => agent.label).join(", ")}.` : "Nothing was wired.",
      `Memories were left in place: delete ${STORE_DIR}/ yourself if you no longer want them.`,
    ]);
  } catch (error) {
    return settingsFailure(error);
  }
}
