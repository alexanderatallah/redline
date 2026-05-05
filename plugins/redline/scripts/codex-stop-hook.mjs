#!/usr/bin/env node
/**
 * Codex Stop hook nudge for Redline.
 *
 * This intentionally mirrors the checked-in Claude Stop hook: no diff hashing,
 * no hidden review call, just a fast prompt when uncommitted changes exist.
 */

import { execFileSync } from "node:child_process";

function readStdin() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
  });
}

function parseHookInput(input) {
  if (!input.trim()) return {};
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

function hasUncommittedChanges() {
  try {
    const stat = execFileSync("git", ["diff", "--stat", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return stat.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  const event = parseHookInput(await readStdin());
  if (event.stop_hook_active) return;

  if (event.cwd) {
    try {
      process.chdir(event.cwd);
    } catch {
      return;
    }
  }

  if (!hasUncommittedChanges()) return;

  console.log(JSON.stringify({
    decision: "block",
    reason:
      "Uncommitted changes are present. Use $redline-check to choose $redline-review, $redline-adversarial, $redline-rescue, or skip.",
  }));
}

main().catch(() => {
  process.exit(0);
});
