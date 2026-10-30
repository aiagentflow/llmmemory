---
id: TASK-13
title: Keep the most recently updated memories when the index is capped
status: To Do
assignee: []
created_date: '2026-10-30 15:49'
labels:
  - recall
dependencies: []
priority: medium
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The session index drops memories alphabetically once it reaches INDEX_LIMIT. Order each group by last update, newest first, so the oldest are the ones left out.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Index lists newest first within project and global
- [ ] #2 A capped index keeps the newest
- [ ] #3 Tests updated
<!-- AC:END -->
