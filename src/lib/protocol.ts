import { join } from "node:path";
import { readdirSync } from "node:fs";
import type { AgentName } from "./agents";
import { AGENTS } from "./agents";

// --- Frontmatter ---

export interface TaskMeta {
  task: string;
  agent: AgentName;
  model: string;
  timestamp: string;
  description: string;
}

export interface ReviewMeta {
  task: string;
  agent: AgentName;
  model: string;
  timestamp: string;
}

function serializeFrontmatter(data: Record<string, string>): string {
  const lines = Object.entries(data).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---`;
}

function parseFrontmatter(text: string): Record<string, string> | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(": ");
    if (idx > 0) {
      data[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
  }
  return data;
}

// --- Timestamp ---

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "");
}

function isoTimestamp(): string {
  return new Date().toISOString();
}

// --- Directory management ---

export async function ensureVigilDirs(root: string): Promise<void> {
  for (const dir of [".vigil", ".vigil/tasks", ".vigil/reviews"]) {
    Bun.spawnSync(["mkdir", "-p", join(root, dir)]);
  }
}

export async function ensureVigilIgnored(root: string): Promise<void> {
  const gitignorePath = join(root, ".gitignore");
  let content = "";
  try {
    content = await Bun.file(gitignorePath).text();
  } catch {
    // no .gitignore
  }
  if (!content.includes(".vigil/")) {
    await Bun.write(gitignorePath, content + (content.endsWith("\n") ? "" : "\n") + ".vigil/\n");
  }
}

// --- Task files ---

export async function writeTaskFile(root: string, meta: TaskMeta): Promise<string> {
  const ts = timestamp();
  const filename = `${ts}-${meta.task}.md`;
  const path = join(root, ".vigil", "tasks", filename);
  const frontmatter = serializeFrontmatter({
    task: meta.task,
    agent: meta.agent,
    model: meta.model,
    timestamp: isoTimestamp(),
    description: meta.description,
  });
  await Bun.write(path, frontmatter + "\n");
  return filename;
}

export function readTaskFile(path: string): TaskMeta | null {
  try {
    const text = Bun.spawnSync(["cat", path], { stdout: "pipe" }).stdout.toString();
    const data = parseFrontmatter(text);
    if (!data || !data.task || !data.agent) return null;
    return {
      task: data.task,
      agent: data.agent as AgentName,
      model: data.model || "",
      timestamp: data.timestamp || "",
      description: data.description || "",
    };
  } catch {
    return null;
  }
}

// --- Review files ---

export async function writeReviewFile(
  root: string,
  meta: ReviewMeta,
  body: string,
): Promise<string> {
  const ts = timestamp();
  const filename = `${ts}-review-${meta.task}.md`;
  const path = join(root, ".vigil", "reviews", filename);
  const frontmatter = serializeFrontmatter({
    task: meta.task,
    agent: meta.agent,
    model: meta.model,
    timestamp: isoTimestamp(),
  });
  await Bun.write(path, frontmatter + "\n\n" + body + "\n");
  return filename;
}

export function readReviewFile(path: string): { meta: ReviewMeta; body: string } | null {
  try {
    const text = Bun.spawnSync(["cat", path], { stdout: "pipe" }).stdout.toString();
    const data = parseFrontmatter(text);
    if (!data || !data.task) return null;
    const bodyMatch = text.match(/^---\n[\s\S]*?\n---\n\n?([\s\S]*)/);
    return {
      meta: {
        task: data.task,
        agent: data.agent as AgentName,
        model: data.model || "",
        timestamp: data.timestamp || "",
      },
      body: bodyMatch ? bodyMatch[1].trim() : "",
    };
  } catch {
    return null;
  }
}

// --- Discovery ---

export function listTaskFiles(root: string): string[] {
  try {
    const dir = join(root, ".vigil", "tasks");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

export function listReviewFiles(root: string): string[] {
  try {
    const dir = join(root, ".vigil", "reviews");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch {
    return [];
  }
}

/** Find task files that don't have a corresponding review. */
export function getUnreviewedTasks(root: string): string[] {
  const tasks = listTaskFiles(root);
  const reviews = listReviewFiles(root);
  // A review filename contains "review-<task-name>"
  // A task filename is "<timestamp>-<task-name>.md"
  // Extract task names from review filenames
  const reviewedTasks = new Set<string>();
  for (const r of reviews) {
    // Format: YYYY-MM-DDTHH-MM-SS-SSS-review-<task>.md
    const match = r.match(/review-(.+)\.md$/);
    if (match) reviewedTasks.add(match[1]);
  }
  return tasks.filter((t) => {
    // Extract task name: remove timestamp prefix and .md suffix
    // Format: YYYY-MM-DDTHH-MM-SS-SSS-<task>.md
    const match = t.match(/^\d{4}-\d{2}-\d{2}T[\d-]+-(.+)\.md$/);
    return match && !reviewedTasks.has(match[1]);
  });
}

// --- PID management ---

export async function writeWatcherPid(root: string, pid: number): Promise<void> {
  await Bun.write(join(root, ".vigil", "watcher.pid"), String(pid));
}

export function readWatcherPid(root: string): number | null {
  try {
    const text = Bun.spawnSync(["cat", join(root, ".vigil", "watcher.pid")], {
      stdout: "pipe",
    }).stdout.toString().trim();
    const pid = parseInt(text, 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

export async function cleanupWatcherPid(root: string): Promise<void> {
  try {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(join(root, ".vigil", "watcher.pid"));
  } catch {
    // ignore
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// --- AGENTS.md management (for Codex) ---

const VIGIL_MARKER_BEGIN = "<!-- vigil:begin -->";
const VIGIL_MARKER_END = "<!-- vigil:end -->";

export async function injectAgentsMd(root: string, instructions: string): Promise<string | null> {
  const agentsMdPath = join(root, "AGENTS.md");
  let originalContent: string | null = null;

  try {
    originalContent = await Bun.file(agentsMdPath).text();
    // Strip any existing vigil block first
    originalContent = stripVigilBlock(originalContent);
  } catch {
    // File doesn't exist
  }

  const vigilBlock = `\n${VIGIL_MARKER_BEGIN}\n${instructions}\n${VIGIL_MARKER_END}\n`;
  const newContent = (originalContent || "") + vigilBlock;
  await Bun.write(agentsMdPath, newContent);
  return originalContent;
}

export async function restoreAgentsMd(root: string, originalContent: string | null): Promise<void> {
  const agentsMdPath = join(root, "AGENTS.md");
  if (originalContent === null) {
    // We created it, so delete it
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(agentsMdPath);
    } catch {
      // ignore
    }
  } else {
    await Bun.write(agentsMdPath, originalContent);
  }
}

/** Strip existing vigil block from AGENTS.md content. */
function stripVigilBlock(content: string): string {
  const beginIdx = content.indexOf(VIGIL_MARKER_BEGIN);
  const endIdx = content.indexOf(VIGIL_MARKER_END);
  if (beginIdx >= 0 && endIdx >= 0) {
    const before = content.slice(0, beginIdx);
    const after = content.slice(endIdx + VIGIL_MARKER_END.length);
    return (before + after).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  }
  return content;
}

// --- Protocol instructions ---

export function generateProtocolInstructions(agentName: AgentName, model: string): string {
  return `## Vigil Review Protocol

You are running under vigil, a background cross-review system. A second AI agent is watching your work and will provide code reviews.

After completing each significant task or subtask, follow this protocol:

1. Create a task file at .vigil/tasks/<timestamp>-<task-name>.md where:
   - <timestamp> is formatted as YYYY-MM-DDTHH-MM-SS (use current time)
   - <task-name> is a short kebab-case identifier for the task

   The file must contain YAML frontmatter followed by nothing else:
   \`\`\`
   ---
   task: <task-name>
   agent: ${agentName}
   model: ${model}
   timestamp: <ISO-8601 timestamp>
   description: <one-line summary of what you did>
   ---
   \`\`\`

2. After writing the task file, check .vigil/reviews/ for a review file whose filename contains your task name. Poll every 10 seconds for up to 3 minutes. Tell the user you are waiting for a review and that they can ask you to skip.

3. If a review file appears, read it carefully. It contains feedback from a second AI agent that reviewed your changes. Assess whether the feedback is valid and actionable. Present any issues found to the user and ask whether to address them.

4. If the user asks you to skip waiting or move on, stop polling immediately and continue with the next task.

5. Do NOT create reviews yourself — only read reviews written by the other agent.`;
}
