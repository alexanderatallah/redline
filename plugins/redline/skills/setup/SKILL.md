---
name: redline-setup
description: Configure Redline for Codex users by choosing how Claude Code reviews should run: Claude subscription or OpenRouter with an Opus model.
---

# Redline Setup

Configure the Claude reviewer used by `$redline-review`, `$redline-adversarial`, and `$redline-rescue`.

Resolve the Redline plugin root first. It is the directory two levels above this `SKILL.md`; in this repo checkout it is `plugins/redline`.

## Provider

Run:

```bash
claude auth status
```

If Claude Code is authenticated, ask whether to use:

- Claude subscription (recommended): `claude_provider=subscription`
- OpenRouter: `claude_provider=openrouter`

If Claude Code is not authenticated, use OpenRouter unless the user wants to run `claude auth login` first.

## OpenRouter

For OpenRouter, check whether a key is already available:

```bash
node "<plugin-root>/scripts/config.mjs" get claude_openrouter_api_key
```

If no key is configured, either use an existing `OPENROUTER_API_KEY` environment variable or run:

```bash
node "<plugin-root>/scripts/login.mjs"
```

Use `anthropic/claude-opus-4.7` as the recommended OpenRouter model unless the user chooses a custom Anthropic-compatible slug.

## Save

For Claude subscription:

```bash
node "<plugin-root>/scripts/config.mjs" set claude_provider=subscription claude_model=opus
```

For OpenRouter:

```bash
node "<plugin-root>/scripts/config.mjs" set claude_provider=openrouter claude_model=anthropic/claude-opus-4.7
```

If the user provided a key directly, also save `claude_openrouter_api_key=<key>`.
