<p align="center">
  <img src="logo.jpeg" alt="redline" width="300">
</p>

# redline

A dual Claude Code + Codex plugin for **automatic** code review, adversarial review, and rescue delegation.

Claude Code users can ask Codex to review their changes. Codex users can ask Claude Opus to review their changes. Both directions work with existing subscriptions or [OpenRouter](https://openrouter.ai).

## The model decides

Redline's key principle: **the primary agent decides what help it needs.** After each response, a lightweight Stop hook asks whether code changes were made. If so, the primary agent evaluates the context and picks the most helpful action:

- Review — standard code review
- Adversarial — challenge design decisions, probe hidden assumptions, test failure modes
- Rescue — delegate investigation to the other model when stuck

No hardcoded triggers, no diff thresholds. The model is in the best position to decide.

## How it works

```
Claude Code Stop hook or Codex Stop hook (fires after each response)
  → reminds the primary agent to consider Redline
  → primary agent decides based on what it just did:
      run a review, challenge the design, request rescue help, or skip
  → suppressed when already responding to a hook (no loops)
```

On Claude Code, Redline exposes `/redline:review`, `/redline:adversarial`, `/redline:rescue`, and `/redline:setup`.

On Codex, Redline exposes `$redline-check`, `$redline-review`, `$redline-adversarial`, `$redline-rescue`, and `$redline-setup`. The Codex Stop hook nudges Codex to use `$redline-check` when uncommitted changes exist.

Reviews happen **automatically** — no manual invocation needed. You can also run any command directly at any time.

## Install

```
/plugin install redline@alexanderatallah/redline
```

Then run `/redline:setup` to configure your provider, model, and effort level.

For Codex local development, install the local plugin at `./plugins/redline` after confirming `codex_hooks` is enabled:

```bash
codex features list
```

### Development

```bash
claude --plugin-dir ./plugins/redline
```

For Codex plugin development, use the repo-local plugin at `./plugins/redline`; its Codex manifest is `plugins/redline/.codex-plugin/plugin.json` and its hook file is explicitly `plugins/redline/hooks/codex-hooks.json`.

Internally, shared config, diff targeting, git context, and prompt building live in `scripts/core/`. Claude Code and Codex CLI specifics live in `scripts/adapters/`, while the top-level scripts remain stable plugin entrypoints.

## Commands

| Command | Description |
|---------|-------------|
| `/redline:setup` | Configure provider (OpenAI or OpenRouter), model, effort, and routing |
| `/redline:review [target]` | Run a standard code review (defaults to uncommitted changes) |
| `/redline:adversarial [target]` | Challenge design decisions, probe assumptions, test failure modes |
| `/redline:rescue <task>` | Delegate a task to Codex for help when stuck |

## Codex Skills

| Skill | Description |
|-------|-------------|
| `$redline-setup` | Configure Claude reviewer provider and model |
| `$redline-check` | Decide whether to review, adversarial-review, rescue, or skip |
| `$redline-review [target]` | Ask Claude Code for a read-only standard review |
| `$redline-adversarial [target]` | Ask Claude Code for a read-only design pressure-test |
| `$redline-rescue <task>` | Ask Claude Code for read-only investigation help |

### `/redline:review [target]`

Standard code review. By default reviews uncommitted changes. Pass an argument to review other diffs:

```
/redline:review                    # uncommitted changes (default)
/redline:review last 3 commits     # cumulative diff of last 3 commits
/redline:review against main       # changes vs main branch
/redline:review commit abc123      # single commit
```

### `/redline:adversarial [target]`

Goes beyond bug-finding. Challenges design decisions, probes hidden assumptions (what is the code silently relying on?), identifies failure modes (race conditions, resource exhaustion, stale state), and questions trade-offs. Accepts the same target arguments as `/redline:review`.

### `/redline:rescue`

When you're stuck — hand the problem to Codex. Describe what you're working on and what you need help with. Codex works on it in the background. Results are presented faithfully — Claude doesn't filter or second-guess them. You decide which suggestions to act on.

## Configuration

During `/redline:setup`, configure:

- **Provider** — use your existing OpenAI subscription, or route through OpenRouter for model choice
- **Model** (OpenRouter only) — `~openai/gpt-latest` (default), `openrouter/auto`, or any [OpenRouter model slug](https://openrouter.ai/models)
- **Effort** (OpenRouter only) — reasoning effort: minimal, low, medium, high (default: medium)
- **Provider variant** (OpenRouter only) — `:nitro` (fastest, default), `:floor` (cheapest), or standard routing

During `$redline-setup`, configure the Claude reviewer for Codex:

- **Claude subscription** — uses existing `claude auth login` credentials and defaults to `opus`
- **OpenRouter** — sets Claude Code's Anthropic-compatible gateway env vars and defaults to `anthropic/claude-opus-4.7`

## Authentication

Redline supports two authentication methods:

**OpenAI subscription** — if Codex is already authenticated (`codex login`), Redline can use it directly. No additional setup needed.

**OpenRouter** — route through [OpenRouter](https://openrouter.ai) for access to any model. Set your API key via:

```bash
# Environment variable
export OPENROUTER_API_KEY=sk-or-...

# Or run OAuth login during setup
/redline:setup
```

For Codex users running Claude reviews through OpenRouter, `$redline-setup` reuses `OPENROUTER_API_KEY` or stores `claude_openrouter_api_key` in Redline config.

## Customization

Every command is a plain markdown file in `commands/`. Edit them to fit your project:

- **Focus the review** — add "pay special attention to SQL injection and auth boundaries" to `review.md`
- **Change the adversarial persona** — make it focus on performance, security, or accessibility instead of general design
- **Adjust rescue behavior** — tell Codex to always write tests, or to explain its reasoning step-by-step

No scripts to modify, no config flags to learn. Just edit the markdown and `/reload-plugins`.

## Why Redline?

Compared to other ways of reviewing Claude's code:

| | Redline | Other plugins |
|---|---|---|
| **Models** | OpenAI subscription or any model via OpenRouter | Typically locked to one provider |
| **Automatic reviews** | Stop hook triggers automatically, model decides when to review | Manual invocation only |
| **Customizable** | Edit plain markdown commands to change review behavior | Commands are often hardcoded or complex to modify |
| **Simplicity** | ~13 files, no build step | Often 30+ files across scripts, agents, and configs |

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI](https://github.com/openai/codex)
- OpenAI subscription (via `codex login`) **or** [OpenRouter](https://openrouter.ai) account

## License

MIT
