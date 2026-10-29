---
id: TASK-3
title: Add stale-memory hints
status: To Do
assignee: []
created_date: '2026-10-29 07:03'
labels:
  - recall
dependencies: []
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Memories not updated in about 6 months get an (updated YYYY-MM) marker in the session index, list and status, so agents check them against the code before relying on them. Keep the index within its size cap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Index and list mark memories older than the threshold
- [ ] #2 Fresh memories show no marker
- [ ] #3 Index stays within INDEX_LIMIT
- [ ] #4 README, CHANGELOG and tests updated
<!-- AC:END -->
