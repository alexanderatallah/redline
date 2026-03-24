import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import type { Reviewer } from "./agents";

const REDLINE_MARKER = "redline check";

/** Match any redline hook command (current or legacy). */
function isRedlineHook(command: string): boolean {
  return command.startsWith("redline check") || command.startsWith("redline review");
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

// ============================================================
// Claude Code hooks (.claude/settings.local.json — Stop hook)
// ============================================================

interface HookEntry {
  type: string;
  command: string;
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

function claudeSettingsPath(projectRoot: string): string {
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

async function installClaudeHook(
  projectRoot: string,
  model?: string,
): Promise<{ installed: boolean; updated: boolean }> {
  const path = claudeSettingsPath(projectRoot);
  const settings = await readSettings(path);

  const parts = [REDLINE_MARKER];
  if (model) parts.push(model);
  const command = parts.join(" ");

  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  for (const group of settings.hooks.Stop) {
    for (let i = 0; i < group.hooks.length; i++) {
      if (isRedlineHook(group.hooks[i].command)) {
        if (group.hooks[i].command === command) {
          return { installed: false, updated: false };
        }
        group.hooks[i].command = command;
        await writeSettings(path, settings);
        return { installed: true, updated: true };
      }
    }
  }

  settings.hooks.Stop.push({
    hooks: [{ type: "command", command, timeout: 10 }],
  });

  await writeSettings(path, settings);
  return { installed: true, updated: false };
}

async function removeClaudeHook(projectRoot: string): Promise<boolean> {
  const path = claudeSettingsPath(projectRoot);
  const settings = await readSettings(path);

  if (!settings.hooks?.Stop) return false;

  let removed = false;
  settings.hooks.Stop = settings.hooks.Stop
    .map((group) => ({
      ...group,
      hooks: group.hooks.filter((h) => {
        if (isRedlineHook(h.command)) {
          removed = true;
          return false;
        }
        return true;
      }),
    }))
    .filter((group) => group.hooks.length > 0);

  if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  await writeSettings(path, settings);
  return removed;
}

// ============================================================
// Codex hooks (~/.codex/config.toml — session_start hook)
// ============================================================

const CODEX_MARKER_BEGIN = "# redline:begin";
const CODEX_MARKER_END = "# redline:end";

function codexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

async function installCodexHook(
  model?: string,
): Promise<{ installed: boolean; updated: boolean }> {
  const configPath = codexConfigPath();

  let existing = "";
  try {
    existing = await Bun.file(configPath).text();
  } catch {
    // no config file
  }

  // Build the command array for TOML
  const cmdParts = ["redline", "check", "--reviewer=claude"];
  if (model) cmdParts.push(model);
  const cmdToml = `[${cmdParts.map((p) => `"${p}"`).join(", ")}]`;

  const newBlock = [
    CODEX_MARKER_BEGIN,
    "[[hooks.session_start]]",
    'name = "redline"',
    `command = ${cmdToml}`,
    CODEX_MARKER_END,
  ].join("\n");

  // Check if block already exists
  const beginIdx = existing.indexOf(CODEX_MARKER_BEGIN);
  const endIdx = existing.indexOf(CODEX_MARKER_END);

  if (beginIdx >= 0 && endIdx >= 0) {
    const existingBlock = existing.slice(beginIdx, endIdx + CODEX_MARKER_END.length);
    if (existingBlock === newBlock) {
      return { installed: false, updated: false };
    }
    // Replace existing block
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + CODEX_MARKER_END.length);
    await Bun.write(configPath, before + newBlock + after);
    return { installed: true, updated: true };
  }

  // Append new block
  const separator = existing.endsWith("\n") ? "\n" : "\n\n";
  await Bun.write(configPath, existing + separator + newBlock + "\n");
  return { installed: true, updated: false };
}

async function removeCodexHook(): Promise<boolean> {
  const configPath = codexConfigPath();

  let existing = "";
  try {
    existing = await Bun.file(configPath).text();
  } catch {
    return false;
  }

  const beginIdx = existing.indexOf(CODEX_MARKER_BEGIN);
  const endIdx = existing.indexOf(CODEX_MARKER_END);

  if (beginIdx < 0 || endIdx < 0) return false;

  const before = existing.slice(0, beginIdx);
  const after = existing.slice(endIdx + CODEX_MARKER_END.length);
  const cleaned = (before + after).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  await Bun.write(configPath, cleaned);
  return true;
}

// ============================================================
// Public API — dispatch based on reviewer
// ============================================================

export async function installHook(
  projectRoot: string,
  reviewer: Reviewer,
  model?: string,
): Promise<{ installed: boolean; updated: boolean }> {
  if (reviewer === "claude") {
    return installCodexHook(model);
  }
  return installClaudeHook(projectRoot, model);
}

export async function removeHook(
  projectRoot: string,
  reviewer: Reviewer,
): Promise<boolean> {
  if (reviewer === "claude") {
    return removeCodexHook();
  }
  return removeClaudeHook(projectRoot);
}
