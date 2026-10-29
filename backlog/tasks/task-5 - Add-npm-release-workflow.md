---
id: TASK-5
title: Add npm release workflow
status: To Do
assignee: []
created_date: '2026-10-29 07:03'
labels:
  - release
dependencies: []
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitHub Actions workflow that publishes to npm with provenance when a v* tag is pushed, after build and tests pass. Needs an NPM_TOKEN secret the owner adds.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tag push runs tests then npm publish --provenance
- [ ] #2 Tag must match package.json version
- [ ] #3 Release steps documented
<!-- AC:END -->
