/**
 * Codex CLI helpers — environment vars and config.toml management.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export function codexEnv(apiKey) {
  return { OPENROUTER_API_KEY: apiKey };
}

/**
 * Ensure ~/.codex/config.toml has the [model_providers.openrouter] block.
 */
export function ensureCodexConfig() {
  const codexDir = join(homedir(), ".codex");
  const configPath = join(codexDir, "config.toml");

  if (!existsSync(codexDir)) mkdirSync(codexDir, { recursive: true });

  let existing = "";
  try {
    existing = readFileSync(configPath, "utf-8");
  } catch {
    // no config file
  }

  if (existing.includes("[model_providers.openrouter]")) return;

  const block = `
# Added by redline
[model_providers.openrouter]
name = "openrouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
`;

  writeFileSync(configPath, existing + block);
}
