---
description: Run a standard code review on uncommitted changes using Codex
allowed-tools: Bash
---
Run a Codex code review as a background task.

If `${user_config.provider}` is `openrouter`:
```
OPENROUTER_API_KEY="${user_config.openrouter_api_key}" codex exec review -c 'model_provider="openrouter"' -c 'model="${user_config.model}"' -c 'model_reasoning_effort="${user_config.effort}"' --uncommitted
```

If `${user_config.provider}` is `openai`:
```
codex exec review --uncommitted
```

When the review completes, assess the findings and inform the user of any issues found.

$ARGUMENTS
