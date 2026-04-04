---
description: Delegate a task to Codex as a smart friend when you need help or are stuck
allowed-tools: Bash
---
Delegate a task to Codex. Run as a background task:

```
OPENROUTER_API_KEY="${user_config.openrouter_api_key}" codex exec -c 'model_provider="openrouter"' -c 'model="${user_config.model}"' "$ARGUMENTS"
```

Describe what you're stuck on, what you've tried, and what you need Codex to help with. When Codex responds, present the output faithfully without filtering or second-guessing. Do not auto-apply any suggestions — ask the user which actions to take.
