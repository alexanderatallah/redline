<p align="center">
  <img src="logo.jpeg" alt="redline" width="300">
</p>

# redline

A Claude Code plugin for automatic code review, adversarial review, and rescue delegation — powered by Codex.

## The model decides

Redline's key principle: **Claude decides what help it needs.** After each response, a Stop hook presents Claude with a summary of uncommitted changes and three options:

- `/redline:review` — standard code review
- `/redline:adversarial` — challenge design decisions, probe hidden assumptions, test failure modes
- `/redline:rescue` — delegate a task to Codex as a smart friend

Claude evaluates the context — what it just did, how complex the changes are, whether a review is already running — and picks the most helpful action, or skips if nothing is needed. No hardcoded triggers, no diff thresholds. The model is in the best position to decide.

## How it works

```
Claude Code Stop hook (fast, <1s)
  → check.mjs reads git diff, deduplicates by hash
  → if new uncommitted changes:
      blocks with available commands listed
      Claude picks the best action based on context
  → if no new changes or stop_hook_active:
      exits silently
```

## Install

```
/plugin install redline@alexanderatallah/redline
```

Then run `/redline:setup` to configure your model and effort level.

### Development

```bash
claude --plugin-dir ./plugins/redline
```

## Commands

| Command | Description |
|---------|-------------|
| `/redline:setup` | Configure model, effort, and optionally authenticate with OpenRouter |
| `/redline:review` | Run a standard code review on uncommitted changes |
| `/redline:adversarial` | Challenge design decisions, probe assumptions, test failure modes |
| `/redline:rescue <task>` | Delegate a task to Codex for help when stuck |

### `/redline:review`

Standard code review. Runs `codex exec review --uncommitted` in the background, assesses findings, and presents issues to the user.

### `/redline:adversarial`

Goes beyond bug-finding. Challenges design decisions, probes hidden assumptions (what is the code silently relying on?), identifies failure modes (race conditions, resource exhaustion, stale state), and questions trade-offs. Asks: is this the right approach?

### `/redline:rescue`

When you're stuck — hand the problem to Codex. Describe what you're working on and what you need help with. Codex works on it in the background. Results are presented faithfully — Claude doesn't filter or second-guess them. You decide which suggestions to act on.

## Configuration

During `/redline:setup`, configure:

- **Model** — which model Codex uses for reviews (default: `openai/gpt-5.4`)
- **Effort** — reasoning effort: minimal, low, medium, high (default: high)
- **Provider variant** — append `:nitro` (fastest), `:floor` (cheapest), or standard routing

## Authentication

Redline routes all Codex inference through [OpenRouter](https://openrouter.ai), giving you access to any model. Set your API key via:

```bash
# Environment variable
export OPENROUTER_API_KEY=sk-or-...

# Or run OAuth login during setup
/redline:setup
```

## Requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Codex CLI](https://github.com/openai/codex)
- [OpenRouter](https://openrouter.ai) account

## License

MIT
