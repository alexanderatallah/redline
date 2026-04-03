import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const HOOK_COMMAND = "redline check";

export type HookScope = "local" | "shared";

/** Match any redline hook (current prompt type or legacy command type). */
function isRedlineHook(hook: { type: string; prompt?: string; command?: string }): boolean {
  if (hook.type === "prompt" && hook.prompt?.includes("/redline")) return true;
  if (hook.type === "command" && typeof hook.command === "string") {
    return hook.command.startsWith("redline");
  }
  return false;
}

/** Walk up from cwd to find the git repo root. */
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, ".git"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

interface HookEntry {
  type: string;
  command?: string;
  prompt?: string;
  timeout?: number;
}

interface HookGroup {
  matcher?: string;
  hooks: HookEntry[];
}

interface Settings {
  hooks?: Record<string, HookGroup[]>;
  [key: string]: unknown;
}

function settingsPath(projectRoot: string, scope: HookScope): string {
  if (scope === "shared") {
    return join(projectRoot, ".claude", "settings.json");
  }
  return join(projectRoot, ".claude", "settings.local.json");
}

async function readSettings(path: string): Promise<Settings> {
  try {
    const text = await Bun.file(path).text();
    return JSON.parse(text) as Settings;
  } catch {
    return {};
  }
}

async function writeSettings(path: string, settings: Settings): Promise<void> {
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  await Bun.write(path, JSON.stringify(settings, null, 2) + "\n");
}

/** Remove redline hooks from a single settings file. */
async function removeFromFile(path: string): Promise<boolean> {
  const settings = await readSettings(path);
  if (!settings.hooks?.Stop) return false;

  let removed = false;
  settings.hooks.Stop = settings.hooks.Stop
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((h) => {
        if (isRedlineHook(h)) {
          removed = true;
          return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.hooks.length > 0);

  if (removed) {
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    await writeSettings(path, settings);
  }
  return removed;
}

/** Install the redline Stop hook. Also removes any hook from the opposite scope. */
export async function installHook(
  projectRoot: string,
  scope: HookScope,
): Promise<{ installed: boolean; updated: boolean }> {
  // Clean the opposite scope to prevent duplicates
  const oppositeScope: HookScope = scope === "local" ? "shared" : "local";
  await removeFromFile(settingsPath(projectRoot, oppositeScope));

  const path = settingsPath(projectRoot, scope);
  const settings = await readSettings(path);

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  const newHook: HookEntry = { type: "command", command: HOOK_COMMAND, timeout: 10 };

  for (const group of settings.hooks.Stop) {
    for (let i = 0; i < group.hooks.length; i++) {
      if (isRedlineHook(group.hooks[i])) {
        if (group.hooks[i].type === "command" && group.hooks[i].command === HOOK_COMMAND) {
          return { installed: false, updated: false };
        }
        group.hooks[i] = newHook;
        await writeSettings(path, settings);
        return { installed: true, updated: true };
      }
    }
  }

  settings.hooks.Stop.push({ hooks: [newHook] });

  await writeSettings(path, settings);
  return { installed: true, updated: false };
}

/** Remove redline hooks from ALL settings files (both scopes). */
export async function removeHook(projectRoot: string): Promise<boolean> {
  let removed = false;
  for (const scope of ["local", "shared"] as HookScope[]) {
    const path = settingsPath(projectRoot, scope);
    if (await removeFromFile(path)) removed = true;
  }
  return removed;
}
