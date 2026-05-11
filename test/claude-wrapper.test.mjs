import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { extractClaudeStreamText } from "../plugins/redline/scripts/adapters/claude-code/reviewer.mjs";

const repoRoot = resolve(import.meta.dirname, "..");
const wrapperScript = join(repoRoot, "plugins/redline/scripts/claude.mjs");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function initGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), "redline-claude-"));
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

function createFakeClaude(dir) {
  const fake = join(dir, "fake-claude.mjs");
  writeFileSync(fake, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";

let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  stdin += chunk;
});
process.stdin.on("end", () => {
  writeFileSync(process.env.REDLINE_FAKE_OUT, JSON.stringify({
    args: process.argv.slice(2),
    env: {
      ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? null,
      ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN ?? null,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? null
    },
    stdin
  }, null, 2));
  console.log(JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "thinking", thinking: "hidden scratchpad" },
        { type: "text", text: "fake claude output" }
      ]
    }
  }));
  console.log(JSON.stringify({
    type: "result",
    subtype: "success",
    result: "duplicate final result"
  }));
});
`);
  chmodSync(fake, 0o755);
  return fake;
}

function envFor(fakeClaude, configPath, fakeOut) {
  const env = {
    ...process.env,
    REDLINE_CLAUDE_BIN: fakeClaude,
    REDLINE_CONFIG_PATH: configPath,
    REDLINE_FAKE_OUT: fakeOut,
  };
  delete env.ANTHROPIC_BASE_URL;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENROUTER_API_KEY;
  delete env.REDLINE_CLAUDE_PROVIDER;
  delete env.REDLINE_CLAUDE_MODEL;
  delete env.REDLINE_CLAUDE_OPENROUTER_API_KEY;
  return env;
}

test("Claude wrapper uses subscription auth by default and streams output", () => {
  const dir = initGitRepo();
  const temp = mkdtempSync(join(tmpdir(), "redline-fake-"));
  const fakeOut = join(temp, "out.json");
  const fakeClaude = createFakeClaude(temp);
  const configPath = join(temp, "config.json");
  writeFileSync(configPath, JSON.stringify({
    claude_provider: "subscription",
    claude_model: "opus",
  }));

  const result = run("node", [wrapperScript, "review"], {
    cwd: dir,
    env: envFor(fakeClaude, configPath, fakeOut),
  });

  const payload = JSON.parse(readFileSync(fakeOut, "utf8"));
  assert.match(result.stdout, /fake claude output/);
  assert.doesNotMatch(result.stdout, /hidden scratchpad/);
  assert.doesNotMatch(result.stdout, /duplicate final result/);
  assert.ok(!payload.args.includes("--bare"));
  assert.equal(payload.args[payload.args.indexOf("--model") + 1], "opus");
  assert.equal(payload.args[payload.args.indexOf("--output-format") + 1], "stream-json");
  assert.ok(payload.args.includes("--verbose"));
  assert.equal(payload.args[payload.args.indexOf("--setting-sources") + 1], "local");
  assert.ok(payload.args.includes("--disable-slash-commands"));
  assert.equal(payload.env.ANTHROPIC_BASE_URL, null);
  assert.match(payload.stdin, /standard code review/);
  assert.match(payload.stdin, /Diff:/);
  assert.match(payload.stdin, /\+two/);
});

test("Claude wrapper configures OpenRouter Anthropic-compatible env", () => {
  const dir = initGitRepo();
  const temp = mkdtempSync(join(tmpdir(), "redline-fake-"));
  const fakeOut = join(temp, "out.json");
  const fakeClaude = createFakeClaude(temp);
  const configPath = join(temp, "config.json");
  writeFileSync(configPath, JSON.stringify({
    claude_provider: "openrouter",
    claude_model: "anthropic/claude-opus-4.7",
    claude_openrouter_api_key: "sk-or-test",
  }));

  run("node", [wrapperScript, "adversarial"], {
    cwd: dir,
    env: envFor(fakeClaude, configPath, fakeOut),
  });

  const payload = JSON.parse(readFileSync(fakeOut, "utf8"));
  assert.equal(payload.args[0], "--bare");
  assert.equal(payload.args[payload.args.indexOf("--model") + 1], "anthropic/claude-opus-4.7");
  assert.equal(payload.env.ANTHROPIC_BASE_URL, "https://openrouter.ai/api");
  assert.equal(payload.env.ANTHROPIC_AUTH_TOKEN, "sk-or-test");
  assert.equal(payload.env.ANTHROPIC_API_KEY, "");
  assert.equal(payload.env.OPENROUTER_API_KEY, "sk-or-test");
  assert.match(payload.stdin, /adversarial review/i);
});

test("Claude wrapper rescue prompt is read-only and includes the task", () => {
  const dir = initGitRepo();
  const temp = mkdtempSync(join(tmpdir(), "redline-fake-"));
  const fakeOut = join(temp, "out.json");
  const fakeClaude = createFakeClaude(temp);
  const configPath = join(temp, "config.json");
  writeFileSync(configPath, JSON.stringify({
    claude_provider: "subscription",
    claude_model: "opus",
  }));

  run("node", [wrapperScript, "rescue", "debug the parser failure"], {
    cwd: dir,
    env: envFor(fakeClaude, configPath, fakeOut),
  });

  const payload = JSON.parse(readFileSync(fakeOut, "utf8"));
  assert.match(payload.stdin, /Do not modify files/);
  assert.match(payload.stdin, /debug the parser failure/);
  assert.match(payload.stdin, /suggested patches/);
});

test("Claude wrapper reports malformed review targets before spawning Claude", () => {
  const dir = initGitRepo();
  const temp = mkdtempSync(join(tmpdir(), "redline-fake-"));
  const fakeOut = join(temp, "out.json");
  const fakeClaude = createFakeClaude(temp);
  const configPath = join(temp, "config.json");
  writeFileSync(configPath, JSON.stringify({
    claude_provider: "subscription",
    claude_model: "opus",
  }));

  const result = spawnSync("node", [wrapperScript, "review", "--base"], {
    cwd: dir,
    encoding: "utf8",
    env: envFor(fakeClaude, configPath, fakeOut),
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /--base requires a branch or ref/);
});

test("Claude stream extraction ignores thinking and returns assistant text", () => {
  assert.equal(extractClaudeStreamText(JSON.stringify({
    type: "assistant",
    message: {
      content: [
        { type: "thinking", thinking: "do not show" },
        { type: "text", text: "visible review" },
      ],
    },
  })), "visible review");

  assert.equal(extractClaudeStreamText(JSON.stringify({
    type: "result",
    result: "fallback result",
  })), "fallback result");
});
