#!/usr/bin/env node
/**
 * Config-aware wrapper around `codex exec`.
 *
 * Usage:
 *   exec.mjs review <diff-flag>...    -> codex exec review [-c flags] <diff-flag>
 *   exec.mjs rescue <task>            -> codex exec [-c flags] <task>
 *
 * Resolves provider/model/effort from shared Redline config helpers.
 * API-key resolution is delegated to resolveApiKey() in lib/config.mjs.
 */

import { spawn } from "node:child_process";
import { resolveApiKey, resolveCodexReviewerConfig } from "./lib/config.mjs";
import { ensureCodexConfig } from "./lib/codex.mjs";

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

  const { provider, model, effort } = resolveCodexReviewerConfig();

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
