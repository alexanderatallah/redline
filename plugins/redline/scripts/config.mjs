#!/usr/bin/env node
/**
 * CLI wrapper around lib/config.mjs for use from /redline:setup.
 *
 * Usage:
 *   config.mjs set key=value [key=value ...]
 *   config.mjs get [key ...]   # effective value
 *   config.mjs show            # raw config.json contents
 *
 * Writes to $CLAUDE_PLUGIN_DATA/config.json when running inside Claude Code,
 * or REDLINE_CONFIG_PATH / ~/.redline/config.json for Codex installs.
 */

import {
  CLAUDE_REVIEWER_DEFAULTS,
  CODEX_REVIEWER_DEFAULTS,
  loadConfig,
  resolveApiKey,
  resolveClaudeOpenRouterApiKey,
  resolveClaudeReviewerConfig,
  resolveCodexReviewerConfig,
  saveConfig,
} from "./lib/config.mjs";

const ALLOWED_KEYS = new Set([
  "provider",
  "model",
  "effort",
  "openrouter_api_key",
  "claude_provider",
  "claude_model",
  "claude_openrouter_api_key",
]);

function effectiveValue(key, stored) {
  if (key === "openrouter_api_key") return resolveApiKey() || "";
  if (key === "claude_openrouter_api_key") {
    return resolveClaudeOpenRouterApiKey(stored) || "";
  }
  if (key === "claude_provider") return resolveClaudeReviewerConfig(stored).provider;
  if (key === "claude_model") return resolveClaudeReviewerConfig(stored).model;
  if (key === "provider") return resolveCodexReviewerConfig(stored).provider;
  if (key === "model") return resolveCodexReviewerConfig(stored).model;
  if (key === "effort") return resolveCodexReviewerConfig(stored).effort;
  const envKey = `CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`;
  return stored[key] || process.env[envKey] || "";
}

function parsePairs(pairs) {
  const out = {};
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq < 0) {
      console.error(`Invalid argument "${pair}" (expected key=value).`);
      process.exit(2);
    }
    const key = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    if (!ALLOWED_KEYS.has(key)) {
      console.error(
        `Unknown key "${key}". Allowed: ${[...ALLOWED_KEYS].join(", ")}`,
      );
      process.exit(2);
    }
    out[key] = value;
  }
  return out;
}

const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "set") {
  const updates = parsePairs(rest);
  const config = { ...loadConfig(), ...updates };
  saveConfig(config);
  const keys = Object.keys(updates).join(", ");
  console.log(`Saved: ${keys}`);
} else if (cmd === "get") {
  const stored = loadConfig();
  const keys = rest.length === 0 ? [...ALLOWED_KEYS] : rest;
  for (const key of keys) {
    const value = effectiveValue(key, stored);
    console.log(rest.length === 0 ? `${key}=${value}` : value);
  }
} else if (cmd === "show") {
  console.log(JSON.stringify(loadConfig(), null, 2));
} else if (cmd === "defaults") {
  console.log(JSON.stringify({
    codex_reviewer: CODEX_REVIEWER_DEFAULTS,
    claude_reviewer: CLAUDE_REVIEWER_DEFAULTS,
  }, null, 2));
} else {
  console.error("Usage: config.mjs <set|get|show|defaults> [...]");
  process.exit(2);
}
