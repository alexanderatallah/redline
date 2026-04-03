import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findProjectRoot } from "../lib/hooks";

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/** Stop hook handler. Reads event JSON from stdin, decides whether to trigger a review. */
export async function checkCommand(): Promise<void> {
  // Read the Stop event JSON from stdin
  try {
    const input = await Bun.stdin.text();
    const event = JSON.parse(input);
    if (event.stop_hook_active) {
      // Already continuing from a previous stop hook — don't block again
      process.exit(0);
    }
  } catch {
    // No stdin or invalid JSON — proceed
  }

  // Check for uncommitted changes
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const changes = status.stdout.toString().trim();
  if (!changes) {
    process.exit(0);
  }

  // Get a readable diff summary
  const diff = Bun.spawnSync(["git", "diff", "--stat", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const diffStat = diff.stdout.toString().trim() || changes;

  // Deduplicate: skip if the diff hasn't changed since last review trigger
  const root = findProjectRoot();
  const hashFile = root ? join(root, ".git", "redline-last-diff") : null;
  const currentHash = hash(diffStat);

  if (hashFile && existsSync(hashFile)) {
    const lastHash = readFileSync(hashFile, "utf-8").trim();
    if (lastHash === currentHash) {
      process.exit(0); // same changes as last review — skip
    }
  }

  // Save hash so we don't re-trigger for the same diff
  if (hashFile) {
    writeFileSync(hashFile, currentHash);
  }

  const hookOutput = {
    decision: "block",
    reason: `Redline: Uncommitted changes detected:\n\n${diffStat}\n\nIf these are significant code changes (not just formatting or comments), invoke /redline to run a background code review. If trivial or a review is already running, skip it.`,
  };

  console.log(JSON.stringify(hookOutput));
}
