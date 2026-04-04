---
description: Configure Redline — set OpenRouter API key, review model, and effort level
allowed-tools: Bash
---
Run the Redline setup wizard.

## Step 1: OpenRouter API key

If no OpenRouter API key is configured (check OPENROUTER_API_KEY env var or plugin config), run OAuth login:
```
node "${CLAUDE_PLUGIN_ROOT}/scripts/login.mjs"
```

## Step 2: Model

Ask which model to use. Present EXACTLY these options — do not suggest other models:

1. `openai/gpt-5.4` (Recommended) — strong reasoning, good balance of speed and quality
2. `openrouter/auto` — automatically picks the best model for the task
3. Custom — paste any OpenRouter model slug (e.g. `google/gemini-3.1-pro-preview`, `openrouter/free`). Browse available models at https://openrouter.ai/models

## Step 3: Effort

Ask for reasoning effort level: minimal, low, medium, or high (default: medium).

## Step 4: Provider variant

Ask which routing variant to append to the model slug. Present EXACTLY these options:

1. `:nitro` (Recommended) — fastest routing
2. `:floor` — cheapest routing
3. Standard — no suffix

The final model value stored is `<model slug><variant suffix>` (e.g. `openai/gpt-5.4:nitro`).

Save preferences to the plugin config. These are used by /redline:review, /redline:adversarial, and /redline:rescue.
