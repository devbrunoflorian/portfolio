# Portfolio agent collaboration

This repository is shared by Codex, Antigravity, and human contributors. Use GitHub Issues and pull requests as the durable handoff; agent chat histories are not shared.

## Before editing

- For parallel or multi-step work, track one task per GitHub Issue with its goal, acceptance criteria, owned file paths, dependencies, agent, and branch/worktree. Check open tasks and PRs for overlapping paths before claiming work.
- Start each task in its own Git worktree and task branch from the latest `origin/main`. Name branches `<agent>/<task-slug>`, such as `codex/home-mobile` or `antigravity/contact-layout`.
- Check `git status` and existing worktrees first. If a checkout has uncommitted changes or unclear ownership, leave it untouched and create a clean worktree. Never reset, stash, or switch a checkout that may belong to another person or agent.
- Assign one active writer per file. A worktree isolates files on disk but does not prevent overlapping changes from conflicting at integration. If two tasks need the same files, run them sequentially; the other agent can review or research without editing those files.
- Treat `origin/main` as the integration target. Do not make task changes directly on `main`.

## Handoff

- Run the relevant project checks and record the exact commands and results in the pull request. State clearly when checks were skipped or blocked.
- For every task that changes project files, push its branch and open one focused pull request to `main`. Include the task reference, scope, and verification results.
- Do not merge a pull request unless the user explicitly asks. Hand off the PR link, branch, and check status when finished.
- Read-only tasks and tasks with no project-file changes do not need a pull request.
