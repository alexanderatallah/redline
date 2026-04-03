import { join } from "node:path";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { buildReviewCommand } from "./agents";

const SKILL_FILE = "redline.md";

const FRONTMATTER = `---
description: Run a code review on uncommitted changes using Codex via OpenRouter
allowed-tools: Bash
---`;

const DEFAULT_BODY = `
You may customize the review instructions below this line.
Redline will preserve your changes when updating settings.
`;

function skillPath(projectRoot: string): string {
  return join(projectRoot, ".claude", "commands", SKILL_FILE);
}

function buildFirstLine(model: string, effort: string): string {
  const cmd = buildReviewCommand(model, effort);
  return `Run \`${cmd}\` as a background task. When complete, assess the findings and inform the user of any issues.`;
}

/** Install or update the skill file, preserving user content below the first line. */
export async function installSkill(
  projectRoot: string,
  model: string,
  effort: string,
): Promise<{ created: boolean; updated: boolean }> {
  const path = skillPath(projectRoot);
  const dir = join(path, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const firstLine = buildFirstLine(model, effort);

  if (!existsSync(path)) {
    const content = `${FRONTMATTER}\n${firstLine}\n${DEFAULT_BODY}`;
    await Bun.write(path, content);
    return { created: true, updated: false };
  }

  // Update existing: preserve everything after the first content line
  const existing = await Bun.file(path).text();

  const fmEnd = existing.indexOf("---", existing.indexOf("---") + 3);
  if (fmEnd < 0) {
    const content = `${FRONTMATTER}\n${firstLine}\n${DEFAULT_BODY}`;
    await Bun.write(path, content);
    return { created: false, updated: true };
  }

  const afterFrontmatter = existing.slice(fmEnd + 3).replace(/^\n/, "");
  const firstNewline = afterFrontmatter.indexOf("\n");
  if (firstNewline < 0) {
    const content = `${FRONTMATTER}\n${firstLine}\n${DEFAULT_BODY}`;
    await Bun.write(path, content);
    return { created: false, updated: true };
  }

  const oldFirstLine = afterFrontmatter.slice(0, firstNewline).trim();
  const userContent = afterFrontmatter.slice(firstNewline + 1);

  if (oldFirstLine === firstLine.trim()) {
    return { created: false, updated: false };
  }

  const content = `${FRONTMATTER}\n${firstLine}\n${userContent}`;
  await Bun.write(path, content);
  return { created: false, updated: true };
}

/** Add .claude/commands/redline.md to .gitignore if not already present. */
export async function gitignoreSkill(projectRoot: string): Promise<void> {
  const gitignorePath = join(projectRoot, ".gitignore");
  const entry = ".claude/commands/redline.md";
  let content = "";
  try {
    content = await Bun.file(gitignorePath).text();
  } catch {
    // no .gitignore
  }
  if (!content.includes(entry)) {
    await Bun.write(gitignorePath, content + (content.endsWith("\n") ? "" : "\n") + entry + "\n");
  }
}
