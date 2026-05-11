#!/usr/bin/env node
/**
 * Config-aware wrapper around `claude -p` for Codex-side Redline skills.
 *
 * Usage:
 *   claude.mjs review [target]
 *   claude.mjs adversarial [target]
 *   claude.mjs rescue <task>
 */

import { runClaudeReview } from "./adapters/claude-code/reviewer.mjs";

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  runClaudeReview(mode, rest);
}

main();
