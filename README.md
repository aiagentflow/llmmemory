# llmmemory

**Long-term memory for AI coding agents.**

Every agent session starts from zero: the decision you explained yesterday, the
command that finally fixed the build, the way you like answers written, all gone.
llmmemory keeps those facts as plain Markdown files and hands them back to the
agent at the right moment: an index when a session starts, and the full memories
that match each message you send.

No model, no server, no account. Memories never leave your machine unless you
commit them.

Part of the [aiagentflow](https://aiagentflow.dev) suite.

## Install

```bash
npm install -g llmmemory
cd /your/project
llmmemory init
```

`init` creates `.llmmemory/memories/`, registers two hooks in
`.claude/settings.json` (merging with hooks you already have) and adds the
llmmemory MCP server to `.mcp.json`. Claude Code asks you to approve the MCP
server once. `llmmemory` must be on your PATH, since the hooks call it by name.

## How it works

| When | What the agent gets |
| --- | --- |
| A session starts | An index: each memory's name and one-line summary, plus how to save new ones |
| You send a message | The full text of up to 3 memories that match it, each recalled once per session |
| Any time | MCP tools: `remember`, `recall`, `read_memory`, `forget`, `list_memories` |

Matching is keyword search with BM25-style ranking: rare words count for more,
and matches in a memory's name or tags outweigh matches in its body. A lone
common word deep in a body is not enough to be recalled, so unrelated messages
add nothing to the context.

The agent is told to save what is worth keeping beyond the session (preferences,
decisions and why they were made, non-obvious facts) and to skip what the code
or git history already records.

## Commands

```bash
llmmemory add "Deploys go through scripts/ship.sh, never straight to main." --tags deploy
llmmemory add "Prefers short answers without preamble." --global
llmmemory add "Deploys now go through GitHub Actions." --name deploys-go-through-scripts-ship-sh
echo "Longer note..." | llmmemory add -

llmmemory list                 # every memory, project then global
llmmemory search deploy        # best match first
llmmemory show <name>          # one memory in full
llmmemory forget <name>
llmmemory status               # where memories live and what is wired
llmmemory clean                # unwire hooks and MCP; memories are kept
```

Add `--json` to any command for machine-readable output.

## Where memories live

- **Project:** `.llmmemory/memories/` in the project root. Commit it to share
  memories with your team, or add it to `.gitignore` to keep them to yourself.
- **Global:** `~/.llmmemory/memories/`, for facts about you that apply to every
  project. Set `LLMMEMORY_HOME` to move it.

Each memory is one file you can read, edit or delete by hand:

```markdown
---
name: deploys-go-through-scripts-ship-sh
description: Deploys go through scripts/ship.sh, never straight to main.
tags: [deploy]
created: 2026-10-28T04:11:07.449Z
updated: 2026-10-28T04:11:07.449Z
---

Deploys go through scripts/ship.sh, never straight to main.
```

## Other agents

The MCP server works with any MCP client (Cursor, Codex CLI, Gemini CLI):
point it at `llmmemory mcp`, run from the project directory. Automatic recall
through hooks is Claude Code only for now.

## Security

Recalled memories are wrapped and labelled as notes from earlier sessions, not
instructions from the user. Still, anything in `.llmmemory/` reaches the agent's
context, so review memory files in pull requests the way you would review a
`CLAUDE.md` change.

## License

MIT
