import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const CLI = fileURLToPath(new URL("../dist/index.js", import.meta.url));

/** A fresh project directory and global store, so tests never touch the real ones. */
export function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "llmmemory-test-"));
  const project = join(dir, "project");
  const home = join(dir, "home");
  process.env.LLMMEMORY_HOME = home;
  return { dir, project, home };
}

export function run(cwd, home, args, input) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    input,
    encoding: "utf8",
    env: { ...process.env, LLMMEMORY_HOME: home },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}
