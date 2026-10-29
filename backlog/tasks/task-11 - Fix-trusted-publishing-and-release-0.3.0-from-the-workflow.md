---
id: TASK-11
title: Fix trusted publishing and release 0.3.0 from the workflow
status: To Do
assignee: []
created_date: '2026-10-29 07:39'
updated_date: '2026-10-29 12:24'
labels:
  - release
dependencies:
  - TASK-8
  - TASK-9
priority: high
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The v0.2.0 run failed with E404: the OIDC exchange did not go through and npm fell back to setup-node's placeholder token. Drop registry-url so no placeholder exists, release 0.3.0 by tag, and bump the Homebrew formula. If the exchange still fails, the owner checks the npmjs.com trusted publisher (aiagentflow / llmmemory / release.yml, no environment).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workflow no longer writes a placeholder token
- [x] #2 v0.3.0 published by the workflow, or the failure reported with its log
- [x] #3 Homebrew formula bumped once 0.3.0 is on npm
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Placeholder token removed (PR #10). v0.3.0 run 40870433098 failed with ENEEDAUTH: npmjs.com refused the OIDC exchange, so the trusted publisher entry does not match the run. 0.3.0 was published by hand; Homebrew bumped in homebrew-tap#3. Left open until a tag publishes from the workflow.
<!-- SECTION:NOTES:END -->
