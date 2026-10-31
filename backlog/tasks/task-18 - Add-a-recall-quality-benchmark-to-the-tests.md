---
id: TASK-18
title: Add a recall quality benchmark to the tests
status: To Do
assignee: []
created_date: '2026-10-31 08:01'
labels:
  - recall
dependencies: []
priority: medium
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A fixture store and a list of messages with the memories each should and should not recall, run through search and relevant(). Prints precision and recall, and fails if they drop below a floor, so ranking and synonym changes are measured.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Fixture covers synonyms, stemming, tags and unrelated messages
- [ ] #2 Test fails below the floor
- [ ] #3 Scores printed in test output
<!-- AC:END -->
