# Hokyz Codex gaming harness

Adapted from `../transcend-gaming` (game-quality and delivery-pipeline pillars).
This repo is self-contained at runtime; the sibling repository is not required.

## Use

Launch Codex in this directory. `AGENTS.md` supplies project guidance. Invoke:

- `$hokyz-plan` with a desired improvement to make a scoped local work queue.
- `$hokyz-loop` for one iteration, or explicitly request a bounded burst such as
  “Use $hokyz-loop for up to 2 hours on the ready tasks in docs/harness/queue.md.”
- `$hokyz-handoff` to save progress; ask it to resume to load and verify progress.

Skill sources live in `docs/harness/skills/`; `.agents/skills/` contains relative
symlinks. Restart Codex if the skills are not visible. See official
[skill discovery](https://learn.chatgpt.com/docs/build-skills) and
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Evidence commands

`pnpm harness:check` runs typecheck/build, all Vitest tests, and hockey bot play.
Each run gets an immutable directory under `.gaming/runs/` with logs, `botplay.json`,
and `gates.json`; nonzero means failed. `pnpm harness:bot` runs just the bot gate.
Bounds derive from the existing balance test. `pnpm sim:batch 4` remains available
for the original broader diagnostic report.

Bot reports also include read-only possession diagnostics: live-play seconds owned
by each team versus loose, pass attempts, intended-target completions, teammate /
passer recoveries, interceptions, and unresolved passes at stoppages or capture
end. These use end-of-tick ownership (plus immediate pass/shot events), not exact
touch-by-touch tracking. Completion rate is diagnostic, not a new balance gate.

`pnpm harness:playtest` checks the built game in Chromium: title layout at desktop
and narrow sizes, real keyboard menu navigation and text entry, captain selection,
save/continue, human movement and aimed shots in fixed-step fixtures, and pause /
resume. Evidence goes in `.gaming/playtests/`. It does not certify an entire run,
gamepad hardware, or real-time performance. Rebuild before using it on changed code.
It also exercises keyboard pass release to a moving AI receiver, natural pickup,
automatic control transfer, and a follow-up keyboard shot without resetting
possession. `human-passing.json` retains the pass/switch/shot event evidence.

`node scripts/harness/rewards.mjs` (after building) uses a terminal-win fixture
through the real match outcome UI, reloads at result and draft screens, verifies
identical choices and once-only offer telemetry, then checks perk-pick and cash-skip
persistence. Evidence goes in `.gaming/rewards/`. This is reward/save recovery
coverage, not proof of a complete run or a human-played victory.
Add `--skills` to exercise the shootout reward path with a prepared reachable
shootout node and terminal win. Skills skips must preserve cash (no +25 match
bonus). Unit tests cover both Shootout and Hit Parade draft persistence.

After building, `pnpm harness:capture` starts its own Vite preview server on an
ephemeral loopback port, uses Playwright Chromium, and writes title/rink screenshots
and telemetry under `.gaming/captures/`. Install Chromium once with
`pnpm exec playwright install chromium`, or set `GAMING_CHROME` to a browser binary.
Capture uses the existing App inspection interface and fixes the attract roster's
Date.now input. It does not drive the full human run or pretend to implement the
source harness's enemy/kills/upgrades bot contract. Frame p95 is diagnostic,
especially on software rendering; it is not a calibrated hardware performance gate.

## Porting choices

Claude rules become AGENTS.md plus task-specific design/workflow documents; slash
skills become Codex skills. Claude hook JSON, Task tool syntax, model names, and
`/loop` scheduling are not copied. Gates are explicit commands and part of CI.
The loop is performed by the active Codex session; it does not install a background
scheduler or survive a closed session. Handoffs preserve continuation state.

Planning/review roles are sequential passes by default. A real blind panel requires
independent reviewers and anonymized evidence; self-review must not claim that.
We omit the source's automatic git add-all, commit, destructive rollback, Steam
publishing, and paid asset services. Git operations follow the user's task scope.

The source's 12-hour/3-no-gain envelope becomes an explicit deadline and consecutive
no-gain count in a burst report. Stop on deadline, three no-gain iterations, an
unrecovered regression, no ready tasks, or a genuine blocker. Never extend a burst
or invent new ready tasks to keep it running.
