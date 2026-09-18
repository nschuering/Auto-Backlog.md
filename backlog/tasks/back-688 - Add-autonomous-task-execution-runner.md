---
id: BACK-688
title: Add autonomous task execution runner
status: Done
assignee:
  - '@claude'
created_date: '2026-09-18 17:12'
updated_date: '2026-09-18 18:13'
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
- [x] #1 A new CLI command (e.g. backlog task run-autonomous) finds tasks whose status matches a configured trigger status and is a no-op when that status is not configured
- [x] #2 For each matched task, the command invokes an agent using the project's existing task-execution instructions and processes tasks sequentially, respecting existing task locking
- [x] #3 On completion the task's status is changed to a configured review status distinct from the trigger status, never directly to a terminal/Done status
- [x] #4 A failed or interrupted run leaves the task in a state a human can understand and resume (task is not left silently stuck or duplicated on the next run)
- [x] #5 The trigger and review status names are read from project config, not hardcoded
- [x] #6 Behavior is documented in CLI help and in a guide analogous to doc-003 showing how to schedule the command with cron/systemd/launchd/Task Scheduler
- [x] #7 A configurable per-task timeout stops a run that hangs or runs too long, leaving the task in the same human-resumable state as a failed run, so one stuck task cannot block the rest of the queue indefinitely
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 bunx tsc --noEmit passes when TypeScript touched
- [x] #2 bun run check . passes when formatting/linting touched
- [x] #3 bun test (or scoped test) passes
<!-- DOD:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Config (src/types/index.ts, src/constants/index.ts, src/core/backlog.ts, src/cli.ts, src/file-system/operations.ts):
   - Add optional BacklogConfig fields: autonomousTriggerStatus, autonomousReviewStatus (strings, must resolve via getCanonicalStatus against configured statuses), autonomousTaskTimeoutMinutes (positive number), autonomousAgentCommand (string template, default invokes `claude`).
   - Mirror existing checkActiveBranches/activeBranchDays pattern for defaults, CONFIG_AVAILABLE_KEYS, config get/set/list switch-cases, and YAML raw coercion in file-system/operations.ts (drop otherwise on round-trip).
   - Feature is disabled (no-op) whenever autonomousTriggerStatus is unset/empty.
   - Fail closed (per manifesto principle 5) if autonomousReviewStatus is unset, unresolvable, or equal to the trigger status.

2. Core.runAutonomousTasks() in src/core/backlog.ts:
   - Load config; short-circuit no-op per above.
   - core.queryTasks({ filters: { status: triggerStatus }, includeCrossBranch: false }), stable ordering by ordinal/id.
   - Per task, sequentially (never parallel): fs.withTaskLock(task, async () => { reload task; skip if status changed since the initial query (someone else moved it); spawn the configured agent command with the task id substituted in, using the execGit timeout/kill-process-group pattern (src/git/operations.ts ~1081-1180) bounded by autonomousTaskTimeoutMinutes; on success move status trigger -> review via editTask; on failure/timeout append an implementation note explaining what happened and leave status unchanged so the task is retried next run and a human can see why }).
   - Return a summary (processed/movedToReview/failed/skipped) for CLI output.

3. CLI: `backlog task run-autonomous` bare subcommand (src/cli.ts, modeled on the `task list`/`task archive` action pattern) with --plain output, no positional task id (queries by configured status instead). Prints a clear message and exits 0 when the feature is not configured.

4. Docs: CLI help text, and a new doc analogous to doc-003 showing how to schedule `backlog task run-autonomous` via cron/systemd timer/launchd/Task Scheduler.

5. Tests: src/test/cli-task-run-autonomous.test.ts mirroring src/test/cli-task-state.test.ts fixture setup - covers no-op-when-unconfigured, happy path (trigger -> review), timeout handling, and skip-when-locked-by-concurrent-edit.

Open decisions needing explicit confirmation before implementation (flagged to Alex separately, not started yet):
   - Exact default autonomousAgentCommand template and what non-interactive/permission flags it passes to the spawned agent process.
   - Whether the review status must already exist in the configured `statuses` list (fail closed) or may be auto-appended.

Confirmed decisions (Alex, 2026-09-18):
   - autonomousAgentCommand defaults to a command that passes --dangerously-skip-permissions (or the equivalent full-autonomy flag) so the unattended run never blocks on an interactive approval; the field stays configurable so Alex can tighten it later. The Review-status gate is the safety net for the resulting changes, not the agent's own permission prompts.
   - autonomousReviewStatus must already be present in the project's configured `statuses` list; the runner fails closed with a clear error and does not mutate the statuses list itself.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented config fields (autonomousTriggerStatus, autonomousReviewStatus, autonomousTaskTimeoutMinutes, autonomousAgentCommand), Core.runAutonomousTasks(), and the 'backlog task run-autonomous' CLI command. tsc and biome check pass. Next: doc-003-style scheduling guide and tests.

Added doc-4 (scheduling guide) and tests (src/test/autonomous-runner.test.ts, plus additions to cli-task-state.test.ts and config-commands.test.ts) - 51 tests pass. Ran the full 'bun run test' suite: 5 unrelated pre-existing failures (backlog doctor drafts scan, TUI gpg-sign persistence, config watcher timing, duplicate-repair reference check, and a missing ssh-keygen executable in this environment) plus 1 simulated 'disk full' test error in server-documents-endpoint.test.ts - none touch files this task changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added `backlog task run-autonomous`: picks up tasks in a configured autonomousTriggerStatus, runs the configured agent command against each sequentially, and moves a successful run to autonomousReviewStatus (fails closed if that status isn't configured or equals the trigger status) rather than a terminal status. A failed or timed-out run leaves the task's status unchanged with an implementation note explaining why, so it is retried and stays understandable to a human. Reused existing infrastructure (queryTasks, editTask's per-task locking, executeStatusCallback extended with a timeout) instead of new mechanisms. Documented in CLI help and a new scheduling guide (doc-4, mirroring doc-003). Verified with 51 new/updated tests (Core logic, CLI integration, config get/set/list round-trip) plus tsc --noEmit and biome check, all passing; the full suite's 5 failures/1 error are pre-existing and unrelated to the changed files.
<!-- SECTION:FINAL_SUMMARY:END -->
