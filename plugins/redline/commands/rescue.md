---
description: Delegate a task to Codex as a smart friend when you need help or are stuck
allowed-tools: Bash
---
Delegate a task to Codex. Run as a background task.

Invoke the wrapper script with the task as a single quoted argument — it reads the user's provider/model/api-key from the plugin config and builds the correct `codex exec` command:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/exec.mjs" rescue "$ARGUMENTS"
```

Describe what you're stuck on, what you've tried, and what you need Codex to help with. When Codex responds, present the output faithfully without filtering or second-guessing. Do not auto-apply any suggestions — ask the user which actions to take.
