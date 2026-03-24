import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findProjectRoot } from "../lib/hooks";
import type { Reviewer } from "../lib/agents";
import { buildCodexReviewCommand, buildClaudeReviewCommand } from "../lib/agents";

// Loop guard: if we're already inside a review, don't trigger another
if (process.env.REDLINE_REVIEWING === "1") {
  process.exit(0);
}

function getDiffStat(): string {
  const result = Bun.spawnSync(["git", "diff", "--stat", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stat = result.stdout.toString().trim();
  if (stat) return stat;

  // Fall back to status for untracked files
  const status = Bun.spawnSync(["git", "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return status.stdout.toString().trim();
}

/** Simple string hash for comparing diff stats. */
function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

export function checkCommand(reviewer: Reviewer, model?: string): void {
  const diffStat = getDiffStat();
  if (!diffStat) {
    process.exit(0);
  }

  if (reviewer === "codex") {
    // Claude Code Stop hook — output JSON with diff stat + dedup
    const root = findProjectRoot();
    const hashFile = root ? join(root, ".git", "redline-last-diff") : null;
    const currentHash = hash(diffStat);

    if (hashFile && existsSync(hashFile)) {
      const lastHash = readFileSync(hashFile, "utf-8").trim();
      if (lastHash === currentHash) {
        process.exit(0);
      }
    }

    if (hashFile) {
      writeFileSync(hashFile, currentHash);
    }

    const reviewCmd = buildCodexReviewCommand(model);

    console.log(JSON.stringify({
      decision: "block",
      reason: `Redline: Here is a summary of uncommitted changes since the last review:\n\n${diffStat}\n\nIf these changes are substantial enough to warrant a code review (e.g., new logic, bug fixes, refactors — not just formatting or comments), run the following command as a background task:\n\n${reviewCmd}\n\nIf the changes are trivial, or a review is already running, skip it. When a review completes, assess the findings and inform the user of any issues.`,
    }));
  } else {
    // Codex SessionStart hook — output plain text instructions
    const reviewCmd = buildClaudeReviewCommand(model);

    console.log(`[Redline] Automatic code review is enabled. After making significant code changes (new logic, bug fixes, refactors), run the following command as a background task:

${reviewCmd}

Guidelines:
- Only run the review after substantial changes, not after trivial edits (formatting, comments)
- Skip if a review is already running in the background
- When a review completes, assess the findings and inform the user of any issues
- The review agent will examine all uncommitted changes including new files`);
  }
}
