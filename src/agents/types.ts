/** A hook payload, in llmmemory's terms. */
export interface HookInput {
  /** Directories to look for the project in, nearest first. */
  dirs: (string | undefined)[];
  sessionId?: string;
  /** The user's message, on the per-prompt hook. */
  prompt?: string;
  /** Why a session started, where the agent says: startup, resume, clear or compact. */
  source?: string;
}

export interface Wiring {
  /** The hook that hands over the memory index when a session starts. */
  session: boolean;
  /** The hook that recalls memories for each message; null where the agent has no such hook. */
  prompt: boolean | null;
  mcp: boolean;
}

/**
 * Everything llmmemory needs to know about one coding agent: where its hooks
 * and MCP servers are configured, what its payloads look like, and how it
 * expects context to be handed back. The memory itself is the same for all.
 */
export interface Agent {
  name: string;
  label: string;
  /** Project-relative file the hooks are registered in. */
  hooksPath: string;
  /** Project-relative file the MCP server is registered in. */
  mcpPath: string;
  /** A step the user has to take before the hooks or server run, printed by init and status. */
  setupNote?: string;
  /** The shell command the agent runs when a session starts. */
  sessionCommand: string;
  /** A session start payload for `doctor` to send through the hook. */
  probe(root: string): Record<string, unknown>;
  /** Whether the project already uses this agent, so init wires it by default. */
  detect(root: string): boolean;
  /** Throws SettingsError when a config file cannot be read safely. */
  wiring(root: string): Wiring;
  registerHooks(root: string): boolean;
  unregisterHooks(root: string): boolean;
  registerMcp(root: string): boolean;
  unregisterMcp(root: string): boolean;
  /** The hook payload in llmmemory's terms. */
  parse(payload: Record<string, unknown>): HookInput;
  /** Stdout handing context to the agent when a session starts. */
  sessionOutput(context: string): string;
  /** Stdout adding context to one message; only called for agents with a prompt hook. */
  promptOutput(context: string): string;
}

export function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}
