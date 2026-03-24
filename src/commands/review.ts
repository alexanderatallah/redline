import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlinkSync } from "node:fs";
import type { Reviewer } from "../lib/agents";
import {
  isCodexInstalled, buildCodexReviewArgs, getCodexEnv,
  isClaudeInstalled, buildClaudeReviewArgs, getClaudeEnv,
} from "../lib/agents";
import { ensureCodexConfig } from "../lib/env";
import { log } from "../lib/prompts";

interface ReviewOptions {
  reviewer: Reviewer;
  model?: string;
  apiKey: string;
}

export async function reviewCommand(opts: ReviewOptions): Promise<void> {
  const { apiKey, model, reviewer } = opts;

  if (reviewer === "codex") {
    await runCodexReview(apiKey, model);
  } else {
    await runClaudeReview(apiKey, model);
  }
}

async function runCodexReview(apiKey: string, model?: string): Promise<void> {
  if (!isCodexInstalled()) {
    log.error("codex CLI is not installed or not on PATH.");
    process.exit(1);
  }

  await ensureCodexConfig();

  const outputFile = join(tmpdir(), `redline-review-${Date.now()}.txt`);
  const args = buildCodexReviewArgs(outputFile, model);
  const env = {
    ...process.env,
    ...getCodexEnv(apiKey),
    REDLINE_REVIEWING: "1",
  };

  const proc = Bun.spawn(args, {
    cwd: process.cwd(),
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  let review = "";
  try {
    review = (await Bun.file(outputFile).text()).trim();
    try { unlinkSync(outputFile); } catch { /* ignore */ }
  } catch {
    // output was already streamed
  }

  if (exitCode !== 0 && !review) {
    log.error(`Codex review failed (exit ${exitCode}).`);
    process.exit(1);
  }

  if (review) {
    console.log("\n--- Review Summary ---\n");
    console.log(review);
  }
}

async function runClaudeReview(apiKey: string, model?: string): Promise<void> {
  if (!isClaudeInstalled()) {
    log.error("claude CLI is not installed or not on PATH.");
    process.exit(1);
  }

  const args = buildClaudeReviewArgs(model);
  const env = {
    ...process.env,
    ...getClaudeEnv(apiKey),
    REDLINE_REVIEWING: "1",
  };

  const proc = Bun.spawn(args, {
    cwd: process.cwd(),
    env,
    stdout: "inherit",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    log.error(`Claude review failed (exit ${exitCode}).`);
    process.exit(1);
  }
}
