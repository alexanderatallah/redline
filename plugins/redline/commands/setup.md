---
description: Configure Redline — set provider, API key, review model, and effort level
allowed-tools: Bash
---
Run the Redline setup wizard.

## Step 1: Provider

Run `codex login status` to check if Codex is already authenticated with OpenAI.

- If authenticated: ask the user — "Use your OpenRouter account, or your OpenAI subscription?"
  - **OpenRouter** (Recommended) → set provider to `openrouter`, continue to Step 2.
  - **OpenAI subscription** → set provider to `openai`. Skip Steps 2–5 (Codex uses its default model). Save and finish.
- If not authenticated: set provider to `openrouter`, continue to Step 2.

## Step 2: OpenRouter API key

Only if provider is `openrouter`.

If no OpenRouter API key is configured (check `OPENROUTER_API_KEY` env var), run OAuth login:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/login.mjs"
```

## Step 3: Model

Only if provider is `openrouter`. Present EXACTLY these options — do not suggest other models:

1. `openai/gpt-5.4` (Recommended) — strong reasoning, good balance of speed and quality
2. `openrouter/auto` — automatically picks the best model for the task
3. Custom — paste any OpenRouter model slug (e.g. `google/gemini-3.1-pro-preview`, `openrouter/free`). Browse available models at https://openrouter.ai/models

## Step 4: Effort

Only if provider is `openrouter`. Present EXACTLY these options in this order:

1. `medium` (Recommended) — good balance of speed and thoroughness
2. `high` — most thorough, slowest
3. `low` — quick reviews with basic analysis
4. `minimal` — fastest, least thorough

## Step 5: Provider variant

Only if provider is `openrouter`. Ask which routing variant to append to the model slug. Present EXACTLY these options:

1. `:nitro` (Recommended) — fastest routing
2. `:floor` — cheapest routing
3. Standard — no suffix

The final model value stored is `<model slug><variant suffix>` (e.g. `openai/gpt-5.4:nitro`).

Save all preferences to the plugin config. These are used by /redline:review, /redline:adversarial, and /redline:rescue.
