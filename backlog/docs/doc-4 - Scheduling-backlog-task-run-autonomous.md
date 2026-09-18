---
id: doc-4
title: Scheduling backlog task run-autonomous
type: guide
created_date: '2026-09-18 17:45'
updated_date: '2026-09-18 17:46'
---
# Scheduling `backlog task run-autonomous`

`backlog task run-autonomous` picks up every task in the configured
`autonomousTriggerStatus`, runs the configured agent command against each one in turn,
and moves a successful run to `autonomousReviewStatus` for human review. It does nothing
if `autonomousTriggerStatus` is not configured.

The command itself does not schedule anything. Running it nightly (or on whatever
cadence you want) means calling it from an OS-level scheduler, the same way
[Running Backlog.md as a Service](doc-003%20-%20Running-Backlog-Browser-as-a-Service.md) runs the Web UI persistently.

## 1. Configure the workflow

```bash
backlog config set autonomousTriggerStatus "Autonom"
backlog config set autonomousReviewStatus "Review"
backlog config set autonomousTaskTimeoutMinutes 30
```

Both `Autonom` and `Review` must already be in the project's configured `statuses` list
(`backlog config get statuses`) before you set them; the command fails closed with a
clear error otherwise, rather than guessing or editing the status list itself. Move a
task into the trigger status only after its plan has been reviewed - the command has no
way to tell a reviewed plan from an unreviewed one.

`autonomousAgentCommand` defaults to invoking `claude` non-interactively with full
permissions, so a run never blocks on an approval prompt overnight. Review the default
with `backlog config get autonomousAgentCommand` and tighten it (a different
permission mode, a wrapper script, a different agent entirely) if the default is not
what you want running unattended:

```bash
backlog config set autonomousAgentCommand 'your-command "$TASK_ID" "$TASK_TITLE"'
```

## 2. Pick the recipe that matches your OS

### Linux / WSL2 (systemd user timer)

Create `~/.config/systemd/user/backlog-run-autonomous-<project>.service`:

```ini
[Unit]
Description=Backlog.md autonomous task runner (<project>)

[Service]
Type=oneshot
WorkingDirectory=/path/to/your/project
ExecStart=/usr/local/bin/backlog task run-autonomous
```

And `~/.config/systemd/user/backlog-run-autonomous-<project>.timer`:

```ini
[Unit]
Description=Nightly run of backlog task run-autonomous (<project>)

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo loginctl enable-linger "$USER"
systemctl --user daemon-reload
systemctl --user enable --now backlog-run-autonomous-<project>.timer

# Check status or follow logs
systemctl --user list-timers backlog-run-autonomous-<project>
journalctl --user -u backlog-run-autonomous-<project> -f
```

### macOS (launchd LaunchAgent)

Create `~/Library/LaunchAgents/md.backlog.run-autonomous.<project>.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>md.backlog.run-autonomous.&lt;project&gt;</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/backlog</string>
    <string>task</string>
    <string>run-autonomous</string>
  </array>
  <key>WorkingDirectory</key><string>/path/to/your/project</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>2</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/backlog-run-autonomous-&lt;project&gt;.out.log</string>
  <key>StandardErrorPath</key><string>/tmp/backlog-run-autonomous-&lt;project&gt;.err.log</string>
</dict>
</plist>
```

```bash
launchctl load -w ~/Library/LaunchAgents/md.backlog.run-autonomous.<project>.plist
```

Use `/usr/local/bin/backlog` on Intel Macs, or the path returned by `which backlog`.

### Windows (Task Scheduler)

```powershell
$action  = New-ScheduledTaskAction -Execute "backlog.exe" `
            -Argument "task run-autonomous" `
            -WorkingDirectory "C:\path\to\your\project"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
Register-ScheduledTask -TaskName "Backlog Run Autonomous (<project>)" -Action $action -Trigger $trigger
```

## 3. After a run

Tasks that finished successfully are now in `autonomousReviewStatus`, with whatever the
agent changed in the working tree. Review them like any other pull request or diff
before moving them to a terminal status. A task that failed or timed out stays in
`autonomousTriggerStatus` with a note in its implementation notes explaining what
happened, so the next scheduled run retries it and you can see why it didn't move.
