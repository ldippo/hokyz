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
For Fight Night intro text/layout use `map-focus.mjs --intro-layout --elite-intro
--fight-night`; this prepares the mutator, not naturally earned fight outcomes.

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
`--name-tags` with Outnumbered checks projected opening label bounds, no overlap,
stable repeated render, and all/controlled/off visibility restoration. It does
not establish dense moving-cluster legibility or target-GPU performance.
`--name-motion` samples90 frames over9 sim seconds at10Hz, recording visible
label bounds, overlaps, lane changes, total/max vertical displacement and mean
raise (world meters), plus worst/periodic captures. Add `--narrow`
for390px. This is diagnostic: PASS means capture/flow completed, not zero overlap.

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

`node scripts/harness/natural-route.mjs --seed=route-act-2` traverses an untouched
generated Act1 map, retaining original rosters/injuries and earning every upgrade.
It chooses connected nodes, favors healing when hurt, picks first offered upgrades,
and uses production AI to pilot hockey. Checks map immutability, encounter advance,
match counters, draft/level-up reloads, and earned Act2 or natural loss settlement.
Evidence goes to `.gaming/natural-route/`. A forced Hit Parade is explicitly
unsupported, never rewritten. Shootout handling exists but is not covered by the
initial three seeds. This is not human difficulty or complete-run victory evidence.
Add `--through-act=2` to continue until earned Act3 or natural loss. Map checks
allow only the production new-act rematch rule: at most half eligible match/elite
nodes reassigned to previously beaten rivals; topology and other content stay fixed.
Each saved step also writes a full `.checkpoint.json` with persisted run/meta.
`--resume=.gaming/natural-route/<run>/<step>.checkpoint.json` loads that exact
checkpoint through Continue; reports retain its path. Resumed evidence depends on
the source checkpoint's provenance, not merely on the presence of a save file.

`node scripts/harness/intro-navigation.mjs --resume=<full-checkpoint.json>` checks
an earned later-row pre-match preview: pointer Back, reload/Continue and keyboard
Escape retain connected map choices, completed path and run RNG; Drop the Puck
then consumes and persists setup RNG. The first available node
must be a hockey match. Evidence: `.gaming/intro-navigation/`; `--baseline` records
without recovery assertions. Unit tests separately cover roster-stat/seed stability
and fresh home lineup selection. Generated identity-only opponent IDs may change.
Add `--layout` for desktop,390px and390px/150%-text captures and scroll-reachability
checks of team summaries, phase cards and actions using that earned encounter.

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
prepared, not naturally earned. Add `--fight-layout` to check desktop and
narrow150% offer/feint geometry; `--baseline` records without bounds assertions.
Combine with `--remap` to verify offer glyphs and reactions after key swaps.
`--fight --fight-full` instead lets the accepted duel resolve naturally with idle
human input and pinned initial duel RNG, checks clock freeze/loser ejection/2v3
faceoff, then advances the remaining period naturally and verifies3v3 restoration.
Only offer/consent and initial RNG are prepared; no health, clock or outcome edits.
`--goalie-pull` holds actual Pass for the production wall-time threshold, verifies
pull/extra-attacker/empty-net status, then releases and holds again to return the
goalie and clear the status. Combine with `--gamepad` for synthetic-pad polling.
Checks existing model presence; not sustained extra-attacker movement or hardware.
Add `--goalie-sustain` to continue each hold for90 sim ticks, assert no duplicate
toggle and model/position agreement, then verify return movement and recovery
within the goal area after90 more ticks. This remains fixed-step keyboard evidence.
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
Add `--play-motion` with `--arena` to continue another12 simulated seconds at10Hz,
retaining120 state/event samples, six periodic images and the first natural hit.
Samples include puck height, projected screen position and visibility flags;
the first hit also retains a200px browser crop centered on that projection.
Owned-puck samples include actual blade-vertex distance/height, both hand-anchor
errors, full carrier simulation state and relevant rig pose state for reproduction.
First non-goalie action, low-lean and below-ice samples retain captures/JSON when
observed. Low-lean is a state classification, not proof the neutral solver applied;
unreachable targets may retain authored poses. PASS checks diagnostic geometry,
not universal blade clearance/contact (goalies and action poses are included).
Unlike arena-fixed, this advances camera/pose time. The first frame still inherits
the unsmoothed fixed-camera setup; inspect later frames for settled framing.
This is sampled AI attract play, not live human motion or target-GPU performance.

