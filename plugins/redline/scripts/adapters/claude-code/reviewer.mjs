import { spawn } from "node:child_process";
import { resolveClaudeReviewerConfig } from "../../core/config.mjs";
import { buildReviewerPrompt } from "../../core/review.mjs";

const READ_ONLY_TOOLS = "Read,Grep,Glob";
const DISALLOWED_TOOLS = "Edit,Write,MultiEdit,NotebookEdit,Bash";

export function extractClaudeStreamText(line) {
  const trimmed = line.trim();
  if (!trimmed) return "";

  let event;
  try {
    event = JSON.parse(trimmed);
  } catch {
    return `${line}\n`;
  }

  if (event.type === "assistant" && Array.isArray(event.message?.content)) {
    return event.message.content
      .filter((block) => block?.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
  }

  if (event.type === "result" && typeof event.result === "string") {
    return event.result;
  }

  return "";
}

function createClaudeStreamForwarder(output) {
  let buffer = "";
  let wroteText = false;
  let wroteAssistantText = false;
  let lastChar = "";

  function writeText(text, { assistantText = false } = {}) {
    if (!text) return;
    if (!assistantText && wroteAssistantText) return;
    output.write(text);
    wroteText = true;
    wroteAssistantText = wroteAssistantText || assistantText;
    lastChar = text.at(-1) || lastChar;
  }

  function handleLine(line) {
    const text = extractClaudeStreamText(line);
    if (!text) return;
    let assistantText = false;
    try {
      assistantText = JSON.parse(line.trim()).type === "assistant";
    } catch {
      // Non-JSON output is fallback text and should be forwarded.
    }
    writeText(text, { assistantText });
  }

  return {
    write(chunk) {
      buffer += chunk;
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        handleLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    },
    end() {
      if (buffer) handleLine(buffer);
      if (wroteText && lastChar !== "\n") output.write("\n");
    },
  };
}

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
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--setting-sources",
    "local",
    "--disable-slash-commands",
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
          "Error: Claude OpenRouter API key not found. Run $redline:setup or set OPENROUTER_API_KEY.",
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

  let prompt;
  try {
    prompt = buildReviewerPrompt(mode, rest);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }
  const claudeBin = process.env.REDLINE_CLAUDE_BIN || "claude";
  const child = spawn(claudeBin, invocation.args, {
    env: invocation.env,
    stdio: ["pipe", "pipe", "inherit"],
  });
  const forwarder = createClaudeStreamForwarder(process.stdout);

  child.on("error", (err) => {
    console.error(`Failed to spawn claude: ${err.message}`);
    process.exit(127);
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    forwarder.write(chunk);
  });

  child.stdout.on("end", () => {
    forwarder.end();
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });

  child.stdin.end(prompt);
}
