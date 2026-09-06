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
Add `--remap` when invoking `node scripts/harness/playtest.mjs` to swap Pass and
Shoot through Controls, test protected Enter/cancel, reload persistence and
Settings help, then exercise the match fixtures with the swapped keys.
Use `--gamepad` to drive match fixtures through a synthetic standard pad and
production polling: analog movement/aim, pass/reception/shot, Start pause/resume,
dead zone, turbo/deke/special edges and disconnect release. Menu setup still uses
keyboard/mouse. This does not prove physical pad compatibility or latency.

`node scripts/harness/rewards.mjs` (after building) uses a terminal-win fixture
through the real match outcome UI, reloads at result and draft screens, verifies
identical choices and once-only offer telemetry, then checks perk-pick and cash-skip
persistence. Evidence goes in `.gaming/rewards/`. This is reward/save recovery
coverage, not proof of a complete run or a human-played victory.
Add `--skills` to exercise the shootout reward path with a prepared reachable
shootout node and terminal win. Skills skips must preserve cash (no +25 match
bonus). Unit tests cover both Shootout and Hit Parade draft persistence.
Use `--shootout-result --layout --assert-layout` for a completed-shootout match
result fixture, explanation text, responsive reachability and reward recovery.
`--baseline` skips explanation assertions for before captures. This prepares the
terminal shootout state; natural shootout evidence remains a separate check.

`node scripts/harness/shootout-full.mjs` runs idle and production-AI players
through a full shootout skills node with natural attempts/outcome. Prepares only
the reachable node/rival; checks alternating attempts, one deciding point, result
totals, unchanged roster, cash and reload. Wins additionally check earned draft
and zero-cash skip. Reports actual outcomes, not guaranteed wins. Evidence:
`.gaming/shootout-full/`. Not human difficulty or hardware timing evidence.

`node scripts/harness/endings.mjs` (after building) prepares a terminal loss and
checks that the saved ended run survives the result screen, Continue settles it,
a failed meta write leaves the run recoverable, and a stale ended save cannot
duplicate payout/records. Evidence is under `.gaming/endings/`. This is settlement
recovery coverage, not proof of playing through an entire run.

`node scripts/harness/hit-parade.mjs` prepares a reachable Hit Parade node and
hit event, then tests real pause/menu input: frozen simulation/save/timer, no
duplicate hit on Resume, Escape/P controls and explicit End challenge settlement.
Evidence: `.gaming/hit-parade/`. It does not prove a human challenge victory.

`node scripts/harness/shop.mjs` prepares a shop node/funds, then checks entry,
purchase, hire, reroll, reload and Leave Shop through the UI. Offers, cash, RNG,
roster and escalating reroll price must survive reload; leaving advances once.
Evidence: `.gaming/shop/`. This is shop persistence coverage, not full-run play.

`node scripts/harness/rest.mjs` prepares injured rosters at ascensions0/4 and a
rest node, then verifies stable Save & Quit/Continue offers, healing policy,
one training or skip, and completed reload. Evidence: `.gaming/rest/`.

`node scripts/harness/route.mjs` exercises event -> shop -> rest in one run,
reloading between encounters. It preserves generated links while preparing the
first three encounter types/injuries. Checks cash, healing, training, pending
state cleanup and connected path. Evidence: `.gaming/route/`. Save-migration
zero defaults are normalized in comparisons; substantive state remains strict.
Add `--combat` to prepare a normal match on the next row and let both teams use
production AI through a natural full-length outcome. Verifies match counters and
reward reload or loss settlement. No score/winner/clock edits; AI control is not
human gameplay evidence and this does not certify a complete run.
Add `--act` to take an earned perk, resolve earned level-ups (including a reload
check), visit the remaining rest/shop, and play the Act 1 boss naturally. A loss
checks settlement; only a win checks Act 2 and its four-offer draft. Use
`--seed=route-act-1` to enter a named seed. Post-combat and post-boss save JSON
checkpoints are retained when reached. Neither flag guarantees a victory.

`node scripts/harness/hit-parade-full.mjs` runs idle and scripted pursuit through
all 60 simulated seconds, using DOM movement/check keys and natural timer expiry.
Requires idle loss/no reward and pursuit victory/cash/draft/zero-cash skip.
Evidence: `.gaming/hit-parade-full/`. Only the reachable node is prepared; no hit
events, score or terminal outcome are injected. Scripted pursuit is not human
difficulty or real-time performance evidence.

Add `--layout --assert-layout` to `rewards.mjs` or `hit-parade-full.mjs` for
desktop/narrow/150%-text result captures and checks of all choices/stat cells.
The match stats region also checks native keyboard horizontal scrolling.
Omit `--assert-layout` to collect baseline clipping/overflow findings.

`node scripts/harness/championship.mjs` checks boss draft -> saved league offer ->
bank, and boss draft -> extend Act 4 -> save/reload -> league loss -> champion
summary. It prepares the last-boss checkpoint and terminal outcomes; actual UI,
reward/league transitions and settlement run normally. Evidence is under
`.gaming/championship/`. It does not certify playing through the prior acts.

`node scripts/harness/result-layout.mjs` captures league and summary screens at
1280x900 / normal text, 1280x720 / 125%, and 390x844 / normal and 125%. Checks
each action is reachable within the viewport after scrolling. `--baseline`
records clipping without asserting. Evidence: `.gaming/result-layout/`.

`node scripts/harness/controls-layout.mjs` checks Controls at desktop, narrow,
and narrow 150% text: labels, keys, actions, horizontal overflow and Reset/Back.
It also checks keyboard remapping/focus/cancel/reset/navigation and synthetic
standard-gamepad D-pad/A/B routing, including cancellation during capture.
Synthetic input does not certify physical controller compatibility or latency.
Use `--baseline` to record without asserting. Evidence: `.gaming/controls-layout/`.

After building, `pnpm harness:capture` starts its own Vite preview server on an
ephemeral loopback port, uses Playwright Chromium, and writes title/rink screenshots
and telemetry under `.gaming/captures/`. Install Chromium once with
`pnpm exec playwright install chromium`, or set `GAMING_CHROME` to a browser binary.
Capture uses the existing App inspection interface and fixes the attract roster's
Date.now input. It does not drive the full human run or pretend to implement the
source harness's enemy/kills/upgrades bot contract. Frame p95 is diagnostic,
especially on software rendering; it is not a calibrated hardware performance gate.

Capture option `--arena` adds a restarted, seeded 360-step attract screenshot
with reduced motion and high quality; `--arena --low` uses low quality for
software-renderer comparisons. The regular live captures/telemetry still run.
High-quality capture can time out on software rendering; report that separately.
`--arena --low --crowd-motion` explicitly enables only crowd animation on the
low-tier fixture, records idle/wave/settled images and uniforms, and checks three
animated meshes plus wave activity 0/1/0. This override is a shader exercise, not
a claim that reduced-motion mode animates crowds. `--baseline` skips assertions.

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
