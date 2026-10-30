---
id: TASK-15
title: Delete old recall records from the temp directory
status: Done
assignee: []
created_date: '2026-10-30 15:49'
updated_date: '2026-10-30 15:53'
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
- [x] #1 Records older than 7 days are removed at session start
- [x] #2 Errors never reach the session
- [x] #3 Tested
<!-- AC:END -->
