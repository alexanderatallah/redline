---
description: Run an adversarial code review — challenge design decisions, probe assumptions, test failure modes
allowed-tools: Bash
---
Run a Codex code review as a background task.

## Determine the diff flag

Parse `$ARGUMENTS` to decide what to review. If no arguments are provided, default to `--uncommitted`.

| User says | Codex flag |
|---|---|
| *(nothing)* | `--uncommitted` |
| `last N commits` or `N commits` | `--base HEAD~N` |
| `commit <sha>` | `--commit <sha>` |
| `against main` / `vs main` / any branch name | `--base <branch>` |
| `--uncommitted`, `--base ...`, `--commit ...` | Pass through as-is |

For `last N commits`, use `--base HEAD~N` so Codex reviews the cumulative diff of those N commits against their common ancestor.

## Run the review

Invoke the wrapper script with the diff flag — it reads the user's provider/model/effort/api-key from the plugin config and builds the correct `codex exec` command:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/exec.mjs" review <diff-flag>
```

When the review completes, act as a devil's advocate:
- **Challenge design decisions** — why was this approach chosen? What alternatives were considered?
- **Probe hidden assumptions** — what is the code silently relying on?
- **Identify failure modes** — race conditions, resource exhaustion, stale state, rollback risk
- **Question trade-offs** — what was sacrificed for this design? Is that acceptable?

Don't just report bugs — question whether the approach is right. Present findings with severity and actionable recommendations.

$ARGUMENTS
