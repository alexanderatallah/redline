---
description: Delegate a task to Codex as a smart friend when you need help or are stuck
allowed-tools: Bash
---
Delegate a task to Codex. Run as a background task.

If `${user_config.provider}` is `openrouter`:
```
OPENROUTER_API_KEY="${user_config.openrouter_api_key}" codex exec -c 'model_provider="openrouter"' -c 'model="${user_config.model}"' "$ARGUMENTS"
```

If `${user_config.provider}` is `openai`:
```
codex exec "$ARGUMENTS"
```

Describe what you're stuck on, what you've tried, and what you need Codex to help with. When Codex responds, present the output faithfully without filtering or second-guessing. Do not auto-apply any suggestions — ask the user which actions to take.
