---
id: BACK-689
title: Expose autonomous runner settings in the browser Settings UI
status: To Do
assignee: []
created_date: '2026-09-18 17:18'
labels: []
dependencies:
  - BACK-688
ordinal: 320000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-688 adds a CLI-driven autonomous runner whose behavior (trigger status, review status, per-task timeout) is read from project config. Right now those values could only be set by editing config.yml or via 'backlog config set'. Alex wants them visible and editable from the browser Settings page (src/web/components/Settings.tsx), which already has a Workflow Settings section for comparable config, so a human running the board day-to-day does not need the CLI to see or change how the autonomous workflow is configured.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The autonomous trigger status, review status, and per-task timeout are visible and editable in the browser Settings page
- [ ] #2 Saving invalid or missing values (e.g. a status not in the configured statuses list) is rejected with a clear message, consistent with existing config validation
- [ ] #3 No subtitle or helper text is added beneath the new fields beyond a concise label, per the project's UI copy rule
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
