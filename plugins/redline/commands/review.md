---
description: Run a standard code review on uncommitted changes using Codex via OpenRouter
allowed-tools: Bash
---
Run a Codex code review as a background task. Execute:

```
OPENROUTER_API_KEY="${user_config.openrouter_api_key}" codex exec review -c 'model_provider="openrouter"' -c 'model="${user_config.model}"' -c 'model_reasoning_effort="${user_config.effort}"' --uncommitted
```

When the review completes, assess the findings and inform the user of any issues found.

$ARGUMENTS
