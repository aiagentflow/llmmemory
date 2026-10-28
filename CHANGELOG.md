# Changelog

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
