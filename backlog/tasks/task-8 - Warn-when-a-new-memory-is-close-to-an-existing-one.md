---
id: TASK-8
title: Warn when a new memory is close to an existing one
status: Done
assignee: []
created_date: '2026-10-29 07:38'
updated_date: '2026-10-29 07:43'
labels:
  - store
dependencies: []
priority: high
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
add and the MCP remember tool name the closest existing memory in the same scope when the new fact shares most of its words, and suggest --name to update it instead. The memory is still saved; only new memories are checked, not updates by name.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 add prints the similar memory and the --name hint
- [x] #2 remember's result names it too
- [x] #3 Unrelated memories and updates by name give no warning
- [x] #4 README, CHANGELOG and tests updated
<!-- AC:END -->
