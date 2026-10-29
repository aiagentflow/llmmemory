---
id: TASK-7
title: 'Verify Codex, Gemini, Cursor and Antigravity on real installs'
status: To Do
assignee: []
created_date: '2026-10-29 07:03'
updated_date: '2026-10-29 07:18'
labels:
  - multi-agent
dependencies: []
priority: low
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Only Claude Code is installed here; the other four are tested with payloads built from their docs. When an agent is available, run init and doctor in a scratch directory and confirm index and recall reach the model. Antigravity's injectSteps output is unverified. Clean up any session folders the test creates.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each agent confirmed or its wiring fixed
- [ ] #2 Scratch dirs and session folders removed
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-29: checked this machine. Only /usr/bin/antigravity is present, and it is the Antigravity IDE 1.107.0 (VS Code fork), not the Antigravity CLI. Codex, Gemini CLI and Cursor are not installed. Still blocked.
<!-- SECTION:NOTES:END -->
