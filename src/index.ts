#!/usr/bin/env bun

import { loadConfig } from "./lib/config-store";
import { login } from "./lib/auth";
import { log, bold, green, dim, cyan } from "./lib/prompts";
import { findProjectRoot, installHook, removeHook } from "./lib/hooks";
import type { Reviewer } from "./lib/agents";

const VERSION = "0.4.0";

const HELP = `
${bold("redline")} — automatic code review for AI coding agents

${bold("Usage:")}
  redline [options] [model]        Enable reviews (default reviewer: codex)
  redline off [options]            Disable reviews
  redline review [options] [model] Run a single review manually
  redline login                    Authenticate with OpenRouter

${bold("Options:")}
  --reviewer=codex     Use Codex to review Claude Code (default)
  --reviewer=claude    Use Claude Code to review Codex
  --help, -h           Show this help
  --version            Show version

${bold("Examples:")}
  redline                          # Codex reviews Claude (default)
  redline --reviewer=claude        # Claude reviews Codex
  redline openai/gpt-5.4-pro       # custom Codex model
  redline --reviewer=claude anthropic/claude-sonnet-4-6
  redline off                      # disable
`;

async function resolveApiKey(): Promise<string> {
  const envKey = process.env.OPENROUTER_API_KEY;
  if (envKey) return envKey;

  const config = await loadConfig();
  if (config.openrouter_api_key) return config.openrouter_api_key;

  log.info("No API key found. Starting OAuth login...");
  const { key } = await login();
  return key;
}

/** Extract --reviewer=X from args, return [reviewer, remaining args]. */
function parseReviewer(args: string[]): { reviewer: Reviewer; rest: string[] } {
  let reviewer: Reviewer = "codex";
  const rest: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("--reviewer=")) {
      const val = arg.split("=")[1];
      if (val === "claude" || val === "codex") {
        reviewer = val;
      } else {
        log.error(`Invalid reviewer: ${val}. Use 'codex' or 'claude'.`);
        process.exit(1);
      }
    } else {
      rest.push(arg);
    }
  }
  return { reviewer, rest };
}

async function enableReviews(reviewer: Reviewer, model?: string): Promise<void> {
  await resolveApiKey();

  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  const { installed, updated } = await installHook(root, reviewer, model);

  const defaultModel = reviewer === "claude" ? "anthropic/claude-sonnet-4-6" : "openai/gpt-5.4";
  const displayModel = model || defaultModel;
  const mainAgent = reviewer === "codex" ? "Claude Code" : "Codex";
  const reviewAgent = reviewer === "codex" ? "Codex" : "Claude Code";

  if (!installed && !updated) {
    log.info(`Redline hook already installed (${reviewAgent} → ${displayModel}).`);
  } else if (updated) {
    log.success(`Redline hook updated → ${cyan(displayModel)}`);
  } else {
    log.success(`Redline hook installed → ${cyan(displayModel)}`);
  }

  console.log();
  console.log(`  ${dim("Main agent:")}  ${mainAgent}`);
  console.log(`  ${dim("Reviewer:")}    ${reviewAgent} (${displayModel})`);
  if (reviewer === "codex") {
    console.log(`  ${dim("Hook:")}        .claude/settings.local.json (Stop)`);
  } else {
    console.log(`  ${dim("Hook:")}        ~/.codex/config.toml (session_start)`);
  }
  console.log();
  console.log(`  Run ${green(reviewer === "codex" ? "redline off" : "redline off --reviewer=claude")} to disable.`);
}

async function disableReviews(reviewer: Reviewer): Promise<void> {
  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  const removed = await removeHook(root, reviewer);
  if (removed) {
    log.success("Redline hook removed.");
  } else {
    log.info("No redline hook found.");
  }
}

async function main() {
  const rawArgs = Bun.argv.slice(2);

  if (rawArgs.length === 0) {
    await enableReviews("codex");
    return;
  }

  if (rawArgs[0] === "--help" || rawArgs[0] === "-h") {
    console.log(HELP);
    return;
  }

  if (rawArgs[0] === "--version") {
    console.log(`redline v${VERSION}`);
    return;
  }

  const { reviewer, rest } = parseReviewer(rawArgs);

  const command = rest[0];

  if (!command) {
    // Just --reviewer=X with no other args
    await enableReviews(reviewer);
    return;
  }

  switch (command) {
    case "off": {
      await disableReviews(reviewer);
      break;
    }

    case "check": {
      const { checkCommand } = await import("./commands/check");
      checkCommand(reviewer, rest[1]); // optional model
      break;
    }

    case "review": {
      const apiKey = await resolveApiKey();
      const { reviewCommand } = await import("./commands/review");
      await reviewCommand({ reviewer, model: rest[1], apiKey });
      break;
    }

    case "login": {
      const { loginCommand } = await import("./commands/login");
      await loginCommand();
      break;
    }

    default: {
      // Treat as model slug → install hook
      await enableReviews(reviewer, command);
      break;
    }
  }
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
