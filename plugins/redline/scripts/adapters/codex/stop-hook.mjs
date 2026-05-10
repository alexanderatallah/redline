import { execFileSync } from "node:child_process";

export function parseHookInput(input) {
  if (!input.trim()) return {};
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

export function hasUncommittedChanges() {
  try {
    const stat = execFileSync("git", ["diff", "--stat", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return stat.length > 0;
  } catch {
    return false;
  }
}

export function codexStopHookDecision(event) {
  if (event.stop_hook_active) return null;

  if (event.cwd) {
    try {
      process.chdir(event.cwd);
    } catch {
      return null;
    }
  }

  if (!hasUncommittedChanges()) return null;

  return {
    decision: "block",
    reason:
      "Uncommitted changes are present. Use $redline-check to choose $redline-review, $redline-adversarial, $redline-rescue, or skip.",
  };
}

export function readHookStdin() {
  return new Promise((resolve) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolve(input));
  });
}
