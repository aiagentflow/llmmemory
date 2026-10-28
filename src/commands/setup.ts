import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  isMcpRegistered,
  MCP_PATH,
  registeredHooks,
  registerHooks,
  registerMcp,
  SETTINGS_PATH,
  SettingsError,
  unregisterHooks,
  unregisterMcp,
} from "../settings.js";
import { globalDir, listMemories, memoriesDir, STORE_DIR } from "../store.js";

function report(json: boolean, data: object, lines: string[]): number {
  process.stdout.write(json ? `${JSON.stringify(data, null, 2)}\n` : `${lines.join("\n")}\n`);
  return 0;
}

function settingsFailure(error: unknown): number {
  if (!(error instanceof SettingsError)) throw error;
  process.stderr.write(`${error.message}\n`);
  return 1;
}

export function init(root: string, options: { json: boolean; mcp: boolean }): number {
  try {
    const store = memoriesDir(root, "project");
    const created = !existsSync(store);
    mkdirSync(store, { recursive: true });
    mkdirSync(memoriesDir(root, "global"), { recursive: true });
    const hooks = registerHooks(root);
    const mcp = options.mcp ? registerMcp(root) : false;
    return report(options.json, { store, created, hooks, mcp }, [
      `${created ? "Created" : "Found"} ${join(STORE_DIR, "memories")}/ for this project's memories.`,
      `Global memories live in ${memoriesDir(root, "global")}.`,
      hooks
        ? `Registered the SessionStart and UserPromptSubmit hooks in ${SETTINGS_PATH}.`
        : `Hooks already registered in ${SETTINGS_PATH}.`,
      ...(options.mcp
        ? [mcp ? `Added the llmmemory MCP server to ${MCP_PATH}; Claude Code asks you to approve it once.` : `MCP server already in ${MCP_PATH}.`]
        : []),
      "",
      "Memories are Markdown files. Commit .llmmemory/ to share them with your team, or add it to",
      ".gitignore to keep them to yourself.",
    ]);
  } catch (error) {
    return settingsFailure(error);
  }
}

export function status(root: string, options: { json: boolean }): number {
  try {
    const memories = listMemories(root);
    const project = memories.filter((m) => m.scope === "project").length;
    const [session, prompt] = registeredHooks(root);
    const mcp = isMcpRegistered(root);
    const initialized = existsSync(memoriesDir(root, "project"));
    const yes = (on: boolean) => (on ? "yes" : "no");
    return report(options.json, { root, initialized, project, global: memories.length - project, hooks: { session, prompt }, mcp }, [
      `Project:  ${root}${initialized ? "" : "  (not initialized: run llmmemory init)"}`,
      `Memories: ${project} project, ${memories.length - project} global (${globalDir()})`,
      `Hooks:    session start ${yes(session)}, prompt recall ${yes(prompt)}`,
      `MCP:      ${yes(mcp)}`,
    ]);
  } catch (error) {
    return settingsFailure(error);
  }
}

/** Unwires llmmemory. Memories are the user's data and are never deleted here. */
export function clean(root: string, options: { json: boolean }): number {
  try {
    const hooks = unregisterHooks(root);
    const mcp = unregisterMcp(root);
    return report(options.json, { hooks, mcp }, [
      hooks ? `Removed the hooks from ${SETTINGS_PATH}.` : "No hooks to remove.",
      mcp ? `Removed the MCP server from ${MCP_PATH}.` : "No MCP server to remove.",
      `Memories were left in place: delete ${STORE_DIR}/ yourself if you no longer want them.`,
    ]);
  } catch (error) {
    return settingsFailure(error);
  }
}
