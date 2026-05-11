---
name: adversarial
description: Ask Claude Code to run a read-only adversarial review that challenges design choices, hidden assumptions, failure modes, and trade-offs in Codex changes.
---

# Redline Adversarial

Use this when the change needs design pressure, not just bug finding.

Resolve the Redline plugin root first. It is the directory two levels above this `SKILL.md`; in this repo checkout it is `plugins/redline`. Then run:

```bash
node "<plugin-root>/scripts/claude.mjs" adversarial <target>
```

Target handling matches `$redline:review`:

- No target: reviews uncommitted changes.
- `last N commits` or `N commits`: reviews cumulative changes since `HEAD~N`.
- `commit <sha>`: reviews one commit.
- `against main`, `vs main`, or a branch name: reviews changes against that base.
- Raw flags `--uncommitted`, `--base <branch>`, and `--commit <sha>` are accepted.

Ask Claude's output these questions before acting: is the design actually wrong, is the risk material for this project, and is the suggested fix worth the added complexity? Codex remains responsible for any edits.
