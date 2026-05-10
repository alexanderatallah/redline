import { spawn } from "node:child_process";
import { resolveApiKey, resolveCodexReviewerConfig } from "../../core/config.mjs";
import { ensureCodexConfig } from "./config.mjs";

export function buildCodexInvocation(mode, rest, config = resolveCodexReviewerConfig()) {
  const args = mode === "review" ? ["exec", "review"] : ["exec"];
  const env = { ...process.env };

  if (config.provider === "openrouter") {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      return {
        error:
          "Error: OpenRouter API key not found. Run /redline:setup or set OPENROUTER_API_KEY.",
      };
    }
    env.OPENROUTER_API_KEY = apiKey;
    ensureCodexConfig();
    args.push("-c", 'model_provider="openrouter"');
    args.push("-c", `model="${config.model}"`);
    args.push("-c", `model_reasoning_effort="${config.effort}"`);
  }

  args.push(...rest);
  return { args, env };
}

export function runCodexExec(mode, rest) {
  if (mode !== "review" && mode !== "rescue") {
    console.error("Usage: exec.mjs <review|rescue> [args...]");
    process.exit(2);
  }
  if (mode === "rescue" && rest.length === 0) {
    console.error("exec.mjs rescue: missing task argument");
    process.exit(2);
  }

  const invocation = buildCodexInvocation(mode, rest);
  if (invocation.error) {
    console.error(invocation.error);
    process.exit(3);
  }

  const child = spawn("codex", invocation.args, { env: invocation.env, stdio: "inherit" });
  child.on("error", (err) => {
    console.error(`Failed to spawn codex: ${err.message}`);
    process.exit(127);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}
