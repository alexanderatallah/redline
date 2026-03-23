import { loadConfig, saveConfig, maskKey, type Config } from "../lib/config-store";
import { log } from "../lib/prompts";

const ALLOWED_KEYS: (keyof Config)[] = [
  "openrouter_api_key",
  "user_id",
  "default_coding_agent",
  "default_review_agent",
];

export async function configCommand(args: string[]): Promise<void> {
  const sub = args[0];

  if (sub === "set") {
    const key = args[1] as keyof Config | undefined;
    const value = args[2];
    if (!key || !value) {
      log.error("Usage: vigil config set <key> <value>");
      process.exit(1);
    }
    if (!ALLOWED_KEYS.includes(key)) {
      log.error(`Unknown config key: ${key}`);
      log.info(`Allowed keys: ${ALLOWED_KEYS.join(", ")}`);
      process.exit(1);
    }
    const config = await loadConfig();
    (config as Record<string, string>)[key] = value;
    await saveConfig(config);
    log.success(`Set ${key}`);
    return;
  }

  if (sub === "reset") {
    await saveConfig({});
    log.success("Config reset to defaults");
    return;
  }

  // Default: show config
  const config = await loadConfig();
  if (Object.keys(config).length === 0) {
    log.info("No config set. Run `vigil login` to authenticate.");
    return;
  }
  for (const [key, value] of Object.entries(config)) {
    const display =
      key === "openrouter_api_key" && typeof value === "string"
        ? maskKey(value)
        : value;
    console.log(`  ${key}: ${display}`);
  }
}
