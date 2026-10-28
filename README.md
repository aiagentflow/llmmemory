# llmmemory

**Long-term memory for AI coding agents.**

Every agent session starts from zero. The decision you explained yesterday, the
command that finally fixed the build, the way you like answers written: all of
it has to be said again. llmmemory keeps those facts as plain Markdown files and
hands them back at the right moment: an index when a session starts, and the
full memories that match each message you send.

One memory, shared by every agent you use. No model, no server, no account, and
nothing leaves your machine unless you commit it.

Works with Claude Code, Codex CLI, Gemini CLI, Cursor and Antigravity CLI.

Part of the [aiagentflow](https://aiagentflow.dev) suite.
Website: **[aiagentflow.dev/llmmemory](https://aiagentflow.dev/llmmemory)**

<p align="center">
  <strong>llmmemory init</strong>: wire your agents, save a few facts<br>
  <img src="assets/demos/demo-init.gif" alt="llmmemory init demo" width="720">
</p>

<p align="center">
  <strong>the recall</strong>: one session saves a fact, the next one uses it<br>
  <img src="assets/demos/demo-recall.gif" alt="llmmemory recall demo" width="720">
</p>

## Install

```bash
npm install -g llmmemory
cd /your/project
llmmemory init
llmmemory doctor
```

`init` creates `.llmmemory/memories/`, registers llmmemory's hooks and MCP
server for each agent you use (merging with what is already there), and prints
what each agent got. `doctor` runs every hook and the MCP server for real and
tells you which ones answered.

`llmmemory` must be installed globally: the agents call it by name.

## Tutorial

**1. Wire it up.** In your project, run `init`. It wires Claude Code plus any
agent the project already uses, judged by its config folder. Name them yourself
with `--agents`:

```bash
llmmemory init --agents claude,codex,cursor
```

**2. Check it works.** Hooks fail quietly by design, so a broken install would
look exactly like an empty memory. `doctor` proves it is not:

```console
$ llmmemory doctor
ok    Claude Code session hook    hands over the memory index
ok    Codex CLI session hook      hands over the memory index
ok    MCP server                  answers with 5 tools
```

**3. Work normally.** Tell your agent things worth keeping, the way you would
tell a new teammate. Every session is told to save them to llmmemory, so you
rarely have to ask:

```text
you › Our staging server is heron-7 and we only deploy on Thursdays after 14:00 UTC.
agent › Saved to llmmemory: staging is heron-7, deploys Thursdays after 14:00 UTC.
```

You can save memories yourself too. `--global` ones apply in every project:

```bash
llmmemory add "Deploys go through scripts/ship.sh, never straight to main." --tags deploy
llmmemory add "Prefers short answers without preamble." --global
```

**4. Get it back.** In a new session, days later, in any wired agent:

```text
you › Can I deploy to staging right now?
agent › No. A saved project note says staging (heron-7) deploys happen only on
        Thursdays after 14:00 UTC, and today is Wednesday.
```

The agent was never told again. The session started with an index of every
memory, and the message pulled in the matching one in full.

**5. Keep it honest.** Memories go stale like any notes. Search them, update one
by name instead of adding a near-duplicate, and forget the ones that turn out
wrong:

```bash
llmmemory search deploy
llmmemory add "Deploys now run in GitHub Actions." --name deploys-go-through-scripts-ship-sh
llmmemory forget staging-deploy-window
```

**6. Share it.** Commit `.llmmemory/` and every teammate's agents start with
what yours learned. Add it to `.gitignore` instead to keep it to yourself.

## Agents

| Agent | `--agents` | Memory index | Recall per message | MCP server |
| --- | --- | --- | --- | --- |
| Claude Code | `claude` | `SessionStart` | `UserPromptSubmit` | `.mcp.json` |
| Codex CLI | `codex` | `SessionStart` | `UserPromptSubmit` | `.codex/config.toml` |
| Gemini CLI | `gemini` | `SessionStart` | `BeforeAgent` | `.gemini/settings.json` |
| Cursor | `cursor` | `sessionStart` | through MCP | `.cursor/mcp.json` |
| Antigravity CLI | `antigravity` | `SessionStart` | through MCP | `.agents/mcp_config.json` |

Hooks are registered in `.claude/settings.json`, `.codex/hooks.json`,
`.gemini/settings.json`, `.cursor/hooks.json` and `.agents/hooks.json`.

Per agent:

- **Codex CLI** runs project hooks only once you trust them. After `init`, run
  `/hooks` in Codex and approve llmmemory's.
- **Gemini CLI** connects project MCP servers only in trusted folders. Run
  `gemini trust` in the project.
- **Claude Code** asks you to approve the project's MCP server once.
- **Cursor** and **Antigravity CLI** do not hand their per-message hooks the
  message text, so there is nothing to match memories against. They get the
  index at session start and are told to look memories up with the MCP
  `recall` tool before answering anything that may depend on earlier work.

`status` reports every wired agent, and `clean` unwires all of them.

## How it works

| When | What the agent gets |
| --- | --- |
| A session starts | An index: each memory's name and one-line summary, plus how to save new ones |
| You send a message | The full text of up to 3 memories that match it, each recalled once per session |
| Any time | MCP tools: `remember`, `recall`, `read_memory`, `forget`, `list_memories` |

Matching is keyword search with BM25-style ranking: rare words count for more,
and a match in a memory's name or tags outweighs one in its body. A single
common word deep in a body is not enough to recall a memory, so unrelated
messages add nothing to the context. The index is capped in size, so a large
memory never crowds out your conversation.

Every session is told that llmmemory is the project's shared memory, so agents
save there rather than to an agent-specific memory file the others never see.
They are also told what not to save: anything the code, git history or docs
already record.

## Commands

```bash
llmmemory init                  # create .llmmemory/, wire hooks and MCP server
llmmemory doctor                # run every wired hook and the MCP server
llmmemory status                # where memories live, what each agent gets
llmmemory add "<fact>"          # save a memory ("-" reads it from stdin)
llmmemory list                  # every memory, project then global
llmmemory search <words>        # best match first
llmmemory show <name>           # one memory in full
llmmemory forget <name>         # delete a memory
llmmemory clean                 # unwire every agent; memories are kept
```

Flags: `--json` on every command. `--agents` and `--no-mcp` on init.
`--global`, `--tags`, `--description` and `--name` on add. `--global` or
`--project` on list, show and forget. `--limit` on search.

## Where memories live

- **Project:** `.llmmemory/memories/` in the project root.
- **Global:** `~/.llmmemory/memories/`, for facts about you that apply to every
  project. Set `LLMMEMORY_HOME` to move it.

Each memory is one Markdown file you can read, edit or delete by hand. A file
without frontmatter still loads, with its first sentence as the summary.

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

## Security

Recalled memories are wrapped and labelled as notes from earlier sessions, not
instructions from the user, and a memory cannot close its own wrapper to pose as
something else. Still, anything in `.llmmemory/` reaches the agent's context, so
review memory files in pull requests the way you would a `CLAUDE.md` change.

`init` never overwrites a config file it cannot parse, and `clean` never deletes
a memory.

## Limits

- Recall matches words, not meaning. A message about "shipping" does not find a
  memory that only says "deploy". Tags close most of that gap.
- Cursor and Antigravity CLI recall through MCP only, when the agent decides to
  call it.
- A memory is only as good as the fact behind it. Agents are told to check
  memories against the code before acting on them.

## License

MIT
