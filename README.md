<p align="center">
  <img src="logo.jpeg" alt="redline" width="400">
</p>

# redline

Automatic code review for Claude Code, powered by Codex via OpenRouter.

Run `redline` in any git repo to enable automatic reviews. When Claude makes code changes, Codex reviews them in the background — visible, killable, and async.

## How it works

```
Claude Code Stop hook (fast, <1s)
  → redline check
  → uncommitted changes? already reviewed? stop_hook_active?
  → if new changes detected:
      tells Claude to invoke /redline
      Claude reads the /redline skill → runs codex exec review as background task
      visible, killable, streams output
      Claude reads the results and presents findings
  → if no new changes or already reviewed:
      exits silently, Claude proceeds normally
```

Redline installs two things:
1. **A skill** (`.claude/commands/redline.md`) — the review command + instructions. Customizable.
2. **A Stop hook** (`.claude/settings.local.json` or `.claude/settings.json`) — triggers the skill when new changes are detected.

Reviews are **async** — Claude keeps working while Codex reviews in the background.

## Setup

Requires [Bun](https://bun.sh), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and [Codex CLI](https://github.com/openai/codex).

```bash
git clone https://github.com/alexanderatallah/redline.git
cd redline
bun install
bun link
```

### Authentication

All inference is routed through [OpenRouter](https://openrouter.ai):

```bash
# Option 1: OAuth (opens browser)
redline login

# Option 2: Environment variable
export OPENROUTER_API_KEY=sk-or-...
```

## Quick start

```bash
cd your-project
redline
```

Redline will prompt you to configure the review:

```
  Model (openai/gpt-5.4):
  Reasoning effort [1] minimal [2] low [3] medium [4] high (4):
  Provider [1] nitro [2] floor [3] standard (1):
  Hook scope [1] just me (local, not committed) [2] whole team (committed to repo) (1):

ok   Redline installed → openai/gpt-5.4:nitro (high effort)

  Skill:  .claude/commands/redline.md
  Hook:   .claude/settings.local.json
  Invoke: /redline
```

That's it — use Claude Code normally and reviews happen automatically in the background.

## Commands

| Command | Description |
|---------|-------------|
| `redline` | Enable reviews (interactive setup) |
| `redline <model>` | Enable with a specific model (still prompts for effort/variant/scope) |
| `redline off` | Disable reviews (remove hook from both settings files) |
| `redline review [model]` | Run a single review manually |
| `redline login` | Authenticate with OpenRouter via OAuth |

### Configuration options

**Model** — any [OpenRouter model slug](https://openrouter.ai/models). Default: `openai/gpt-5.4`.

**Reasoning effort** — how much the model "thinks" before responding. `minimal`, `low`, `medium`, or `high` (default). Lower effort = faster reviews, higher effort = more thorough.

**Provider variant** — OpenRouter's [provider sorting](https://openrouter.ai/docs/features/model-routing):
- **nitro** (default) — fastest provider (highest throughput)
- **floor** — cheapest provider (lowest price)
- **standard** — default OpenRouter routing

**Hook scope**:
- **just me** (default) — writes to `.claude/settings.local.json` (gitignored)
- **whole team** — writes to `.claude/settings.json` (committed to repo)

## Customizing the review

After running `redline`, you'll find `.claude/commands/redline.md` in your project. The first line (the codex command) is managed by redline. Everything below it is yours to customize:

```markdown
---
description: Run a code review on uncommitted changes using Codex via OpenRouter
allowed-tools: Bash
---
Run `codex exec review ...` as a background task. When complete, assess the findings...

## Your custom instructions below

- Focus on security issues and SQL injection
- Ignore formatting-only changes
- Always suggest test cases for new functions
```

Run `redline` again to update the model/effort/variant — your custom instructions are preserved. You can also invoke `/redline` manually at any time.

## How the Stop hook works

1. Claude finishes a response → Stop hook fires `redline check`
2. `redline check` reads the hook event from stdin — if `stop_hook_active` is true (already continuing from a hook), exits silently
3. Checks `git status` and `git diff --stat` for uncommitted changes
4. Hashes the diff stat and compares against `.git/redline-last-diff` — skips if unchanged since last review
5. If new changes: outputs `decision: "block"` telling Claude to invoke `/redline`
6. Claude reads the skill, runs `codex exec review --uncommitted` as a background task
7. When done, Claude presents the findings

## Why Claude Code only?

Codex CLI's hook system can't feed output back into the agent's context. Claude Code's `Stop` hook supports a `decision: "block"` response with a `reason` field that gets injected directly into Claude's conversation — this is what lets Claude read the review results and act on them.

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (main agent)
- [Codex CLI](https://github.com/openai/codex) (reviewer)
- [OpenRouter](https://openrouter.ai) account (free to sign up, pay-per-use)

## License

MIT
