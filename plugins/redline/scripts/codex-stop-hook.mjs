#!/usr/bin/env node
/**
 * Codex Stop hook nudge for Redline.
 *
 * This intentionally mirrors the checked-in Claude Stop hook: no diff hashing,
 * no hidden review call, just a fast prompt when uncommitted changes exist.
 */

import {
  codexStopHookDecision,
  parseHookInput,
  readHookStdin,
} from "./adapters/codex/stop-hook.mjs";

async function main() {
  const event = parseHookInput(await readHookStdin());
  const decision = codexStopHookDecision(event);
  if (decision) console.log(JSON.stringify(decision));
}

main().catch(() => {
  process.exit(0);
});
