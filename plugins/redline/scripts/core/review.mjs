import { spawnSync } from "node:child_process";

const MAX_SECTION_CHARS = 120_000;

export function truncateSection(value, maxChars = MAX_SECTION_CHARS) {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n\n[redline truncated ${value.length - maxChars} characters]`;
}

export function parseReviewTarget(parts) {
  const raw = parts.join(" ").trim();
  if (!raw || raw === "--uncommitted") {
    return { kind: "uncommitted", label: "uncommitted changes" };
  }

  if (parts[0] === "--base") {
    if (!parts[1]) throw new Error("review target --base requires a branch or ref");
    return { kind: "base", base: parts[1], label: `changes against ${parts[1]}` };
  }

  if (parts[0] === "--commit") {
    if (!parts[1]) throw new Error("review target --commit requires a commit SHA");
    return { kind: "commit", commit: parts[1], label: `commit ${parts[1]}` };
  }

  const commitMatch = raw.match(/^commit\s+(.+)$/i);
  if (commitMatch) {
    const commit = commitMatch[1].trim();
    return { kind: "commit", commit, label: `commit ${commit}` };
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

export function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    cwd: options.cwd,
    encoding: "utf8",
    maxBuffer: 12 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    return detail ? `[git ${args.join(" ")} failed]\n${detail}` : "";
  }
  return result.stdout.trim();
}

export function collectReviewContext(target, options = {}) {
  const cwd = options.cwd || process.cwd();
  const status = runGit(["status", "--short"], { cwd });

  if (target.kind === "commit") {
    return {
      status,
      stat: runGit(["show", "--stat", "--format=medium", target.commit], { cwd }),
      diff: runGit(["show", "--format=medium", "--patch", target.commit], { cwd }),
    };
  }

  if (target.kind === "base") {
    const range = `${target.base}...HEAD`;
    return {
      status,
      stat: runGit(["diff", "--stat", range], { cwd }),
      diff: runGit(["diff", range, "--"], { cwd }),
    };
  }

  return {
    status,
    stat: runGit(["diff", "--stat", "HEAD"], { cwd }),
    diff: runGit(["diff", "HEAD", "--"], { cwd }),
  };
}

export function buildReviewerPrompt(mode, args, options = {}) {
  const cwd = options.cwd || process.cwd();
  if (mode === "rescue") {
    const task = args.join(" ").trim();
    const context = collectReviewContext(
      { kind: "uncommitted", label: "uncommitted changes" },
      { cwd },
    );
    return `You are Redline's Claude reviewer, called from Codex for rescue help.

Primary-agent model: Codex. Codex decides what to apply.

Rules:
- Work read-only. Do not modify files.
- Investigate with read-only tools only.
- Return findings, diagnosis, and suggested patches or commands.
- Do not silently apply fixes.

Task from Codex:
${task}

Repository: ${cwd}

Git status:
${context.status || "(clean)"}

Diff stat:
${context.stat || "(no diff stat)"}

Diff context:
${truncateSection(context.diff || "(no diff)")}
`;
  }

  const target = parseReviewTarget(args);
  const context = collectReviewContext(target, { cwd });
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
${cwd}

Git status:
${context.status || "(clean)"}

Diff stat:
${context.stat || "(no diff stat)"}

Diff:
${truncateSection(context.diff || "(no diff)")}
`;
}
