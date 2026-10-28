import { createInterface } from "node:readline";
import { search } from "./search.js";
import { findRoot, getMemory, listMemories, removeMemory, saveMemory, type Scope } from "./store.js";
import { VERSION } from "./version.js";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface Request {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const scopeSchema = {
  type: "string",
  enum: ["project", "global"],
  description: "project: only this project. global: every project, for facts about the user.",
};

export const TOOLS = [
  {
    name: "remember",
    description:
      "Save a fact worth keeping beyond this session: a user preference, a decision and why it was made, a non-obvious fact about the project. Pass name to update an existing memory instead of adding a near-duplicate.",
    inputSchema: {
      type: "object",
      properties: {
        fact: { type: "string", description: "The memory itself, in a sentence or a short paragraph." },
        description: { type: "string", description: "One-line summary shown in the index. Defaults to the first sentence." },
        tags: { type: "array", items: { type: "string" } },
        scope: { ...scopeSchema, default: "project" },
        name: { type: "string", description: "An existing memory's name, to update it." },
      },
      required: ["fact"],
    },
  },
  {
    name: "recall",
    description: "Search saved memories by keywords, best match first, and return them in full.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", default: 5 },
      },
      required: ["query"],
    },
  },
  {
    name: "read_memory",
    description: "Read one memory in full by name.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, scope: scopeSchema },
      required: ["name"],
    },
  },
  {
    name: "forget",
    description: "Delete a memory that turned out wrong or no longer applies.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, scope: scopeSchema },
      required: ["name"],
    },
  },
  {
    name: "list_memories",
    description: "List every saved memory's name and one-line summary.",
    inputSchema: { type: "object", properties: {} },
  },
];

class ToolError extends Error {}

function text(value: unknown, field: string, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new ToolError(`${field} must be a non-empty string.`);
  return value;
}

function scopeOf(value: unknown): Scope | undefined {
  if (value === undefined) return undefined;
  if (value !== "project" && value !== "global") throw new ToolError('scope must be "project" or "global".');
  return value;
}

function formatMemory(m: { name: string; scope: string; description: string; tags: string[]; updated: string; body: string }): string {
  const tags = m.tags.length > 0 ? `\ntags: ${m.tags.join(", ")}` : "";
  return `# ${m.name} (${m.scope})\n${m.description}${tags}\nupdated: ${m.updated.slice(0, 10)}\n\n${m.body}`;
}

/** Runs one tool call and returns its text result. */
export function callTool(root: string, name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "remember": {
      const tags = args.tags;
      if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))) {
        throw new ToolError("tags must be a list of strings.");
      }
      const { memory, updated } = saveMemory(root, {
        fact: text(args.fact, "fact")!,
        description: text(args.description, "description", false),
        tags: tags as string[] | undefined,
        name: text(args.name, "name", false),
        scope: scopeOf(args.scope) ?? "project",
      });
      return `${updated ? "Updated" : "Saved"} ${memory.scope} memory "${memory.name}".`;
    }
    case "recall": {
      const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(Math.floor(args.limit), 20) : 5;
      const hits = search(listMemories(root), text(args.query, "query")!, limit);
      if (hits.length === 0) return "No memories match.";
      return hits.map((hit) => formatMemory(hit.memory)).join("\n\n---\n\n");
    }
    case "read_memory": {
      const memory = getMemory(root, text(args.name, "name")!, scopeOf(args.scope));
      if (!memory) throw new ToolError(`No memory named "${String(args.name)}".`);
      return formatMemory(memory);
    }
    case "forget": {
      const memory = removeMemory(root, text(args.name, "name")!, scopeOf(args.scope));
      if (!memory) throw new ToolError(`No memory named "${String(args.name)}".`);
      return `Forgot ${memory.scope} memory "${memory.name}".`;
    }
    case "list_memories": {
      const memories = listMemories(root);
      if (memories.length === 0) return "No memories saved yet.";
      return memories.map((m) => `${m.name} (${m.scope}): ${m.description}`).join("\n");
    }
    default:
      throw new ToolError(`Unknown tool: ${name}`);
  }
}

/** The response to one JSON-RPC message, or null for a notification. */
export function handle(root: string, request: Request): object | null {
  const { id, method, params = {} } = request;
  if (id === undefined || id === null) return null;
  const reply = (result: object) => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize": {
      const asked = params.protocolVersion;
      const version = typeof asked === "string" && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      return reply({
        protocolVersion: version,
        capabilities: { tools: {} },
        serverInfo: { name: "llmmemory", version: VERSION },
        instructions:
          "Long-term memory that persists across sessions. Recall before answering questions about past decisions or preferences; remember durable facts as you learn them.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = params.arguments && typeof params.arguments === "object" ? (params.arguments as Record<string, unknown>) : {};
      if (!TOOLS.some((tool) => tool.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        return reply({ content: [{ type: "text", text: callTool(root, name, args) }] });
      } catch (error) {
        // Tool failures go back to the model as results it can act on.
        return reply({ content: [{ type: "text", text: (error as Error).message }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

/** MCP over stdio: one JSON-RPC message per line in, one per line out. */
export async function serve(): Promise<number> {
  const root = findRoot(process.cwd()) ?? process.cwd();
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    let response: object | null;
    try {
      const request = JSON.parse(line) as Request;
      response = typeof request?.method === "string"
        ? handle(root, request)
        : { jsonrpc: "2.0", id: request?.id ?? null, error: { code: -32600, message: "Invalid request" } };
    } catch {
      response = { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } };
    }
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
  return 0;
}
