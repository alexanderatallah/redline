#!/usr/bin/env bun

import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/config-store";
import { login } from "./lib/auth";
import { ensureCodexConfig } from "./lib/env";
import { AGENTS, isAgentName, isAgentInstalled, type AgentName } from "./lib/agents";
import {
  ensureVigilDirs,
  ensureVigilIgnored,
  readWatcherPid,
  cleanupWatcherPid,
  isProcessAlive,
  generateProtocolInstructions,
  injectAgentsMd,
  restoreAgentsMd,
} from "./lib/protocol";
import { log, bold } from "./lib/prompts";

const VERSION = "0.2.0";
const __dirname = dirname(fileURLToPath(import.meta.url));

const HELP = `
${bold("vigil")} — background cross-review for AI coding agents

${bold("Usage:")}
  vigil claude [args...]    Run Claude Code with background Codex review
  vigil codex [args...]     Run Codex CLI with background Claude review
  vigil login               Authenticate with OpenRouter via OAuth
  vigil config [args...]    Show/set configuration

${bold("Options:")}
  --help, -h     Show this help
  --version      Show version

${bold("Examples:")}
  vigil claude --dangerously-skip-permissions
  vigil claude -p "one-shot task"
  vigil codex --full-auto
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

// --- Cleanup state ---
let watcherProc: ReturnType<typeof Bun.spawn> | null = null;
let agentsMdOriginal: string | null | undefined = undefined; // undefined = not touched
let repoRoot: string = process.cwd();

async function cleanup() {
  if (watcherProc) {
    try {
      watcherProc.kill("SIGTERM");
    } catch {
      // already dead
    }
    watcherProc = null;
  }
  await cleanupWatcherPid(repoRoot);

  if (agentsMdOriginal !== undefined) {
    await restoreAgentsMd(repoRoot, agentsMdOriginal);
    agentsMdOriginal = undefined;
  }
}

async function runAgent(agentName: AgentName, userArgs: string[]): Promise<never> {
  repoRoot = process.cwd();
  const agent = AGENTS[agentName];
  const opposite = AGENTS[agent.opposite];

  // Resolve API key
  const apiKey = await resolveApiKey();

  // Check main agent is installed
  if (!isAgentInstalled(agentName)) {
    log.error(`'${agentName}' is not installed or not on PATH.`);
    process.exit(1);
  }

  // Check opposite agent
  const hasOpposite = isAgentInstalled(agent.opposite);
  if (!hasOpposite) {
    log.warn(
      `'${agent.opposite}' not found — running without background reviews.`,
    );
  }

  // Ensure codex config if codex is involved (as main or reviewer)
  if (agentName === "codex" || agent.opposite === "codex") {
    await ensureCodexConfig();
  }

  // Set up .vigil/ directories
  await ensureVigilDirs(repoRoot);
  await ensureVigilIgnored(repoRoot);

  // Spawn background watcher (if opposite agent available)
  if (hasOpposite) {
    // Check if a watcher is already running
    const existingPid = readWatcherPid(repoRoot);
    if (existingPid && isProcessAlive(existingPid)) {
      log.info("Vigil watcher already running.");
    } else {
      const watcherPath = resolve(__dirname, "watcher.ts");
      watcherProc = Bun.spawn(
        [
          "bun",
          watcherPath,
          "--review-agent", agent.opposite,
          "--api-key", apiKey,
          "--vigil-dir", resolve(repoRoot, ".vigil"),
          "--repo-root", repoRoot,
        ],
        {
          stdout: "ignore",
          stderr: "ignore",
        },
      );
      log.info(
        `Background reviewer started (${opposite.displayName}, PID ${watcherProc.pid})`,
      );
    }
  }

  // Inject protocol instructions
  const instructions = generateProtocolInstructions(agentName, agent.defaultModel);
  let agentArgs: string[];

  if (agentName === "claude") {
    // Prepend --append-system-prompt to user's args
    agentArgs = ["claude", "--append-system-prompt", instructions, ...userArgs];
  } else {
    // Write AGENTS.md with vigil instructions for Codex
    agentsMdOriginal = await injectAgentsMd(repoRoot, instructions);
    agentArgs = ["codex", ...userArgs];
  }

  // Build environment
  const env = { ...process.env, ...agent.getEnv(apiKey) };

  // Register cleanup handlers
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(143);
  });

  // Spawn main agent with inherited stdio (user interacts directly)
  log.info(`Starting ${agent.displayName}...`);
  const agentProc = Bun.spawn(agentArgs, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env,
  });

  const exitCode = await agentProc.exited;

  // Cleanup
  await cleanup();
  process.exit(exitCode);
}

async function main() {
  const args = Bun.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(HELP);
    process.exit(0);
  }

  if (args[0] === "--version") {
    console.log(`vigil v${VERSION}`);
    process.exit(0);
  }

  const command = args[0];

  if (isAgentName(command)) {
    await runAgent(command, args.slice(1));
    return; // unreachable — runAgent calls process.exit
  }

  switch (command) {
    case "login": {
      const { loginCommand } = await import("./commands/login");
      await loginCommand();
      break;
    }

    case "config": {
      const { configCommand } = await import("./commands/config");
      await configCommand(args.slice(1));
      break;
    }

    default:
      log.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  log.error((err as Error).message);
  process.exit(1);
});
