---
id: TASK-17
title: Save memories atomically
status: To Do
assignee: []
created_date: '2026-10-31 08:00'
labels:
  - store
dependencies: []
priority: medium
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
saveMemory and edit overwrite files in place, so a hook reading while an agent writes can see a half-written memory. Write to a temp file in the same directory and rename it over the target.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Memory and recall-record writes go through a temp file and rename
- [ ] #2 No temp files left behind
- [ ] #3 Tests pass
<!-- AC:END -->
