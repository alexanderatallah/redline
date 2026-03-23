<p align="center">
  <img src="logo.jpeg" alt="redline" width="400">
</p>

# redline

Automatic code review for Claude Code, powered by Codex via OpenRouter.

Run `redline` in any git repo to install a Claude Code hook. When Claude makes code changes, Codex automatically reviews them in the background — visible, killable, and async.

## How it works

```
Claude Code Stop hook (fast, <1s)
  → redline check
  → any uncommitted changes? review already pending?
  → if changes detected:
      tells Claude to run `redline review` as a background task
      Claude spawns it → visible in background tasks, killable
      Codex reviews uncommitted changes
      Claude reads the results and presents findings
  → if no changes or review pending:
      exits silently, Claude proceeds normally
```

Reviews are **async** — Claude keeps working while Codex reviews in the background. No blocking, no waiting.

## Setup

Requires [Bun](https://bun.sh), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and [Codex CLI](https://github.com/openai/codex).

```bash
git clone https://github.com/alexanderatallah/redline.git
cd redline
bun install
bun link
```

### Authentication

All inference is routed through [OpenRouter](https://openrouter.ai). Authenticate with one of:

```bash
# Option 1: OAuth (opens browser)
redline login

# Option 2: Environment variable
export OPENROUTER_API_KEY=sk-or-...
```

## Quick start

```bash
cd your-project
redline              # installs the hook, done
# now use Claude Code normally — reviews happen automatically in the background
```

## Commands

| Command | Description |
|---------|-------------|
| `redline` | Enable reviews with the default model (`openai/gpt-5.4`) |
| `redline <model>` | Enable reviews with a custom model (any OpenRouter slug) |
| `redline off` | Disable reviews (remove the hook) |
| `redline review [model]` | Run a single review manually |
| `redline login` | Authenticate with OpenRouter via OAuth |

### Internal commands (called by hook, not by users)

| Command | Description |
|---------|-------------|
| `redline check [model]` | Fast diff gate — checks for uncommitted changes, outputs hook JSON |

### Model customization

The default review model is `openai/gpt-5.4`. Pass any [OpenRouter model slug](https://openrouter.ai/models) to customize:

```bash
redline openai/gpt-5.4-pro       # use GPT-5.4 Pro
redline google/gemini-2.5-pro     # use Gemini
```

## Why Claude Code only?

Codex CLI's hook system can't feed output back into the agent's context. Claude Code's `Stop` hook supports a `decision: "block"` response with a `reason` field that gets injected directly into Claude's conversation — this is what lets Claude read the review instructions and spawn the background task.

When Codex adds support for feeding hook output back to the agent, redline will support it as the main agent too.

## How the async review works

1. Claude finishes a response → Stop hook fires `redline check`
2. `redline check` runs `git status --porcelain` (<1s) and checks for a pending review marker
3. If changes exist and no review is pending, it tells Claude to run `redline review` in the background
4. Claude spawns `redline review` as a background task (visible in Claude's task list, killable)
5. Codex reviews all uncommitted changes via `codex exec review --uncommitted`
6. When done, Claude reads the output and presents findings to the user
7. The pending marker is cleared, so the next Stop event can trigger a new review if needed

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (main agent)
- [Codex CLI](https://github.com/openai/codex) (reviewer)
- [OpenRouter](https://openrouter.ai) account (free to sign up, pay-per-use)

## License

MIT
