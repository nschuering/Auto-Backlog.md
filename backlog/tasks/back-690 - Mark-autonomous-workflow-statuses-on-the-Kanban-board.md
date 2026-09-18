---
id: BACK-690
title: Mark autonomous-workflow statuses on the Kanban board
status: To Do
assignee: []
created_date: '2026-09-18 17:18'
labels: []
dependencies:
  - BACK-688
ordinal: 321000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
BACK-688 introduces a workflow where tasks in a configured trigger status get picked up unattended and land in a configured review status afterward. On the Kanban board (TUI src/ui/board.ts and browser src/web/components/Board.tsx) these columns currently look like any other status column, giving no visual cue that a task in them is queued for, or was produced by, unattended agent execution. Alex wants that distinction visible at a glance on both board surfaces.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tasks in the configured autonomous trigger status are visually distinguishable on both the TUI and browser Kanban board from tasks in ordinary statuses
- [ ] #2 Tasks in the configured review status are visually distinguishable as awaiting human review, not as done
- [ ] #3 The board renders normally when no autonomous trigger or review status is configured (no broken column or crash)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
