---
id: TASK-5
title: Add npm release workflow
status: Done
assignee: []
created_date: '2026-10-29 07:03'
updated_date: '2026-10-29 07:15'
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
- [x] #1 Tag push runs tests then npm publish --provenance
- [x] #2 Tag must match package.json version
- [x] #3 Release steps documented
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Uses npm trusted publishing (OIDC) instead of an NPM_TOKEN secret; the owner adds the trusted publisher on npmjs.com once. Not exercised until the first tag is pushed.
<!-- SECTION:NOTES:END -->
