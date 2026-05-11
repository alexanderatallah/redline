import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadConfig,
  resolveClaudeReviewerConfig,
  resolveCodexReviewerConfig,
  saveConfig,
} from "../plugins/redline/scripts/core/config.mjs";

function withConfigPath(fn) {
  const dir = mkdtempSync(join(tmpdir(), "redline-config-"));
  const previous = {
    REDLINE_CONFIG_PATH: process.env.REDLINE_CONFIG_PATH,
    REDLINE_CLAUDE_PROVIDER: process.env.REDLINE_CLAUDE_PROVIDER,
    REDLINE_CLAUDE_MODEL: process.env.REDLINE_CLAUDE_MODEL,
    REDLINE_CLAUDE_OPENROUTER_API_KEY: process.env.REDLINE_CLAUDE_OPENROUTER_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_AUTH_TOKEN,
  };
  process.env.REDLINE_CONFIG_PATH = join(dir, "config.json");
  delete process.env.REDLINE_CLAUDE_PROVIDER;
  delete process.env.REDLINE_CLAUDE_MODEL;
  delete process.env.REDLINE_CLAUDE_OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

test("config resolves existing Codex reviewer defaults", () => withConfigPath(() => {
  saveConfig({});
  assert.deepEqual(resolveCodexReviewerConfig(), {
    provider: "openrouter",
    model: "~openai/gpt-latest:nitro",
    effort: "medium",
  });
}));

test("config resolves Claude subscription reviewer", () => withConfigPath(() => {
  saveConfig({
    claude_provider: "subscription",
    claude_model: "opus",
  });

  assert.deepEqual(resolveClaudeReviewerConfig(), {
    provider: "subscription",
    model: "opus",
    openrouterApiKey: null,
  });
}));

test("config resolves Claude OpenRouter reviewer and key fallback", () => withConfigPath(() => {
  saveConfig({
    claude_provider: "openrouter",
    claude_model: "anthropic/claude-opus-4.7",
    openrouter_api_key: "sk-or-shared",
  });

  assert.deepEqual(loadConfig().openrouter_api_key, "sk-or-shared");
  assert.deepEqual(resolveClaudeReviewerConfig(), {
    provider: "openrouter",
    model: "anthropic/claude-opus-4.7",
    openrouterApiKey: "sk-or-shared",
  });
}));
