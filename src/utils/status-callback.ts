import { spawn } from "bun";

export interface StatusCallbackOptions {
	command: string;
	taskId: string;
	oldStatus?: string;
	newStatus?: string;
	taskTitle: string;
	cwd: string;
	/** Kill the command and report failure if it has not exited after this many milliseconds. */
	timeoutMs?: number;
}

export interface StatusCallbackResult {
	success: boolean;
	output?: string;
	error?: string;
	exitCode?: number;
}

/**
 * Executes a status change callback command with variable injection.
 * Variables are passed as environment variables to the shell command.
 *
 * @param options - The callback options including command and task details
 * @returns The result of the callback execution
 */
export async function executeStatusCallback(options: StatusCallbackOptions): Promise<StatusCallbackResult> {
	const { command, taskId, oldStatus, newStatus, taskTitle, cwd, timeoutMs } = options;

	if (!command || command.trim().length === 0) {
		return { success: false, error: "Empty command" };
	}

	try {
		const env = {
			...process.env,
			TASK_ID: taskId,
			OLD_STATUS: oldStatus ?? "",
			NEW_STATUS: newStatus ?? "",
			TASK_TITLE: taskTitle,
		};

		const proc = spawn({
			cmd: ["sh", "-c", command],
			cwd,
			env,
			stdout: "pipe",
			stderr: "pipe",
		});

		let timedOut = false;
		const timeoutHandle =
			timeoutMs !== undefined
				? setTimeout(() => {
						timedOut = true;
						proc.kill();
					}, timeoutMs)
				: undefined;

		try {
			const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);

			const exitCode = await proc.exited;
			const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");

			if (timedOut) {
				return {
					success: false,
					output: output || undefined,
					exitCode,
					error: `Command timed out after ${timeoutMs}ms`,
				};
			}

			const success = exitCode === 0;
			return {
				success,
				output: output || undefined,
				exitCode,
				...(stderr.trim() && !success && { error: stderr.trim() }),
			};
		} finally {
			if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
		}
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
