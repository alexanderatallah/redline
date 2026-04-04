/**
 * Plugin config helpers.
 * Reads/writes config from CLAUDE_PLUGIN_DATA or falls back to env vars.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function configPath() {
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  if (!pluginData) return null;
  return join(pluginData, "config.json");
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

export function resolveApiKey() {
  // 1. Environment variable
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  // 2. Plugin user config (set via CLAUDE_PLUGIN_OPTION_OPENROUTER_API_KEY)
  if (process.env.CLAUDE_PLUGIN_OPTION_OPENROUTER_API_KEY) {
    return process.env.CLAUDE_PLUGIN_OPTION_OPENROUTER_API_KEY;
  }
  // 3. Stored config
  const config = loadConfig();
  return config.openrouter_api_key || null;
}
