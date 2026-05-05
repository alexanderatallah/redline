---
name: redline-rescue
description: Ask Claude Code for read-only investigation help when Codex is stuck, looping, or needs another model to diagnose a problem.
---

# Redline Rescue

Use this when you need Claude to reason with you, not to edit files.

Resolve the Redline plugin root first. It is the directory two levels above this `SKILL.md`; in this repo checkout it is `plugins/redline`. Then run:

```bash
node "<plugin-root>/scripts/claude.mjs" rescue "<task>"
```

The task should include what you are trying to do, what failed, and what kind of help you need. Claude is invoked read-only and should return diagnosis, findings, or suggested patches. Codex decides what to apply.
