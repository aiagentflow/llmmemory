import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));

/** A fresh project directory and global store, so tests never touch the real ones. */
export function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "llmmemory-test-"));
  const project = join(dir, "project");
  const home = join(dir, "home");
  // An `llmmemory` command on PATH, as a global install provides, for the hooks to call.
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "llmmemory"), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`);
  chmodSync(join(bin, "llmmemory"), 0o755);
  process.env.LLMMEMORY_HOME = home;
  return { dir, project, home, bin };
}

export function run(cwd, home, args, input, env = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, LLMMEMORY_HOME: home, ...env },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}
