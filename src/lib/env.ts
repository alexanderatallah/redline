import { homedir } from "node:os";
import { join } from "node:path";

export function claudeEnv(apiKey: string): Record<string, string> {
  return {
    ANTHROPIC_BASE_URL: "https://openrouter.ai/api",
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_API_KEY: "",
  };
}

export function codexEnv(apiKey: string): Record<string, string> {
  return {
    OPENROUTER_API_KEY: apiKey,
  };
}

/**
 * Ensure ~/.codex/config.toml has the [model_providers.openrouter] block.
 * Merges non-destructively — preserves existing user config.
 */
export async function ensureCodexConfig(): Promise<void> {
  const codexDir = join(homedir(), ".codex");
  const configPath = join(codexDir, "config.toml");

  // Ensure directory exists
  Bun.spawnSync(["mkdir", "-p", codexDir]);

  let existing = "";
  try {
    existing = await Bun.file(configPath).text();
  } catch {
    // File doesn't exist yet
  }

  // Check if OpenRouter model_provider is already configured
  if (existing.includes("[model_providers.openrouter]")) {
    return; // Already configured
  }

  const block = `
# Added by vigil
[model_providers.openrouter]
name = "openrouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
`;

  await Bun.write(configPath, existing + block);
}