`node scripts/harness/puck-motion.mjs` checks a prepared airborne loose puck with
normal/reduced/restored app preferences through production startView and fixed
render times. Asserts steady reduced-motion locator, normal pulse restoration,
visible floor cue and elevated physical puck. Evidence: `.gaming/puck-motion/`;
`--baseline` records pulse without motion assertions. Not OS preference coverage,
natural passes or live replay evidence; incidental attract rosters are not pinned.

`node scripts/harness/models.mjs --timing` compares the real skater rig after
100ms knockdown and200ms recovery at fixed30/60/120Hz updates. It asserts matching
fall/lean values and control-ring anchoring, retaining JSON and close captures.
`--baseline` records without those assertions. Initial pose, velocity and cosmetic
fall seed are prepared; this does not measure hardware FPS or all animation paths.
`--stride` instead samples12 fixed stride phases, measuring foot-weighted lower
vertices against the ice and retaining four side captures. Optional `--speed=12`
and `--roll=0.35` exercise turbo/turn lean; default6m/s and zero roll. Assertions
check support height and ring anchoring, not natural human skating or stick contact.
Add `--stick` to assert stick clearance and opposite-hand cached-anchor error
below2cm. Cached anchors are not proof of actual glove-to-shaft contact.
Use `--speed=16.0225 --roll=-0.017 --stick` for the full-speed phase9 clearance
regression; the former1.2rad correction limit abandoned a nearly-clear pose.
`--clearance-scan --baseline` additionally records37 right-arm correction angles
from0 to1.8rad, restoring the original pose afterward. This diagnoses available
clearance, not a recommendation to use every sampled angle in live animation.
`--action=charge`, `--action=dragL` and `--action=dragR` prepare additional poses
through the same12 stride phases. These are pose fixtures, not actual shot input.
Add `--puck` to show a carried puck placed by production stickPoint and measure
nearest blade-vertex distance in the ice plane. It also asserts deke blade lateral
motion follows the puck's side; it does not assert full blade/puck contact. Viewer
support is opt-in via `?rigview=1&puck=1`, with a diagnostic placePuck hook.
Add `--carry` to the stride fixture to prepare settled carrier blending; normal
6m/s/zero-roll skating asserts nearest blade vertex is15–19cm from the puck center
(rendered puck radius16cm). `--facing=<radians>` rotates the fixture and velocity;
use with normal skating, since the deke direction assertion is facing0-specific.
`--puck --carry-motion` samples150 frames of possession acquisition, charge,
release, left drag and possession loss at60Hz, checking grip/ice, blend settling
and per-frame blade displacement. It excludes the existing authored shot-release
snap from the continuity bound; that frame remains in JSON. `--baseline` disables
only the new carrier solver for comparison and skips the displacement assertion.
These are prepared animation sequences, not hardware timing or full collision tests.
`--puck --goalie-carry=<play-motion.json>` replays saved goalie carrier state and
rig pose state at a normalized origin, captures each case, and checks cached blade
clearance/hand anchors. `--baseline` records without those assertions. Cached bounds
are conservative, so heights need not equal actual source blade vertices exactly.
This is pose reproduction, not a new natural save or goalie-control input test.
Add `--shaft` to require the goalie blocker hand within3cm of the shaft axis,
the catching hand more than20cm away, and only the right hand registered as a grip.
These use bone origins, not exact glove-surface collision. `--standing` overrides
butterfly to zero for a counterfactual standing-pose regression using the same state.
`--puck --reach-study` instead evaluates6132 yaw/tilt/placement transforms per
skating, charge and drag pose, using four cardinal blade-center offsets around
the puck. Reports shoulder reach, hands ahead of torso bounds, hand height no
more than10cm above shoulders and shaft centerline/AABB clearance. Also measures hand anchors against the actual
shaft centerline. Offline facing0 diagnostics, not a runtime pose or exact mesh
collision/contact proof; PASS means valid geometry was sampled, not feasible poses.
Add `--reach-preview` to independently solve both arms for each selected candidate,
record hand-target errors and capture the resulting pose. Missing candidates are
retained as null in the study, not counted as successful poses. This is offline
diagnostic code only; a numerical pass does not establish natural posture, actual
blade/puck contact, transition continuity or other facing directions.
Add `--shaft` to require both actual hand-bone origins within3cm of the physical
shaft centerline in those poses. Asset generation supports `--skater-only`; skater
grips are derived from shared shaft endpoints and assert rest-pose arm reach.
The asset generator also supports `--goalie-only`; its wider paddle shares the
shaft axis, preserving the skater asset when correcting goalie geometry.
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
