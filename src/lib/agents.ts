import { claudeEnv, codexEnv } from "./env";

export type Reviewer = "codex" | "claude";

// --- Codex as reviewer ---

const CODEX_DEFAULT_MODEL = "openai/gpt-5.4";

export function isCodexInstalled(): boolean {
  return Bun.spawnSync(["which", "codex"]).exitCode === 0;
}

export function getCodexDefaultModel(): string {
  return CODEX_DEFAULT_MODEL;
}

export function getCodexEnv(apiKey: string): Record<string, string> {
  return codexEnv(apiKey);
}

export function buildCodexReviewArgs(outputFile: string, model?: string): string[] {
  const args = [
    "codex", "exec", "review",
    "-c", 'model_provider="openrouter"',
    "--uncommitted",
    "-o", outputFile,
  ];
  if (model) {
    args.push("-c", `model="${model}"`);
  }
  return args;
}

/** Build the raw codex command string (for check.ts to show in hook output). */
export function buildCodexReviewCommand(model?: string): string {
  const args = [
    "codex", "exec", "review",
    "-c", "'model_provider=\"openrouter\"'",
    "--uncommitted",
  ];
  if (model) {
    args.push("-c", `'model="${model}"'`);
  }
  return args.join(" ");
}

// --- Claude as reviewer ---

const CLAUDE_DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";

const REVIEW_PROMPT = `Review the uncommitted changes in this repo. Run these commands to see all changes:

git diff HEAD
git ls-files --others --exclude-standard

Identify bugs, security issues, and suggest improvements. Be concise.`;

export function isClaudeInstalled(): boolean {
  return Bun.spawnSync(["which", "claude"]).exitCode === 0;
}

export function getClaudeDefaultModel(): string {
  return CLAUDE_DEFAULT_MODEL;
}

export function getClaudeEnv(apiKey: string): Record<string, string> {
  return claudeEnv(apiKey);
}

export function buildClaudeReviewArgs(model?: string): string[] {
  const args = ["claude", "-p"];
  if (model) {
    args.push("--model", model);
  }
  args.push(REVIEW_PROMPT);
  return args;
}

/** Build the raw claude command string (for check.ts to show in hook output). */
export function buildClaudeReviewCommand(model?: string): string {
  const parts = ["claude", "-p"];
  if (model) {
    parts.push("--model", model);
  }
  parts.push(`'${REVIEW_PROMPT.replace(/'/g, "'\\''")}'`);
  return parts.join(" ");
}
