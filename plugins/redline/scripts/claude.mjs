#!/usr/bin/env node
/**
 * Config-aware wrapper around `claude -p` for Codex-side Redline skills.
 *
 * Usage:
 *   claude.mjs review [target]
 *   claude.mjs adversarial [target]
 *   claude.mjs rescue <task>
 */

import { spawn, spawnSync } from "node:child_process";
import { resolveClaudeReviewerConfig } from "./lib/config.mjs";

const MAX_SECTION_CHARS = 120_000;
const READ_ONLY_TOOLS = "Read,Grep,Glob";
const DISALLOWED_TOOLS = "Edit,Write,MultiEdit,NotebookEdit,Bash";

function truncate(value, maxChars = MAX_SECTION_CHARS) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[redline truncated ${value.length - maxChars} characters]`;
}

function runGit(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    return detail ? `[git ${args.join(" ")} failed]\n${detail}` : "";
  }
  return result.stdout.trim();
}

function parseReviewTarget(parts) {
  const raw = parts.join(" ").trim();
  if (!raw || raw === "--uncommitted") {
    return { kind: "uncommitted", label: "uncommitted changes" };
  }

  if (parts[0] === "--base" && parts[1]) {
    return { kind: "base", base: parts[1], label: `changes against ${parts[1]}` };
  }

  if (parts[0] === "--commit" && parts[1]) {
    return { kind: "commit", commit: parts[1], label: `commit ${parts[1]}` };
  }

  const commitMatch = raw.match(/^commit\s+(.+)$/i);
  if (commitMatch) {
    return { kind: "commit", commit: commitMatch[1].trim(), label: `commit ${commitMatch[1].trim()}` };
  }

  const lastMatch = raw.match(/^(?:last\s+)?(\d+)\s+commits?$/i);
  if (lastMatch) {
    const base = `HEAD~${lastMatch[1]}`;
    return { kind: "base", base, label: `last ${lastMatch[1]} commits` };
  }

  const baseMatch = raw.match(/^(?:against|vs)\s+(.+)$/i);
  const base = (baseMatch ? baseMatch[1] : raw).trim();
  return { kind: "base", base, label: `changes against ${base}` };
}

function collectReviewContext(target) {
  const status = runGit(["status", "--short"]);

  if (target.kind === "commit") {
    return {
      status,
      stat: runGit(["show", "--stat", "--format=medium", target.commit]),
      diff: runGit(["show", "--format=medium", "--patch", target.commit]),
    };
  }

  if (target.kind === "base") {
    const range = `${target.base}...HEAD`;
    return {
      status,
      stat: runGit(["diff", "--stat", range]),
      diff: runGit(["diff", range, "--"]),
    };
  }

  return {
    status,
    stat: runGit(["diff", "--stat", "HEAD"]),
    diff: runGit(["diff", "HEAD", "--"]),
  };
}

function buildPrompt(mode, args) {
  if (mode === "rescue") {
    const task = args.join(" ").trim();
    const context = collectReviewContext({ kind: "uncommitted", label: "uncommitted changes" });
    return `You are Redline's Claude reviewer, called from Codex for rescue help.

Primary-agent model: Codex. Codex decides what to apply.

Rules:
- Work read-only. Do not modify files.
- Investigate with read-only tools only.
- Return findings, diagnosis, and suggested patches or commands.
- Do not silently apply fixes.

Task from Codex:
${task}

Repository: ${process.cwd()}

Git status:
${context.status || "(clean)"}

Diff stat:
${context.stat || "(no diff stat)"}

Diff context:
${truncate(context.diff || "(no diff)")}
`;
  }

  const target = parseReviewTarget(args);
  const context = collectReviewContext(target);
  const persona = mode === "adversarial"
    ? "Run an adversarial review. Challenge design decisions, hidden assumptions, failure modes, and trade-offs before ordinary polish."
    : "Run a standard code review. Prioritize correctness bugs, regressions, edge cases, and missing tests.";

  return `You are Redline's Claude reviewer, called from Codex.

Primary-agent model: Codex. Codex decides what to apply.

Rules:
- Work read-only. Do not modify files.
- Report actionable findings only.
- Include severity, file path, line number when available, issue, and recommendation.
- If there are no substantive findings, say that clearly.

Review mode:
${persona}

Target:
${target.label}

Repository:
${process.cwd()}

Git status:
${context.status || "(clean)"}

Diff stat:
${context.stat || "(no diff stat)"}

Diff:
${truncate(context.diff || "(no diff)")}
`;
}

function normalizeProvider(provider) {
  if (provider === "openrouter") return "openrouter";
  if (provider === "subscription" || provider === "claude" || provider === "anthropic") {
    return "subscription";
  }
  console.error(
    `Unknown Claude reviewer provider "${provider}". Expected subscription or openrouter.`,
  );
  process.exit(2);
}

function buildClaudeInvocation(config) {
  const provider = normalizeProvider(config.provider);
  const env = { ...process.env };
  const args = [
    "--print",
    "--input-format",
    "text",
    "--output-format",
    "text",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--tools",
    READ_ONLY_TOOLS,
    "--disallowedTools",
    DISALLOWED_TOOLS,
    "--add-dir",
    process.cwd(),
    "--model",
    config.model,
  ];

  if (provider === "openrouter") {
    if (!config.openrouterApiKey) {
      console.error(
        "Error: Claude OpenRouter API key not found. Run $redline-setup or set OPENROUTER_API_KEY.",
      );
      process.exit(3);
    }
    args.unshift("--bare");
    env.OPENROUTER_API_KEY = config.openrouterApiKey;
    env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
    env.ANTHROPIC_AUTH_TOKEN = config.openrouterApiKey;
    env.ANTHROPIC_API_KEY = "";
  }

  return { args, env };
}

function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (!["review", "adversarial", "rescue"].includes(mode)) {
    console.error("Usage: claude.mjs <review|adversarial|rescue> [target-or-task]");
    process.exit(2);
  }
  if (mode === "rescue" && rest.length === 0) {
    console.error("claude.mjs rescue: missing task argument");
    process.exit(2);
  }

  const prompt = buildPrompt(mode, rest);
  const { args, env } = buildClaudeInvocation(resolveClaudeReviewerConfig());
  const claudeBin = process.env.REDLINE_CLAUDE_BIN || "claude";
  const child = spawn(claudeBin, args, { env, stdio: ["pipe", "inherit", "inherit"] });

  child.on("error", (err) => {
    console.error(`Failed to spawn claude: ${err.message}`);
    process.exit(127);
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });

  child.stdin.end(prompt);
}

main();
