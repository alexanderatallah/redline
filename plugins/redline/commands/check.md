---
description: Decide whether to run a background redline review after each response
user-invocable: false
---

When the Stop hook prompts you to consider a review, pick one of these skills and invoke it via the **Skill tool**. Each skill shells out to `codex exec` as a background Bash task, so your main session stays responsive — do **not** wrap it in an Agent dispatch.

Default to `redline:review`. Only deviate when one of the specific signals below is clearly present:

- **`redline:review`** — standard code review. Use this whenever you shipped a concrete code change and none of the signals below apply.
- **`redline:adversarial`** — use when you were deliberating architecture, design, or a non-obvious trade-off this turn and want the design pressure-tested. Signals: you chose between multiple approaches, picked a new abstraction, introduced a contract/interface, or made a change whose *correctness hinges on the design being right* rather than on the code being clean.
- **`redline:rescue`** — use when you were going in circles, repeatedly failing at the same task, or stuck on something you couldn't solve yourself and need third-party advice. Signals: repeated failed attempts, the user had to redirect you, you explicitly asked the user for help, or you hit a problem whose root cause you couldn't pin down. Pass the stuck task as `args`.

**Skip the review entirely** if any of these are true:
- Changes are trivial (typos, formatting, comments-only, docs-only)
- A redline command was already run this session
- A redline background task is already running
