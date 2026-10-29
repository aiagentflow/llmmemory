---
id: TASK-2
title: Add edit command to open a memory in EDITOR
status: Done
assignee: []
created_date: '2026-10-29 07:03'
updated_date: '2026-10-29 07:10'
labels:
  - cli
dependencies: []
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
llmmemory edit <name> opens the memory file in $VISUAL or $EDITOR (vi fallback) and refreshes its updated date if the file changed. --global/--project pick the scope like show and forget.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Opens the right file for project and global scope
- [x] #2 updated date changes only when the content changed
- [x] #3 Clear error for an unknown name or no editor
- [x] #4 README, CHANGELOG and tests updated
<!-- AC:END -->
