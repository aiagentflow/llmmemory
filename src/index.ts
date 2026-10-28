#!/usr/bin/env node
import { parseArgs } from "node:util";
import { add, find, forget, list, show } from "./commands/memories.js";
import { clean, init, status } from "./commands/setup.js";
import { promptHook, sessionStart } from "./hooks.js";
import { serve } from "./mcp.js";
import { findRoot, type Scope } from "./store.js";
import { VERSION } from "./version.js";

const HELP = `llmmemory ${VERSION}: long-term memory for AI coding agents

Usage
  llmmemory <command> [options]

Commands
  init                 Create .llmmemory/ and wire Claude Code's hooks and MCP server
  add <fact>           Save a memory ("-" reads it from stdin)
  list                 List memories
  search <words>       Find memories by keyword, best match first
  show <name>          Print one memory in full
  forget <name>        Delete a memory
  status               Show where memories live and what is wired
  clean                Unwire the hooks and MCP server; memories are kept
  mcp                  Run the MCP server on stdio
  session-start        Internal: SessionStart hook, prints the memory index
  prompt               Internal: UserPromptSubmit hook, recalls matching memories

Options
  --global             add, list, show, forget: the store shared by every project
  --project            list, show, forget: only this project's store
  --name <name>        add: update the memory with this name instead of adding one
  --description <text> add: one-line summary (default: the first sentence)
  --tags <a,b>         add: comma-separated tags
  --limit <n>          search: how many results (default 5)
  --no-mcp             init: wire only the hooks
  --json               Machine-readable output
  -h, --help           Show this help
  -v, --version        Show version
`;

/** Options each command accepts beyond --json and --help. */
const ALLOWED: Record<string, string[]> = {
  init: ["no-mcp"],
  add: ["global", "name", "description", "tags"],
  list: ["global", "project"],
  search: ["limit"],
  show: ["global", "project"],
  forget: ["global", "project"],
  status: [],
  clean: [],
};

/** How many positional arguments each command takes after its name. */
const ARGS: Record<string, number> = { add: 1, search: 1, show: 1, forget: 1 };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(argv: string[]): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv.slice(2),
      allowPositionals: true,
      options: {
        global: { type: "boolean" },
        project: { type: "boolean" },
        name: { type: "string" },
        description: { type: "string" },
        tags: { type: "string" },
        limit: { type: "string" },
        "no-mcp": { type: "boolean" },
        json: { type: "boolean" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    process.stderr.write(`${(error as Error).message.split(". ")[0]}. Run llmmemory --help for usage.\n`);
    return 1;
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;

  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (!command || values.help) {
    process.stdout.write(HELP);
    return 0;
  }

  // The hooks and the MCP server must never fail on arguments; they find their own root.
  if (command === "session-start") return sessionStart();
  if (command === "prompt") return promptHook();
  if (command === "mcp") return serve();

  const allowed = ALLOWED[command];
  if (allowed === undefined) {
    process.stderr.write(`Unknown command: ${command}\n\n${HELP}`);
    return 1;
  }
  const given = Object.keys(values).filter((key) => key !== "json" && key !== "help");
  const stray = given.find((key) => !allowed.includes(key));
  if (stray) {
    process.stderr.write(`${command} does not take --${stray}\n`);
    return 1;
  }
  const wanted = ARGS[command] ?? 0;
  // Unquoted words after add or search are one fact or query, not extra arguments.
  const arg = rest.join(" ");
  if (wanted === 1 && arg === "") {
    process.stderr.write(`${command} needs ${command === "search" ? "some words" : command === "add" ? "a fact" : "a name"}.\n`);
    return 1;
  }
  if (wanted === 0 && rest.length > 0) {
    process.stderr.write(`${command} takes no arguments: ${rest.join(" ")}\n`);
    return 1;
  }
  if (values.global && values.project) {
    process.stderr.write("Pass --global or --project, not both.\n");
    return 1;
  }

  // init sets up where it is run; everything else works on the nearest initialized project.
  const root = command === "init" ? process.cwd() : (findRoot(process.cwd()) ?? process.cwd());
  const json = values.json ?? false;
  const scope: Scope | undefined = values.global ? "global" : values.project ? "project" : undefined;

  switch (command) {
    case "init":
      return init(root, { json, mcp: !values["no-mcp"] });
    case "add": {
      const fact = arg === "-" ? await readStdin() : arg;
      const tags = values.tags?.split(",").map((t) => t.trim()).filter(Boolean);
      return add(root, fact, { json, scope: scope ?? "project", name: values.name, description: values.description, tags });
    }
    case "list":
      return list(root, { json, scope });
    case "search": {
      const limit = Number(values.limit ?? 5);
      if (!Number.isInteger(limit) || limit < 1) {
        process.stderr.write("--limit must be a positive whole number.\n");
        return 1;
      }
      return find(root, arg, { json, limit });
    }
    case "show":
      return show(root, arg, { json, scope });
    case "forget":
      return forget(root, arg, { json, scope });
    case "status":
      return status(root, { json });
    default:
      return clean(root, { json });
  }
}

process.exitCode = await main(process.argv);
