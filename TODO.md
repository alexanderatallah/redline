# TODO

## Bugs

- [ ] **SessionStart hook exits silently on clean repo** — `check.ts` gates on `getDiffStat()` before outputting instructions. Since the SessionStart hook fires once at session start (when the repo is typically clean), Codex never receives the review protocol instructions. Fix: for `--reviewer=claude`, always output instructions regardless of diff state.

- [ ] **Diff hash written before review runs** — `check.ts` writes the hash to `.git/redline-last-diff` immediately, but Claude may skip the review (trivial changes, review already running). The same diff won't trigger again even though no review happened. Fix: consider not writing the hash until the review actually completes.

## Improvements

- [ ] **Codex hook is global** — `installCodexHook` writes to `~/.codex/config.toml`, so the SessionStart hook fires for all Codex sessions across all repos, not just the project where `redline --reviewer=claude` was run. Document this clearly in the README, or explore project-level `.codex/config.toml` scoping.
