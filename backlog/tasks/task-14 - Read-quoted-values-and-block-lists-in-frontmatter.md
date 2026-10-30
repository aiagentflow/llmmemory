---
id: TASK-14
title: Read quoted values and block lists in frontmatter
status: Done
assignee: []
created_date: '2026-10-30 15:49'
updated_date: '2026-10-30 15:52'
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
- [x] #1 Quoted description and name are unquoted
- [x] #2 Block-list tags are read
- [x] #3 Existing files still parse the same
<!-- AC:END -->
