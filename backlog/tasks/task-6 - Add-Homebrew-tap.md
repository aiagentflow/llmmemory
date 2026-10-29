---
id: TASK-6
title: Add Homebrew tap
status: Done
assignee: []
created_date: '2026-10-29 07:03'
updated_date: '2026-10-29 07:17'
labels:
  - release
dependencies:
  - TASK-5
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
brew install for llmmemory through a tap like canaryhook's, pointing at the published npm tarball.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 brew install works on a clean machine
- [x] #2 README install section mentions it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Formula merged in aiagentflow/homebrew-tap#1 for 0.1.0. ruby -c passes and the tarball runs, but brew install was not run: Homebrew is not installed on this machine, so AC #1 is unverified.
<!-- SECTION:NOTES:END -->
