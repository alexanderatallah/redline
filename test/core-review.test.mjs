import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildReviewerPrompt,
  collectReviewContext,
  parseReviewTarget,
} from "../plugins/redline/scripts/core/review.mjs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "redline-core-"));
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
  appendFileSync(join(dir, "file.txt"), "two\n");
  return dir;
}

function commitAll(dir, message) {
  run("git", ["add", "."], { cwd: dir });
  run("git", [
    "-c",
    "user.email=test@example.com",
    "-c",
    "user.name=Redline Test",
    "commit",
    "-m",
    message,
  ], { cwd: dir });
  return run("git", ["rev-parse", "HEAD"], { cwd: dir }).stdout.trim();
}

test("parseReviewTarget handles supported target forms", () => {
  assert.deepEqual(parseReviewTarget([]), {
    kind: "uncommitted",
    label: "uncommitted changes",
  });
  assert.deepEqual(parseReviewTarget(["last", "3", "commits"]), {
    kind: "base",
    base: "HEAD~3",
    label: "last 3 commits",
  });
  assert.deepEqual(parseReviewTarget(["--base", "main"]), {
    kind: "base",
    base: "main",
    label: "changes against main",
  });
  assert.deepEqual(parseReviewTarget(["commit", "abc123"]), {
    kind: "commit",
    commit: "abc123",
    label: "commit abc123",
  });
  assert.deepEqual(parseReviewTarget(["against", "release"]), {
    kind: "base",
    base: "release",
    label: "changes against release",
  });
  assert.throws(() => parseReviewTarget(["--base"]), /requires a branch or ref/);
  assert.throws(() => parseReviewTarget(["--commit"]), /requires a commit SHA/);
});

test("collectReviewContext reads uncommitted diff from target cwd", () => {
  const dir = initGitRepo();
  const context = collectReviewContext(parseReviewTarget([]), { cwd: dir });

  assert.match(context.status, /M file\.txt/);
  assert.match(context.stat, /file\.txt/);
  assert.match(context.diff, /\+two/);
});

test("collectReviewContext reads base and commit targets", () => {
  const dir = initGitRepo();
  const latest = commitAll(dir, "second");

  const baseContext = collectReviewContext(parseReviewTarget(["--base", "HEAD~1"]), { cwd: dir });
  assert.match(baseContext.stat, /file\.txt/);
  assert.match(baseContext.diff, /\+two/);

  const commitContext = collectReviewContext(parseReviewTarget(["--commit", latest]), { cwd: dir });
  assert.match(commitContext.stat, /file\.txt/);
  assert.match(commitContext.diff, /\+two/);
});

test("buildReviewerPrompt selects review modes and includes context", () => {
  const dir = initGitRepo();

  const review = buildReviewerPrompt("review", [], { cwd: dir });
  assert.match(review, /standard code review/);
  assert.match(review, /Diff:/);
  assert.match(review, /\+two/);

  const adversarial = buildReviewerPrompt("adversarial", [], { cwd: dir });
  assert.match(adversarial, /adversarial review/i);
  assert.match(adversarial, /Challenge design decisions/);

  const rescue = buildReviewerPrompt("rescue", ["debug", "the", "parser"], { cwd: dir });
  assert.match(rescue, /rescue help/);
  assert.match(rescue, /debug the parser/);
  assert.match(rescue, /suggested patches/);
});
