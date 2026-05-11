import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const hookScript = join(repoRoot, "plugins/redline/scripts/codex-stop-hook.mjs");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "redline-hook-"));
  run("git", ["init"], { cwd: dir });
  writeFileSync(join(dir, "file.txt"), "one\n");
  run("git", ["add", "file.txt"], { cwd: dir });
  run("git", [
    "-c",
    "user.email=test@example.com",
    "-c",
    "user.name=Redline Test",
    "commit",
    "-m",
    "initial",
  ], { cwd: dir });
  return dir;
}

test("Codex Stop hook exits silently when another stop hook is active", () => {
  const dir = initGitRepo();
  appendFileSync(join(dir, "file.txt"), "two\n");

  const result = run("node", [hookScript], {
    cwd: dir,
    input: JSON.stringify({ stop_hook_active: true }),
  });

  assert.equal(result.stdout, "");
});

test("Codex Stop hook exits silently when there is no git diff", () => {
  const dir = initGitRepo();

  const result = run("node", [hookScript], {
    cwd: dir,
    input: JSON.stringify({ stop_hook_active: false }),
  });

  assert.equal(result.stdout, "");
});

test("Codex Stop hook blocks with redline:check prompt when a git diff exists", () => {
  const dir = initGitRepo();
  appendFileSync(join(dir, "file.txt"), "two\n");

  const result = run("node", [hookScript], {
    cwd: repoRoot,
    input: JSON.stringify({ cwd: dir, stop_hook_active: false }),
  });

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.decision, "block");
  assert.match(payload.reason, /\$redline:check/);
  assert.match(payload.reason, /\$redline:review/);
});
