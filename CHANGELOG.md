# Changelog

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
