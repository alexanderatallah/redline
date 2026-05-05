---
name: redline-review
description: Ask Claude Code to run a read-only standard code review of Codex changes. Defaults to uncommitted changes and supports targets like last N commits, against main, or commit SHA.
---

# Redline Review

Run Claude as a read-only reviewer and use the findings to decide what Codex should do next.

Resolve the Redline plugin root first. It is the directory two levels above this `SKILL.md`; in this repo checkout it is `plugins/redline`. Then run:

```bash
node "<plugin-root>/scripts/claude.mjs" review <target>
```

Target handling:

- No target: reviews uncommitted changes.
- `last N commits` or `N commits`: reviews cumulative changes since `HEAD~N`.
- `commit <sha>`: reviews one commit.
- `against main`, `vs main`, or a branch name: reviews changes against that base.
- Raw flags `--uncommitted`, `--base <branch>`, and `--commit <sha>` are accepted.

After Claude responds, evaluate the findings. Apply fixes yourself only when they are valid, then run the relevant verification.
