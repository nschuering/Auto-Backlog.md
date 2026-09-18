import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { Core } from "../core/backlog.ts";
import type { BacklogConfig } from "../types/index.ts";
import { createUniqueTestDir, initializeFilesystemTestProject, safeCleanup } from "./test-utils.ts";

let TEST_DIR: string;

describe("Core.runAutonomousTasks", () => {
	let core: Core;

	beforeEach(async () => {
		TEST_DIR = createUniqueTestDir("test-autonomous-runner");
		await mkdir(TEST_DIR, { recursive: true });
		core = new Core(TEST_DIR);
		await initializeFilesystemTestProject(core, "Autonomous Runner Test Project");
	});

	afterEach(async () => {
		await safeCleanup(TEST_DIR);
	});

	async function configure(overrides: Partial<BacklogConfig>): Promise<void> {
		const config = await core.filesystem.loadConfig();
		if (!config) throw new Error("Expected config to exist after project init");
		await core.filesystem.saveConfig({
			...config,
			statuses: ["To Do", "Autonom", "Review", "Done"],
			...overrides,
		});
	}

	test("is a no-op when autonomousTriggerStatus is not configured", async () => {
		const { task } = await core.createTaskFromInput({ title: "Untouched task", status: "To Do" });

		const result = await core.runAutonomousTasks();

		expect(result.disabled).toBe(true);
		expect(result.outcomes).toEqual([]);
		const reloaded = await core.loadTaskById(task.id);
		expect(reloaded?.status).toBe("To Do");
	});

	test("fails closed when autonomousReviewStatus is not a configured status", async () => {
		await configure({ autonomousTriggerStatus: "Autonom", autonomousReviewStatus: "Nonexistent" });
		await core.createTaskFromInput({ title: "Trigger task", status: "Autonom" });

		await expect(core.runAutonomousTasks()).rejects.toThrow();
	});

	test("fails closed when autonomousReviewStatus equals autonomousTriggerStatus", async () => {
		await configure({ autonomousTriggerStatus: "Autonom", autonomousReviewStatus: "Autonom" });
		await core.createTaskFromInput({ title: "Trigger task", status: "Autonom" });

		await expect(core.runAutonomousTasks()).rejects.toThrow();
	});

	test("moves a successful run from trigger to review status", async () => {
		await configure({
			autonomousTriggerStatus: "Autonom",
			autonomousReviewStatus: "Review",
			autonomousAgentCommand: "exit 0",
		});
		const { task } = await core.createTaskFromInput({ title: "Ready for autonomous work", status: "Autonom" });

		const result = await core.runAutonomousTasks();

		expect(result.disabled).toBe(false);
		expect(result.outcomes).toEqual([{ taskId: task.id, result: "movedToReview" }]);
		const reloaded = await core.loadTaskById(task.id);
		expect(reloaded?.status).toBe("Review");
	});

	test("leaves a failed run in the trigger status with a note explaining why", async () => {
		await configure({
			autonomousTriggerStatus: "Autonom",
			autonomousReviewStatus: "Review",
			autonomousAgentCommand: 'echo "boom" >&2 && exit 1',
		});
		const { task } = await core.createTaskFromInput({ title: "Will fail", status: "Autonom" });

		const result = await core.runAutonomousTasks();

		expect(result.outcomes[0]?.result).toBe("failed");
		const reloaded = await core.loadTaskById(task.id);
		expect(reloaded?.status).toBe("Autonom");
		expect(reloaded?.implementationNotes ?? "").toContain("Autonomous run failed");
		expect(reloaded?.implementationNotes ?? "").toContain("boom");
	});

	test("kills a run that exceeds the configured timeout and leaves the task resumable", async () => {
		await configure({
			autonomousTriggerStatus: "Autonom",
			autonomousReviewStatus: "Review",
			autonomousTaskTimeoutMinutes: 0.01,
			autonomousAgentCommand: "sleep 5",
		});
		const { task } = await core.createTaskFromInput({ title: "Will time out", status: "Autonom" });

		const result = await core.runAutonomousTasks();

		expect(result.outcomes[0]?.result).toBe("failed");
		expect(result.outcomes[0]?.detail).toContain("timed out");
		const reloaded = await core.loadTaskById(task.id);
		expect(reloaded?.status).toBe("Autonom");
	});

	test("only processes tasks still in the trigger status when the run starts", async () => {
		await configure({
			autonomousTriggerStatus: "Autonom",
			autonomousReviewStatus: "Review",
			autonomousAgentCommand: "exit 0",
		});
		const { task: taskA } = await core.createTaskFromInput({ title: "First", status: "Autonom" });
		const { task: taskB } = await core.createTaskFromInput({ title: "Already moved away", status: "Autonom" });
		await core.updateTaskFromInput(taskB.id, { status: "Done" });

		const result = await core.runAutonomousTasks();

		expect(result.outcomes).toEqual([{ taskId: taskA.id, result: "movedToReview" }]);
		const reloadedB = await core.loadTaskById(taskB.id);
		expect(reloadedB?.status).toBe("Done");
	});
});
