#!/usr/bin/env bun

import { loadConfig } from "./lib/config-store";
import { login } from "./lib/auth";
import { log, bold, green, dim, cyan, ask, choose } from "./lib/prompts";
import { findProjectRoot, installHook, removeHook, type HookScope } from "./lib/hooks";
import { installSkill, gitignoreSkill } from "./lib/skill";
import {
  DEFAULT_MODEL, DEFAULT_EFFORT, EFFORT_OPTIONS, VARIANT_OPTIONS,
  DEFAULT_VARIANT_IDX, applyVariant,
  type Effort, type Variant,
} from "./lib/agents";

const VERSION = "0.4.0";

const HELP = `
${bold("redline")} — automatic code review for Claude Code via Codex

${bold("Usage:")}
  redline [model]             Enable Codex reviews (interactive setup)
  redline off                 Disable reviews (remove hook)
  redline review [model]      Run a single review manually
  redline login               Authenticate with OpenRouter

${bold("Options:")}
  --effort=<level>   Reasoning effort (minimal, low, medium, high)
  --help, -h         Show this help
  --version          Show version

${bold("Examples:")}
  redline                     # interactive setup
  redline openai/gpt-5.4-pro  # skip model prompt, still prompts for effort/variant
  redline off                 # disable
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

function parseFlags(args: string[]): { effort?: string; rest: string[] } {
  let effort: string | undefined;
  const rest: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("--effort=")) {
      effort = arg.split("=")[1];
    } else {
      rest.push(arg);
    }
  }
  return { effort, rest };
}

async function enableReviews(modelArg?: string, effortArg?: string): Promise<void> {
  await resolveApiKey();

  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  console.log();

  const model = modelArg || await ask("  Model", DEFAULT_MODEL);

  let effort: string;
  if (effortArg && EFFORT_OPTIONS.includes(effortArg as Effort)) {
    effort = effortArg;
  } else {
    const effortIdx = await choose(
      "  Reasoning effort",
      [...EFFORT_OPTIONS],
      EFFORT_OPTIONS.indexOf(DEFAULT_EFFORT),
    );
    effort = EFFORT_OPTIONS[effortIdx];
  }

  const variantIdx = await choose(
    "  Provider",
    [...VARIANT_OPTIONS],
    DEFAULT_VARIANT_IDX,
  );
  const variant = VARIANT_OPTIONS[variantIdx] as Variant;

  // Prompt for hook scope
  const scopeIdx = await choose(
    "  Hook scope",
    ["just me (local, not committed)", "whole team (committed to repo)"],
    0,
  );
  const scope: HookScope = scopeIdx === 0 ? "local" : "shared";

  const finalModel = applyVariant(model, variant);

  console.log();

  const skillResult = await installSkill(root, finalModel, effort);
  const hookResult = await installHook(root, scope);

  // Gitignore both skill and hook settings if local (not shared)
  if (scope === "local") {
    await gitignoreSkill(root);
  }

  const display = `${cyan(finalModel)} ${dim(`(${effort} effort)`)}`;
  if (!skillResult.created && !skillResult.updated && !hookResult.installed && !hookResult.updated) {
    log.info(`Redline already installed → ${display}`);
  } else {
    log.success(`Redline ${skillResult.updated || hookResult.updated ? "updated" : "installed"} → ${display}`);
  }

  const settingsFile = scope === "shared" ? ".claude/settings.json" : ".claude/settings.local.json";

  console.log();
  console.log(`  ${dim("Skill:")}  .claude/commands/redline.md`);
  console.log(`  ${dim("Hook:")}   ${settingsFile}`);
  console.log(`  ${dim("Invoke:")} /redline`);
  console.log();
  console.log(`  Run ${green("redline off")} to disable.`);
}

async function disableReviews(): Promise<void> {
  const root = findProjectRoot();
  if (!root) {
    log.error("Not inside a git repository.");
    process.exit(1);
  }

  const removed = await removeHook(root);
  if (removed) {
    log.success("Redline hook removed.");
    log.info("Skill file preserved at .claude/commands/redline.md (invoke manually with /redline).");
  } else {
    log.info("No redline hook found.");
  }
}

async function main() {
  const rawArgs = Bun.argv.slice(2);
  const { effort, rest } = parseFlags(rawArgs);

  if (rest.length === 0) {
    await enableReviews(undefined, effort);
    return;
  }

  if (rest[0] === "--help" || rest[0] === "-h") {
    console.log(HELP);
    return;
  }

  if (rest[0] === "--version") {
    console.log(`redline v${VERSION}`);
    return;
  }

  switch (rest[0]) {
    case "off": {
      await disableReviews();
      break;
    }

    case "check": {
      // Called by the Stop hook — reads event JSON from stdin
      const { checkCommand } = await import("./commands/check");
      await checkCommand();
      break;
    }

    case "review": {
      const apiKey = await resolveApiKey();
      const reviewArgs = rest.slice(1);
      const { effort: reviewEffort, rest: reviewRest } = parseFlags(reviewArgs);
      const { reviewCommand } = await import("./commands/review");
      await reviewCommand({
        model: reviewRest[0],
        effort: reviewEffort || effort,
        apiKey,
      });
      break;
    }

    case "login": {
      const { loginCommand } = await import("./commands/login");
      await loginCommand();
      break;
    }

    default: {
      await enableReviews(rest[0], effort);
      break;
    }
  }
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
