---
id: TASK-18
title: Add a recall quality benchmark to the tests
status: Done
assignee: []
created_date: '2026-10-31 08:01'
updated_date: '2026-10-31 08:09'
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
- [x] #1 Fixture covers synonyms, stemming, tags and unrelated messages
- [x] #2 Test fails below the floor
- [x] #3 Scores printed in test output
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline precision 0.53 / recall 0.87 / quiet 3 of 4. Generic-verb stopwords and a 0.5 relative cutoff raised precision to 0.71 with recall unchanged. Known misses: style memories for 'write the PR description' (no shared words) and 'rename this variable' recalling the config memory.
<!-- SECTION:NOTES:END -->
