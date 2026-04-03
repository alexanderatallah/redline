# Changelog

## 0.4.0

- **Skill-based reviews** — `redline` now installs a `/redline` skill (`.claude/commands/redline.md`) that defines how to run the review. Customizable: edit the file below the first line to add focus areas, ignore patterns, or output preferences.
- **Project-local skill** — skill file is per-repo (not global), so different projects can have different review settings
- **Hook scope choice** — choose "just me" (`.claude/settings.local.json`, gitignored) or "whole team" (`.claude/settings.json`, committed)
- **Loop prevention** — Stop hook reads `stop_hook_active` from event JSON to prevent infinite review loops
- **Diff-hash dedup restored** — Stop hook only fires when uncommitted changes differ from the last review trigger (`.git/redline-last-diff`)
- **Scope switch cleanup** — installing to a new scope automatically removes the hook from the opposite scope
- **`redline off` removes both scopes** — cleans up hooks from both settings files
- **Legacy hook migration** — old command/prompt hooks auto-upgrade to current format

## 0.3.0

- **Interactive setup** — `redline` now prompts for model, reasoning effort, and provider variant (nitro/floor/standard)
- **Reasoning effort** — configurable per-review via `-c model_reasoning_effort` (minimal, low, medium, high)
- **Provider variants** — append `:nitro`, `:floor` to model slugs for throughput or cost optimization
- **`--effort` flag** — set effort non-interactively: `redline --effort=low`
- **Remove config command** — `redline config` removed (unused; API key managed via `redline login` or env var)
- **Fix `--effort` flag ignored during install** — found by Codex review

## 0.2.0

- **Async reviews** — reviews run as Claude Code background tasks (visible, killable, non-blocking)
- **Diff-hash dedup** — Stop hook only fires when uncommitted changes differ from last check
- **Transparent commands** — hook output shows the raw `codex exec review` command
- **Streaming output** — review progress streams in real-time to background task viewer

## 0.1.0

- Initial release as **redline**
- Stateless CLI: `redline` installs a Claude Code Stop hook, `redline off` removes it
- Hook triggers `codex exec review --uncommitted` via OpenRouter
- OAuth PKCE login for OpenRouter authentication
- Custom model support via positional argument

## Pre-release

- **vigil** (v0.2.0) — background watcher + `.vigil/` filesystem protocol (replaced by hook-based approach)
- **agentmux** (v0.1.0) — tmux split-pane multiplexer with git worktrees (replaced by simpler architecture)
