/**
 * Shared Redline config helpers.
 *
 * Claude Code installs provide CLAUDE_PLUGIN_DATA. Codex installs do not expose
 * that path, so they use REDLINE_CONFIG_PATH or ~/.redline/config.json.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export const CODEX_REVIEWER_DEFAULTS = {
  provider: "openrouter",
  model: "~openai/gpt-latest:nitro",
  effort: "medium",
};

export const CLAUDE_REVIEWER_DEFAULTS = {
  provider: "subscription",
  subscriptionModel: "opus",
  openrouterModel: "anthropic/claude-opus-4.7",
};

function configPath() {
  if (process.env.REDLINE_CONFIG_PATH) return process.env.REDLINE_CONFIG_PATH;
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  if (pluginData) return join(pluginData, "config.json");
  return join(homedir(), ".redline", "config.json");
}

export function loadConfig() {
  const path = configPath();
  if (!path || !existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return {};
  }
}

export function saveConfig(config) {
  const path = configPath();
  if (!path) return;
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}

function envOption(key) {
  return process.env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`];
}

function firstValue(values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") || null;
}

export function resolveApiKey() {
  // 1. Environment variable
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // 2. Plugin user config (set via CLAUDE_PLUGIN_OPTION_OPENROUTER_API_KEY)
  if (envOption("openrouter_api_key")) return envOption("openrouter_api_key");
  // 3. Stored config
  const config = loadConfig();
  return config.openrouter_api_key || null;
}

export function resolveCodexReviewerConfig(stored = loadConfig()) {
  return {
    provider: firstValue([
      stored.provider,
      envOption("provider"),
      process.env.REDLINE_CODEX_PROVIDER,
      CODEX_REVIEWER_DEFAULTS.provider,
    ]),
    model: firstValue([
      stored.model,
      envOption("model"),
      process.env.REDLINE_CODEX_MODEL,
      CODEX_REVIEWER_DEFAULTS.model,
    ]),
    effort: firstValue([
      stored.effort,
      envOption("effort"),
      process.env.REDLINE_CODEX_EFFORT,
      CODEX_REVIEWER_DEFAULTS.effort,
    ]),
  };
}

export function resolveClaudeOpenRouterApiKey(stored = loadConfig()) {
  return firstValue([
    process.env.REDLINE_CLAUDE_OPENROUTER_API_KEY,
    process.env.ANTHROPIC_AUTH_TOKEN,
    process.env.OPENROUTER_API_KEY,
    envOption("claude_openrouter_api_key"),
    envOption("openrouter_api_key"),
    stored.claude_openrouter_api_key,
    stored.openrouter_api_key,
  ]);
}

export function resolveClaudeReviewerConfig(stored = loadConfig()) {
  const provider = firstValue([
    stored.claude_provider,
    envOption("claude_provider"),
    process.env.REDLINE_CLAUDE_PROVIDER,
    CLAUDE_REVIEWER_DEFAULTS.provider,
  ]);

  const modelDefault = provider === "openrouter"
    ? CLAUDE_REVIEWER_DEFAULTS.openrouterModel
    : CLAUDE_REVIEWER_DEFAULTS.subscriptionModel;

  return {
    provider,
    model: firstValue([
      stored.claude_model,
      envOption("claude_model"),
      process.env.REDLINE_CLAUDE_MODEL,
      modelDefault,
    ]),
    openrouterApiKey: resolveClaudeOpenRouterApiKey(stored),
  };
}
