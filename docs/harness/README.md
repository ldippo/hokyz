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
It also checks the committed final setup RNG draw equals the consumed match seed,
using the production RNG constructor and one-draw rewind, with JSON evidence.
Add `--layout` for opening and extended natural-shootout tracker captures at
desktop and390px/150% text, bounds checks and exact goal/attempt totals. The named
AI fixture must reach extended history. `--baseline` skips layout assertions.

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
Add `--layout` to `rest.mjs` (map and rest) or `shop.mjs` (resumed shop) to capture
1280x720,390x844 and narrow150%-text layouts. Checks actions/card text reachable
after scrolling and no outer overflow. `--baseline` records without asserting.
These are geometry/pointer persistence checks, not full keyboard/gamepad traversal.
Optional `--nav` adds narrow150% keyboard/synthetic-pad traversal and Save/Continue
checks. Keyboard uses the actual movement-down binding, not aim ArrowDown; each
press asserts its menu input edge. Focus traces and failure captures retain
selected-action evidence. Synthetic pads do not prove physical hardware support.

`node scripts/harness/map-focus.mjs` captures a seeded map before/after keyboard
and synthetic-pad selection, checks the ring/pointer cue, and activates the chosen
rival at narrow150% text. `--baseline` records without asserting cue styles.
Evidence: `.gaming/map-focus/`. Reduced-motion preferences are requested, but
this is not an audit of all existing UI animations or physical controllers.
Add `--motion` to verify app/OS reduced-motion toggles and normal-mode restoration:
map pulse/transition styles, plus mounted HUD-class fixtures for announcements,
countdowns, flashes and status pulses. Announcement checks preserve reading time
and expiry without transform keyframes; fixtures do not establish live match feel.
Add `--intro-layout` for pre-match team/rival/action reachability at desktop,
narrow and150% text, followed by keyboard Back/re-entry and controller match start.
The default seeded case is a normal match, not every boss/grudge/modifier variant.
Combine `--intro-layout` with `--boss-intro` or `--elite-intro` to prepare an
Iron Maidens encounter with grudge2, ascension5 and Long Bomb Night. Checks taunt,
modifier and phase text too; this is UI/setup coverage, not natural progression.
Add `--outnumbered` to either variant to use that mutator, start the match, and
verify three home/four away skaters during period1 with the extra roster entry.
It records the opening faceoff positions and checks no skater overlap (minimum
separation >1.1m); no winner or clock is injected. It flushes pending viewport
resize before rendering and checks the captured ice region is not blank.
Opening feedback checks scoreboard/announcement/countdown separation and center
ice clearance. `--feedback-layout` additionally checks a long boss announcement
through Hud.announce at desktop and narrow150% text (presentation fixture).
Outnumbered also verifies model count matches simulation, reinforcement scene
attachment/visibility/position, and model identity remains stable over ten ticks.
`--hud-layout` captures desktop,390px and390px/150%-text match HUD, checks core
score/name/clock/meter bounds and player-panel separation. Decorative fire-icon
skew is excluded from text-overflow checks. This is not all fight/shootout HUD.

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
`node scripts/harness/playtest.mjs --charge-layout` prepares open-ice possession,
holds actual Shoot input, captures desktop/narrow/150%-text charge HUD, checks
separation from ability/player panels, then releases and checks shot/indicator
clearance. `--baseline` records geometry without enforcing separation.
`--fight` prepares an offer with opponent consent, then checks real keyboard
decline/overlay removal, accept, and high/low/block cue responses. Cue states are
prepared, not naturally earned. Add `--fight-layout --baseline` to record desktop
and narrow150% offer/feint geometry; current narrow fight layout fails bounds.
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
