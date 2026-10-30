---
id: TASK-15
title: Delete old recall records from the temp directory
status: To Do
assignee: []
created_date: '2026-10-30 15:49'
labels:
  - hooks
dependencies: []
priority: low
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every session leaves a small JSON file in tmpdir/llmmemory that is never removed. The session start hook deletes records older than a week, quietly and never failing the session.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Records older than 7 days are removed at session start
- [ ] #2 Errors never reach the session
- [ ] #3 Tested
<!-- AC:END -->
