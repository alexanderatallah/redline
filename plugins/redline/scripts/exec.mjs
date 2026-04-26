#!/usr/bin/env node
/**
 * Config-aware wrapper around `codex exec`.
 *
 * Usage:
 *   exec.mjs review <diff-flag>...    -> codex exec review [-c flags] <diff-flag>
 *   exec.mjs rescue <task>            -> codex exec [-c flags] <task>
 *
 * Resolves provider/model/effort from (in order):
 *   1. $CLAUDE_PLUGIN_DATA/config.json (written by /redline:setup — most recent explicit action)
 *   2. $CLAUDE_PLUGIN_OPTION_* env vars (Claude Code userConfig — plugin UI)
 *   3. plugin.json defaults
 * API-key resolution is delegated to resolveApiKey() in lib/config.mjs.
 */

import { spawn } from "node:child_process";
import { loadConfig, resolveApiKey } from "./lib/config.mjs";
import { ensureCodexConfig } from "./lib/codex.mjs";

const DEFAULTS = {
  provider: "openrouter",
  model: "openai/gpt-5.4:nitro",
  effort: "medium",
};

function resolve(field, storedConfig) {
  const envKey = `CLAUDE_PLUGIN_OPTION_${field.toUpperCase()}`;
  return (
    storedConfig[field] ||
    process.env[envKey] ||
    DEFAULTS[field]
  );
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode !== "review" && mode !== "rescue") {
    console.error("Usage: exec.mjs <review|rescue> [args...]");
    process.exit(2);
  }
  if (mode === "rescue" && rest.length === 0) {
    console.error("exec.mjs rescue: missing task argument");
    process.exit(2);
  }

  const stored = loadConfig();
  const provider = resolve("provider", stored);
  const model = resolve("model", stored);
  const effort = resolve("effort", stored);

  const args = mode === "review" ? ["exec", "review"] : ["exec"];
  const env = { ...process.env };

  if (provider === "openrouter") {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      console.error(
        "Error: OpenRouter API key not found. Run /redline:setup or set OPENROUTER_API_KEY.",
      );
      process.exit(3);
    }
    env.OPENROUTER_API_KEY = apiKey;
    ensureCodexConfig();
    args.push("-c", 'model_provider="openrouter"');
    args.push("-c", `model="${model}"`);
    args.push("-c", `model_reasoning_effort="${effort}"`);
  }

  args.push(...rest);

  const child = spawn("codex", args, { env, stdio: "inherit" });
  child.on("error", (err) => {
    console.error(`Failed to spawn codex: ${err.message}`);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

main();
