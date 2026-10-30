---
id: TASK-14
title: Read quoted values and block lists in frontmatter
status: To Do
assignee: []
created_date: '2026-10-30 15:49'
labels:
  - store
dependencies: []
priority: medium
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hand-written and imported memory files use YAML forms the parser misses: a quoted description keeps its quotes, and tags written as a block list are lost.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Quoted description and name are unquoted
- [ ] #2 Block-list tags are read
- [ ] #3 Existing files still parse the same
<!-- AC:END -->
