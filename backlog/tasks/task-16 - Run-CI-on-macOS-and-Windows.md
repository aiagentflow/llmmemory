---
id: TASK-16
title: Run CI on macOS and Windows
status: To Do
assignee: []
created_date: '2026-10-31 08:00'
labels:
  - ci
dependencies: []
priority: high
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CI only runs on Ubuntu. Homebrew users are on macOS, and Windows has never been exercised: edit runs through sh, hooks rely on PATH lookup and path handling. Add both to the CI matrix and fix what breaks.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI runs on ubuntu, macos and windows
- [ ] #2 All three pass
- [ ] #3 Anything not supported on Windows is documented
<!-- AC:END -->
