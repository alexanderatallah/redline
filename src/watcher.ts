#!/usr/bin/env bun
/**
 * Vigil background watcher — polls .vigil/tasks/ for new task files
 * and invokes the review agent to review changes.
 */

import { join } from "node:path";
import { parseArgs } from "node:util";
import { appendFileSync } from "node:fs";
import { AGENTS, type AgentName } from "./lib/agents";
import {
  listTaskFiles,
  listReviewFiles,
  readTaskFile,
  writeReviewFile,
  writeWatcherPid,
} from "./lib/protocol";

const POLL_INTERVAL_MS = 5_000;

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "review-agent": { type: "string" },
    "api-key": { type: "string" },
    "vigil-dir": { type: "string" },
    "repo-root": { type: "string" },
  },
});

const reviewAgentName = values["review-agent"] as AgentName;
const apiKey = values["api-key"]!;
const vigilDir = values["vigil-dir"]!;
const repoRoot = values["repo-root"]!;
const logFile = join(vigilDir, "watcher.log");

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    appendFileSync(logFile, line);
  } catch {
    // ignore
  }
}

/** Get the set of task names that already have reviews. */
function getReviewedTaskNames(): Set<string> {
  const reviews = listReviewFiles(repoRoot);
  const names = new Set<string>();
  for (const r of reviews) {
    const match = r.match(/review-(.+)\.md$/);
    if (match) names.add(match[1]);
  }
  return names;
}

/** Extract the task name from a task filename. */
function extractTaskName(filename: string): string | null {
  const match = filename.match(/^\d{4}-\d{2}-\d{2}T[\d-]+-(.+)\.md$/);
  return match ? match[1] : null;
}

async function runReview(taskFilename: string): Promise<void> {
  const taskName = extractTaskName(taskFilename);
  if (!taskName) return;

  const taskPath = join(repoRoot, ".vigil", "tasks", taskFilename);
  const meta = readTaskFile(taskPath);
  if (!meta) {
    log(`Skipping ${taskFilename}: could not parse frontmatter`);
    return;
  }

  const agent = AGENTS[reviewAgentName];
  const env = { ...process.env, ...agent.getEnv(apiKey) };

  log(`Reviewing task "${taskName}" with ${agent.displayName}...`);

  let reviewBody: string;

  if (reviewAgentName === "codex") {
    // Use codex exec review --uncommitted -o <file>
    const outputFile = join(vigilDir, `review-output-${taskName}.txt`);
    const args = agent.buildReviewArgs(outputFile);
    const proc = Bun.spawnSync(args, {
      cwd: repoRoot,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (proc.exitCode !== 0) {
      log(`Codex review failed (exit ${proc.exitCode}): ${proc.stderr.toString()}`);
      // Fall back to reading stdout
      reviewBody = proc.stdout.toString().trim();
      if (!reviewBody) return;
    } else {
      // Read from output file, fall back to stdout
      try {
        reviewBody = await Bun.file(outputFile).text();
      } catch {
        reviewBody = proc.stdout.toString().trim();
      }
      // Clean up temp file
      try {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(outputFile);
      } catch {
        // ignore
      }
    }
  } else {
    // Use claude -p --dangerously-skip-permissions "<prompt>"
    const prompt = `Review the recent uncommitted changes in this repository. The task was: "${meta.description}". Run git diff to see the changes. Identify bugs, security issues, and suggest improvements. Be thorough but concise.`;
    const args = [...agent.buildReviewArgs(""), prompt];
    const proc = Bun.spawnSync(args, {
      cwd: repoRoot,
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    if (proc.exitCode !== 0) {
      log(`Claude review failed (exit ${proc.exitCode}): ${proc.stderr.toString()}`);
      return;
    }
    reviewBody = proc.stdout.toString().trim();
  }

  if (!reviewBody) {
    log(`Empty review for task "${taskName}", skipping`);
    return;
  }

  const filename = await writeReviewFile(repoRoot, {
    task: taskName,
    agent: reviewAgentName,
    model: agent.defaultModel,
    timestamp: new Date().toISOString(),
  }, reviewBody);

  log(`Review written: ${filename}`);
}

async function poll() {
  const reviewed = getReviewedTaskNames();
  const tasks = listTaskFiles(repoRoot);

  for (const taskFile of tasks) {
    const taskName = extractTaskName(taskFile);
    if (!taskName || reviewed.has(taskName)) continue;

    try {
      await runReview(taskFile);
    } catch (err) {
      log(`Error reviewing ${taskFile}: ${(err as Error).message}`);
    }
    // Re-check reviewed set after each review
    reviewed.add(taskName);
  }
}

// --- Main ---

log(`Watcher started. Review agent: ${reviewAgentName}, repo: ${repoRoot}`);
await writeWatcherPid(repoRoot, process.pid);

// Graceful shutdown
let running = true;
process.on("SIGTERM", () => {
  log("Received SIGTERM, shutting down");
  running = false;
});
process.on("SIGINT", () => {
  log("Received SIGINT, shutting down");
  running = false;
});

// Poll loop
while (running) {
  try {
    await poll();
  } catch (err) {
    log(`Poll error: ${(err as Error).message}`);
  }
  await Bun.sleep(POLL_INTERVAL_MS);
}

log("Watcher stopped.");
