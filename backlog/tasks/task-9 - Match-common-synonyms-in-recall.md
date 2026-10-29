---
id: TASK-9
title: Match common synonyms in recall
status: To Do
assignee: []
created_date: '2026-10-29 07:38'
labels:
  - recall
dependencies: []
priority: medium
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fold a short built-in list of developer synonyms (deploy/ship, db/database, prod/production, env/environment, test/spec, docs/documentation, deps/dependencies, k8s/kubernetes, js/javascript, ts/typescript, repo/repository, config/configuration, auth/authentication) into one term before ranking, so a message about shipping finds a deploy memory. No model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A query with a synonym recalls the memory
- [ ] #2 Existing ranking tests still pass
- [ ] #3 README Limits section and CHANGELOG updated
<!-- AC:END -->
