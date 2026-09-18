---
id: BACK-688
title: Add autonomous task execution runner
status: To Do
assignee: []
created_date: '2026-09-18 17:12'
labels: []
dependencies: []
ordinal: 319000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tasks on the Kanban board can already use any configured status string, but there is no way to have an agent pick up tasks unattended (e.g. overnight) and no safe place for the result to land for human review. Alex wants a workflow where a human moves a reviewed/planned task into a configured status (e.g. "Autonom"), and an external scheduler (cron/systemd/launchd/Task Scheduler, per the pattern in doc-003) periodically invokes a new CLI command that picks up tasks in that status, runs an agent against each one using the existing task-execution instructions, and moves the result into a separate review status (e.g. "Review") rather than Done, so a human still verifies the outcome before it counts as finished. This keeps the Core Loop's plan-review-execute-verify order intact: the human already reviewed the plan before moving the task to the trigger status, and reviews the outcome before it is marked Done.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A new CLI command (e.g. backlog task run-autonomous) finds tasks whose status matches a configured trigger status and is a no-op when that status is not configured
- [ ] #2 For each matched task, the command invokes an agent using the project's existing task-execution instructions and processes tasks sequentially, respecting existing task locking
- [ ] #3 On completion the task's status is changed to a configured review status distinct from the trigger status, never directly to a terminal/Done status
- [ ] #4 A failed or interrupted run leaves the task in a state a human can understand and resume (task is not left silently stuck or duplicated on the next run)
- [ ] #5 The trigger and review status names are read from project config, not hardcoded
- [ ] #6 Behavior is documented in CLI help and in a guide analogous to doc-003 showing how to schedule the command with cron/systemd/launchd/Task Scheduler
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 bunx tsc --noEmit passes when TypeScript touched
- [ ] #2 bun run check . passes when formatting/linting touched
- [ ] #3 bun test (or scoped test) passes
<!-- DOD:END -->
