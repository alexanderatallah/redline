#!/usr/bin/env node
/**
 * Config-aware wrapper around `codex exec`.
 *
 * Usage:
 *   exec.mjs review <diff-flag>...    -> codex exec review [-c flags] <diff-flag>
 *   exec.mjs rescue <task>            -> codex exec [-c flags] <task>
 *
 * Delegates provider/model/effort/API-key handling to the Codex adapter.
 */

import { runCodexExec } from "./adapters/codex/reviewer.mjs";

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  runCodexExec(mode, rest);
}

main();
