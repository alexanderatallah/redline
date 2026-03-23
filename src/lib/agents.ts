import { claudeEnv, codexEnv } from "./env";

export type AgentName = "claude" | "codex";

export interface AgentDef {
  name: AgentName;
  displayName: string;
  defaultModel: string;
  opposite: AgentName;
  getEnv(apiKey: string): Record<string, string>;
  /** Build the argv for running a review in non-interactive mode. */
  buildReviewArgs(outputFile: string): string[];
}

export const AGENTS: Record<AgentName, AgentDef> = {
  claude: {
    name: "claude",
    displayName: "Claude Code",
    defaultModel: "anthropic/claude-opus-4.6",
    opposite: "codex",
    getEnv(apiKey: string) {
      return claudeEnv(apiKey);
    },
    buildReviewArgs(_outputFile: string) {
      // claude -p prints to stdout (captured by watcher)
      return [
        "claude",
        "-p",
        "--dangerously-skip-permissions",
      ];
    },
  },
  codex: {
    name: "codex",
    displayName: "Codex CLI",
    defaultModel: "openai/gpt-5.4",
    opposite: "claude",
    getEnv(apiKey: string) {
      return codexEnv(apiKey);
    },
    buildReviewArgs(outputFile: string) {
      return [
        "codex",
        "exec",
        "review",
        "-c", 'model_provider="openrouter"',
        "--uncommitted",
        "-o", outputFile,
      ];
    },
  },
};

export function isAgentName(s: string): s is AgentName {
  return s === "claude" || s === "codex";
}

export function isAgentInstalled(name: AgentName): boolean {
  return Bun.spawnSync(["which", name]).exitCode === 0;
}
