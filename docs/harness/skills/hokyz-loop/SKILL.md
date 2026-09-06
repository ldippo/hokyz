---
name: hokyz-loop
description: Execute a Hokyz game-quality iteration or an explicitly requested bounded improvement burst, using seeded hockey gates, browser evidence, review, and durable handoffs.
---

Read `AGENTS.md`, `docs/harness/README.md`, `docs/harness/queue.md`, and the current
handoff from the Hokyz root. The user's current request wins over saved state.

For a single iteration, select one authorized ready task (or the user's concrete
task). For a timed burst, create a dated report in `docs/harness/bursts/` with the
goal, start, fixed deadline, ready task IDs and no-gain count before starting.
Check time and the report before every iteration. Stop at deadline, three
consecutive no-gain outcomes, an unrecovered regression, no ready work, or blocker.
Record the stopping reason. A session interruption resumes against the original
deadline; it does not reset the envelope. Do not install a scheduler.

1. Inspect working-tree state and relevant code; claim the task in the queue.
   Save a baseline using `pnpm harness:check`; visual tasks also capture and inspect
   before images with `pnpm harness:capture`. Record existing failures separately.
2. Briefly record the design and acceptance evidence. Implement the scoped change.
   Keep sim/render boundaries and deterministic seeds. Do not weaken bounds or
   change the style anchor solely to make the result pass.
3. Run `pnpm harness:check`. Capture and inspect after images for visual changes;
   compare the same scenario, viewport and quality. Exercise relevant human input
   and navigation when those behaviors changed; attract mode cannot prove them.
4. Review against `docs/design/style.md` and relevant `docs/design/personas.md`
   perspectives. Cite actual evidence; abstain where evidence is missing. These
   are self-review passes unless independent reviewers were actually used.
5. A failing candidate gets one focused repair pass. If still failing, undo only
   this iteration's attributable edits when safe; otherwise preserve them and
   report the conflict. Never use whole-tree reset, checkout or clean. Stop on
   an unrecovered regression. Mark blocked/loss and record the reason.
6. On passing acceptance and review, mark done, record evidence paths and outcome,
   and reset no-gain only for a demonstrated improvement. Commit only when within
   the user's authorized workflow, staging exact files after reviewing them.
7. Update `docs/handoffs/current.md` with outcome, changed paths, checks, limitations,
   and next ready task. For a burst update its report after every iteration; new
   ideas remain proposed. Continue only within the recorded envelope.

Git errors block Git operations. No quality or review result grants permission to
push, merge, deploy, spend on assets, or discard unrelated changes.
