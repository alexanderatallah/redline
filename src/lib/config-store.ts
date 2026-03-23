import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  openrouter_api_key?: string;
  user_id?: string;
  default_coding_agent?: string;
  default_review_agent?: string;
}

const CONFIG_DIR = join(homedir(), ".config", "vigil");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export async function loadConfig(): Promise<Config> {
  try {
    const text = await Bun.file(CONFIG_PATH).text();
    return JSON.parse(text) as Config;
  } catch {
    return {};
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await Bun.write(CONFIG_DIR + "/.keep", ""); // ensure dir exists
  const proc = Bun.spawnSync(["mkdir", "-p", CONFIG_DIR]);
  if (proc.exitCode !== 0) throw new Error("Failed to create config dir");

  await Bun.write(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  // Set restrictive permissions
  const chmod = Bun.spawnSync(["chmod", "600", CONFIG_PATH]);
  if (chmod.exitCode !== 0) throw new Error("Failed to set config permissions");
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 6) + "..." + key.slice(-4);
}
