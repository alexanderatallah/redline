---
name: redline-check
description: Use when the Redline Codex Stop hook reports uncommitted changes and asks Codex to decide whether to request Claude review, adversarial review, rescue help, or skip.
---

# Redline Check

Use this after the Redline Stop hook nudges you. The primary-agent model is Codex: choose whether Claude review is useful, then apply or ignore Claude's findings yourself.

Default to `$redline-review`. Choose another action only when the signal is clear:

- `$redline-review` - standard review for concrete code changes.
- `$redline-adversarial` - design pressure-test for architecture, abstractions, contracts, non-obvious trade-offs, or changes whose correctness depends on the design being right.
- `$redline-rescue` - ask Claude for investigation help when you are stuck, repeatedly failing, or need another model to reason through the problem.

Skip Redline if the changes are trivial, docs-only, comments-only, formatting-only, or if a Redline review already ran for this work.

If you run a Redline skill, treat Claude's output as advice. You decide whether to edit files, run tests, or report no action needed.
