# Changelog

## 0.6.0

- **Config is actually respected** — `/redline:review`, `/redline:adversarial`, and `/redline:rescue` now route through `scripts/exec.mjs`, which reads the user's provider/model/effort/API-key from the plugin data store. Previously they used `${user_config.*}` template placeholders that weren't writable from `/redline:setup` (only the `/plugin` UI), so setup answers were silently lost and `codex exec` ran with defaults or an empty API key.
- **`/redline:setup` persists via `scripts/config.mjs`** — no more ambiguity about where setup answers go. `scripts/login.mjs` auto-saves the OAuth API key to the same store.
- **Precedence: stored config > plugin-UI env vars > defaults** — if a user set values via the `/plugin` UI and then ran `/redline:setup`, setup now wins (the most recent explicit action). Previously UI env vars beat stored config and re-created the same "setup answers ignored" bug.
- **`config.mjs get` returns effective values** — `get openrouter_api_key` now follows the same resolution path as runtime (`OPENROUTER_API_KEY` env > plugin-UI env > stored). Previously it only read `config.json`, so `/redline:setup` would incorrectly prompt for a second OAuth login when a key was already present via the plugin UI. `show` still returns raw `config.json` for debugging.
- **`check.md` selection guidelines** — adds signals for when to pick `redline:adversarial` (architecture pressure-test) or `redline:rescue` (stuck / going in circles) instead of the default `redline:review`.
- **Fix skill-vs-agent confusion in `check.md`** — the old wording ("run it as a **background** Agent task") caused Claude to dispatch a nonexistent `redline:code-reviewer` subagent. Now explicitly names the Skill tool and warns against Agent dispatch. Stop-hook reason updated to match.

## 0.5.2

- **Review any diff** — `/redline:review` and `/redline:adversarial` now accept arguments to control what gets reviewed: `last 3 commits`, `against main`, `commit abc123`, or raw Codex flags (`--base`, `--commit`). Defaults to `--uncommitted` when no arguments are given.

## 0.5.1

- **Fix empty skill body crash** — `check.md` now has body content; previously the empty body caused an Anthropic API error (`invalid_request_error`) when the skill was invoked
- **Streamlined check skill** — moved decision logic from frontmatter description into the skill body; shortened description to a one-liner

## 0.5.0

- **Claude Code plugin** — complete rewrite as a native plugin, installable via marketplace
- **Three commands** — `/redline:review` (standard), `/redline:adversarial` (devil's advocate), `/redline:rescue` (delegate to Codex)
- **The model decides** — Stop hook presents available commands; Claude picks the most helpful action based on context
- **`/redline:setup`** — interactive setup wizard with provider detection, model selection, effort, and routing variant
- **Dual provider support** — works with existing OpenAI subscription (via `codex login`) or OpenRouter for access to any model
- **Constrained model choices** — setup offers `openai/gpt-5.4`, `openrouter/auto`, or any custom OpenRouter slug
- **Smart Stop hook** — only fires when there are uncommitted git changes; checks `stop_hook_active` to prevent loops
- **Persistent context via skill description** — review decision instructions live in a non-user-invocable skill (`check.md`) always in Claude's context
- **No external binary** — all scripts bundled in the plugin
- **Customizable commands** — every command is plain markdown; edit to change review focus, persona, or behavior

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
