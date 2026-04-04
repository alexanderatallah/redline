---
description: Run an adversarial code review — challenge design decisions, probe assumptions, test failure modes
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

When the review completes, act as a devil's advocate:
- **Challenge design decisions** — why was this approach chosen? What alternatives were considered?
- **Probe hidden assumptions** — what is the code silently relying on?
- **Identify failure modes** — race conditions, resource exhaustion, stale state, rollback risk
- **Question trade-offs** — what was sacrificed for this design? Is that acceptable?

Don't just report bugs — question whether the approach is right. Present findings with severity and actionable recommendations.

$ARGUMENTS
