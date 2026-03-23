# vigil

Background cross-review for AI coding agents. Run Claude Code or Codex CLI as your main agent, and vigil automatically spins up the other agent in the background to review your changes.

```
vigil claude --dangerously-skip-permissions
```

While you work with Claude, Codex quietly reviews each completed task and writes feedback to `.vigil/reviews/`. Claude checks for reviews after each task, presents any issues found, and asks if you'd like to address them. The same works in reverse with `vigil codex`.

## How it works

```
vigil (parent process)
  ├── watcher (background) → polls .vigil/tasks/, runs reviews, writes .vigil/reviews/
  ├── main agent (foreground, inherited stdio — you interact with it directly)
  └── on exit → kills watcher, cleans up
```

1. You run `vigil claude ...` or `vigil codex ...` with your normal flags
2. Vigil sets OpenRouter env vars, injects the review protocol instructions, and spawns a background watcher
3. The main agent runs exactly as if you launched it directly — all args pass through verbatim
4. After each task, the main agent writes a file to `.vigil/tasks/`
5. The watcher detects new tasks and invokes the opposite agent to review changes
6. Reviews appear in `.vigil/reviews/`, and the main agent reads and presents them to you

## Setup

Requires [Bun](https://bun.sh), and at least one of [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or [Codex CLI](https://github.com/openai/codex). Install both for cross-review.

```bash
git clone <repo-url> && cd vigil
bun install
bun link
```

### Authentication

Vigil routes all inference through [OpenRouter](https://openrouter.ai). Authenticate with one of:

```bash
# Option 1: OAuth (opens browser)
vigil login

# Option 2: Environment variable
export OPENROUTER_API_KEY=sk-or-...
```

## Usage

```bash
# Interactive Claude Code session with background Codex review
vigil claude --dangerously-skip-permissions

# Interactive Codex session with background Claude review
vigil codex --full-auto

# Non-interactive one-shot
vigil claude -p "refactor the auth module"

# All flags pass through — these are the same flags you'd use directly
vigil claude --dangerously-skip-permissions --model opus
vigil codex exec "fix the failing tests"
```

### Commands

| Command | Description |
|---------|-------------|
| `vigil claude [args...]` | Run Claude Code with background Codex review |
| `vigil codex [args...]` | Run Codex CLI with background Claude review |
| `vigil login` | Authenticate with OpenRouter via OAuth PKCE |
| `vigil config` | Show current configuration |
| `vigil config set <key> <value>` | Update a config value |
| `vigil config reset` | Reset to defaults |

## The `.vigil/` protocol

Vigil creates a `.vigil/` directory in your repo root (auto-added to `.gitignore`):

```
.vigil/
  tasks/       ← main agent writes here after each task
  reviews/     ← background reviewer writes here
  watcher.pid  ← PID of background watcher
  watcher.log  ← watcher debug log
```

### Task files

Written by the main agent after completing a task:

```markdown
---
task: fix-auth
agent: claude
model: anthropic/claude-opus-4.6
timestamp: 2026-03-22T10:30:00Z
description: Fixed authentication bug in login flow
---
```

### Review files

Written by the background reviewer:

```markdown
---
task: fix-auth
agent: codex
model: openai/gpt-5.4
timestamp: 2026-03-22T10:32:00Z
---

## Review of fix-auth

The authentication changes look correct overall. Two issues found:

1. **Bug**: Missing null check on `user.session` at line 42
2. **Suggestion**: Consider using httpOnly cookies for token storage
```

After writing a task, the main agent polls `.vigil/reviews/` for up to 3 minutes. If a review appears, it reads the feedback and asks you whether to address it. You can skip the wait at any time.

## Single-agent mode

If only one agent is installed, vigil still works — it just runs without background reviews. You'll see a warning:

```
warn 'codex' not found — running without background reviews.
```

## How instruction injection works

Vigil needs to teach the main agent about the `.vigil/` protocol. It does this transparently:

- **Claude Code**: Uses `--append-system-prompt` to inject protocol instructions (no filesystem side-effects)
- **Codex CLI**: Appends a marked block to `AGENTS.md` at the repo root (Codex auto-discovers this file). The block is wrapped in `<!-- vigil:begin -->` / `<!-- vigil:end -->` markers so it can be cleanly removed on exit. If `AGENTS.md` already exists, the original content is preserved and restored.

## Configuration

Stored at `~/.config/vigil/config.json` with restricted permissions (0600).

| Key | Description |
|-----|-------------|
| `openrouter_api_key` | Your OpenRouter API key |
| `user_id` | OpenRouter user ID (set by OAuth) |

## Requirements

- [Bun](https://bun.sh) runtime
- At least one of: `claude` (Claude Code), `codex` (Codex CLI)
- Both agents for cross-review functionality
- An [OpenRouter](https://openrouter.ai) account (free to sign up, pay-per-use)

## License

MIT
