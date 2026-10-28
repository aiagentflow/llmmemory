import { spawnSync } from "node:child_process";
import { AGENTS } from "../agents/index.js";
import { MCP_SERVER, SettingsError } from "../settings.js";
import { TOOLS } from "../mcp.js";

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/** Why a command the agent runs did not answer as expected, in words. */
function failure(status: number | null, stderr: string): string {
  if (status === 127 || /not found|not recognized/i.test(stderr)) {
    return "llmmemory is not on the PATH the agent uses. Install it globally: npm install -g llmmemory";
  }
  return `exited ${status ?? "on a signal"}${stderr.trim() ? `: ${stderr.trim().split("\n")[0]}` : ""}`;
}

/** Runs the session hook exactly as the agent would and checks the index comes back. */
function checkSession(root: string, command: string, payload: unknown): Pick<Check, "ok" | "detail"> {
  const result = spawnSync(command, { cwd: root, shell: true, input: JSON.stringify(payload), encoding: "utf8", timeout: 10_000 });
  if (result.status !== 0) return { ok: false, detail: failure(result.status, result.stderr ?? "") };
  return result.stdout.includes("llmmemory")
    ? { ok: true, detail: "hands over the memory index" }
    : { ok: false, detail: "ran but printed no memory index" };
}

/** Starts the MCP server the way agents do and asks it for its tools. */
function checkMcp(root: string): Pick<Check, "ok" | "detail"> {
  const messages = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "doctor", version: "0" } } },
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
  ];
  const command = [MCP_SERVER.command, ...MCP_SERVER.args].join(" ");
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    input: messages.map((m) => JSON.stringify(m)).join("\n") + "\n",
    encoding: "utf8",
    timeout: 10_000,
  });
  if (result.status !== 0) return { ok: false, detail: failure(result.status, result.stderr ?? "") };
  try {
    const replies = result.stdout.trim().split("\n").map((line) => JSON.parse(line) as { id?: number; result?: { tools?: unknown[] } });
    const tools = replies.find((reply) => reply.id === 2)?.result?.tools?.length ?? 0;
    return tools === TOOLS.length
      ? { ok: true, detail: `answers with ${tools} tools` }
      : { ok: false, detail: `answered with ${tools} tools, expected ${TOOLS.length}` };
  } catch {
    return { ok: false, detail: "answered with something that is not MCP" };
  }
}

/**
 * Hooks fail quietly by design, so a broken install looks exactly like an
 * empty memory. doctor runs every wired hook and the MCP server for real, the
 * way the agents do, and says which ones answered.
 */
export function doctor(root: string, options: { json: boolean }): number {
  let checks: Check[];
  try {
    const wired = AGENTS.map((agent) => ({ agent, wiring: agent.wiring(root) }));
    checks = wired
      .filter(({ wiring }) => wiring.session)
      .map(({ agent }) => ({ name: `${agent.label} session hook`, ...checkSession(root, agent.sessionCommand, agent.probe(root)) }));
    if (wired.some(({ wiring }) => wiring.mcp)) checks.push({ name: "MCP server", ...checkMcp(root) });
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    process.stderr.write(`${error.message}\n`);
    return 1;
  }

  const ok = checks.length > 0 && checks.every((check) => check.ok);
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok, checks }, null, 2)}\n`);
  } else if (checks.length === 0) {
    process.stdout.write("Nothing is wired in this project. Run llmmemory init.\n");
  } else {
    const lines = checks.map((check) => `${check.ok ? "ok  " : "FAIL"}  ${check.name.padEnd(28)}${check.detail}`);
    process.stdout.write(`${lines.join("\n")}\n`);
  }
  return ok ? 0 : 1;
}
