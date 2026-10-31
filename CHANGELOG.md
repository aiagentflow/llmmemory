# Changelog

## Unreleased

- `edit` works on Windows, opening Notepad unless `VISUAL` or `EDITOR` is set.
  CI now runs on macOS and Windows as well as Linux.

## 0.4.0

- Memories recalled earlier in a session can be recalled again after it is
  compacted or cleared, since they are no longer in the context.
- The session index lists the most recently updated memories first, so when it
  is full the oldest are left out instead of the last alphabetically.
- Memory files read quoted values and block-list tags, and ignore nested
  fields, so hand-written and imported files load as written.
- The session start hook deletes recall records older than a week from the
  temp directory.

## 0.3.0

- `add` and the `remember` tool name the existing memory a new one mostly
  repeats, and say how to update it instead. The new memory is still saved.
- Recall folds common developer synonyms together (deploy and ship, db and
  database, prod and production, and a few more), so "shipping" finds a
  deploy memory.

## 0.2.0

- `import` copies `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` and Claude Code's
  auto-memory into llmmemory, one memory per section, or the files and folders
  given. `--dry-run` shows what it would save; running it again skips what is
  already saved. Source files are never changed.
- `edit <name>` opens a memory in `$VISUAL` or `$EDITOR` and moves its updated
  date only when the text changed.
- Memories not updated in about six months show their last update month in the
  session index, `list` and `search`, and agents are told to confirm them
  before relying on them.
- Install with Homebrew: `brew install aiagentflow/tap/llmmemory`.

## 0.1.0

First release.

- Memories as Markdown files: per project in `.llmmemory/memories/`, and global
  in `~/.llmmemory/memories/`.
- Hooks hand every session an index of memories, and Claude Code, Codex CLI and
  Gemini CLI also get the memories that match each message.
- MCP server with `remember`, `recall`, `read_memory`, `forget` and
  `list_memories`, registered for Claude Code, Codex CLI, Gemini CLI, Cursor and
  Antigravity CLI.
- Commands: `init`, `doctor`, `status`, `add`, `list`, `search`, `show`,
  `forget`, `clean`.
