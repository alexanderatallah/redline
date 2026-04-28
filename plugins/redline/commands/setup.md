---
description: Configure Redline — set provider, API key, review model, and effort level
allowed-tools: Bash
---
Run the Redline setup wizard. All answers are persisted to the plugin data directory via `scripts/config.mjs`; the review/adversarial/rescue skills read from that store at runtime. **Do not** rely on `${user_config.*}` placeholders — they don't survive a setup skill.

## Step 1: Provider

Run `codex login status` to check if Codex is already authenticated with OpenAI.

- If authenticated: ask the user — "Use your OpenRouter account, or your OpenAI subscription?"
  - **OpenRouter** (Recommended) → provider is `openrouter`, continue to Step 2.
  - **OpenAI subscription** → provider is `openai`. Skip Steps 2–5 (Codex uses its default model). Jump to the Save step.
- If not authenticated: provider is `openrouter`, continue to Step 2.

## Step 2: OpenRouter API key

Only if provider is `openrouter`.

If no OpenRouter API key is configured (check `OPENROUTER_API_KEY` env var and `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" get openrouter_api_key`), run OAuth login — it writes the key to the plugin config automatically:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/login.mjs"
```

## Step 3: Model

Only if provider is `openrouter`. Present EXACTLY these options — do not suggest other models:

1. `~openai/gpt-latest` (Recommended) — strong reasoning, good balance of speed and quality
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

The final model value stored is `<model slug><variant suffix>` (e.g. `~openai/gpt-latest:nitro`).

## Save

Persist the answers in one call. Pass only the fields you collected — omit `model` and `effort` for the `openai` path:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" set \
  provider=<provider> \
  model=<final-model-slug> \
  effort=<effort>
```

These values are read by `/redline:review`, `/redline:adversarial`, and `/redline:rescue` via `scripts/exec.mjs` — no manual env setup required.
