---
id: TASK-1
title: Add import command for existing agent memory files
status: Done
assignee: []
created_date: '2026-10-29 07:03'
updated_date: '2026-10-29 07:08'
labels:
  - import
dependencies: []
priority: high
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
llmmemory import pulls facts people already keep elsewhere into llmmemory: CLAUDE.md, AGENTS.md, GEMINI.md and Claude Code auto-memory (~/.claude/projects/<slug>/memory/*.md, frontmatter name/description). Auto-memory files map one to one; CLAUDE.md-style files split by heading or bullet into one memory each. Never edits or deletes the source files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 --dry-run lists what would be imported without writing
- [x] #2 Re-running import does not create duplicates
- [x] #3 Claude auto-memory names and descriptions are kept
- [x] #4 Source files are never modified
- [x] #5 README, CHANGELOG and tests updated
<!-- AC:END -->
