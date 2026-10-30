---
id: TASK-12
title: Recall memories again after compaction
status: Done
assignee: []
created_date: '2026-10-30 15:49'
updated_date: '2026-10-30 15:50'
labels:
  - recall
dependencies: []
priority: high
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memories are recalled once per session, tracked in the temp directory. After /compact or /clear they are gone from the context but still marked as recalled. The session start hook clears that record unless the session is being resumed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Session start with source compact or clear resets recalled memories
- [x] #2 Resume keeps them
- [x] #3 Tests cover both
<!-- AC:END -->
