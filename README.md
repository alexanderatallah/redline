<p align="center">
  <img src="logo.jpeg" alt="redline" width="300">
</p>

# redline

A Claude Code plugin for **automatic** code review, adversarial review, and rescue delegation — powered by Codex.

Works with your existing OpenAI subscription, or route through [OpenRouter](https://openrouter.ai) for access to any model (GPT, Claude, Gemini, DeepSeek, and more).

## The model decides

Redline's key principle: **Claude decides what help it needs.** After each response, a lightweight Stop hook asks whether code changes were made. If so, Claude evaluates the context and picks the most helpful action:

- `/redline:review` — standard code review
- `/redline:adversarial` — challenge design decisions, probe hidden assumptions, test failure modes
- `/redline:rescue` — delegate a task to Codex as a smart friend

No hardcoded triggers, no diff thresholds. The model is in the best position to decide.

## How it works

```
Claude Code Stop hook (fires after each response)
  → reminds Claude to consider /redline:... commands
  → Claude decides based on what it just did:
      run a review, challenge the design, delegate to Codex, or skip
  → suppressed when already responding to a hook (no loops)
```

A non-user-invocable skill description stays in Claude's context at all times, providing the decision-making guidance. The hook is just a minimal nudge.

Reviews happen **automatically** — no manual invocation needed. You can also run any command directly at any time.

## Install

```
/plugin install redline@alexanderatallah/redline
```

Then run `/redline:setup` to configure your provider, model, and effort level.

### Development

```bash
claude --plugin-dir ./plugins/redline
```

## Commands

| Command | Description |
|---------|-------------|
| `/redline:setup` | Configure provider (OpenAI or OpenRouter), model, effort, and routing |
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

- **Provider** — use your existing OpenAI subscription, or route through OpenRouter for model choice
- **Model** (OpenRouter only) — `openai/gpt-5.4` (default), `openrouter/auto`, or any [OpenRouter model slug](https://openrouter.ai/models)
- **Effort** (OpenRouter only) — reasoning effort: minimal, low, medium, high (default: medium)
- **Provider variant** (OpenRouter only) — `:nitro` (fastest, default), `:floor` (cheapest), or standard routing

## Authentication

Redline supports two authentication methods:

**OpenAI subscription** — if Codex is already authenticated (`codex auth`), Redline can use it directly. No additional setup needed.

**OpenRouter** — route through [OpenRouter](https://openrouter.ai) for access to any model. Set your API key via:

```bash
# Environment variable
export OPENROUTER_API_KEY=sk-or-...

# Or run OAuth login during setup
/redline:setup
```

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
- OpenAI subscription (via `codex auth`) **or** [OpenRouter](https://openrouter.ai) account

## License

MIT
