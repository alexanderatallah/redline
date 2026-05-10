import { spawn } from "node:child_process";
import { resolveClaudeReviewerConfig } from "../../core/config.mjs";
import { buildReviewerPrompt } from "../../core/review.mjs";

const READ_ONLY_TOOLS = "Read,Grep,Glob";
const DISALLOWED_TOOLS = "Edit,Write,MultiEdit,NotebookEdit,Bash";

export function normalizeProvider(provider) {
  if (provider === "openrouter") return "openrouter";
  if (provider === "subscription" || provider === "claude" || provider === "anthropic") {
    return "subscription";
  }
  return null;
}

export function buildClaudeInvocation(config) {
  const provider = normalizeProvider(config.provider);
  if (!provider) {
    return {
      error: `Unknown Claude reviewer provider "${config.provider}". Expected subscription or openrouter.`,
    };
  }

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
      return {
        error:
          "Error: Claude OpenRouter API key not found. Run $redline-setup or set OPENROUTER_API_KEY.",
        exitCode: 3,
      };
    }
    args.unshift("--bare");
    env.OPENROUTER_API_KEY = config.openrouterApiKey;
    env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
    env.ANTHROPIC_AUTH_TOKEN = config.openrouterApiKey;
    env.ANTHROPIC_API_KEY = "";
  }

  return { args, env };
}

export function runClaudeReview(mode, rest) {
  if (!["review", "adversarial", "rescue"].includes(mode)) {
    console.error("Usage: claude.mjs <review|adversarial|rescue> [target-or-task]");
    process.exit(2);
  }
  if (mode === "rescue" && rest.length === 0) {
    console.error("claude.mjs rescue: missing task argument");
    process.exit(2);
  }

  const invocation = buildClaudeInvocation(resolveClaudeReviewerConfig());
  if (invocation.error) {
    console.error(invocation.error);
    process.exit(invocation.exitCode ?? 2);
  }

  const prompt = buildReviewerPrompt(mode, rest);
  const claudeBin = process.env.REDLINE_CLAUDE_BIN || "claude";
  const child = spawn(claudeBin, invocation.args, {
    env: invocation.env,
    stdio: ["pipe", "inherit", "inherit"],
  });

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
