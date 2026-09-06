# Local work queue

Authorized goal: polish this game, improve graphics and make gameplay fantastic,
using the new harness. Work one task at a time; the full goal remains active across
iterations. No timed burst limit was requested.

## P0: Restore a verifiable baseline (done)

Recover zero-byte tracked source/tests from intact indexed blobs, without changing
Git history or replacing nonempty files. Acceptance: build, tests and hockey gate
pass; capture a freshly built game. Preserve recovery provenance in the handoff.

Evidence: `.gaming/runs/1788701296498-RbWjap/` (111 tests, all gates pass),
`.gaming/captures/1788701315813-ngmk9H/` (fresh build captured).

## P1: Arena and front-door presentation (done)

Improve ice/lighting/player readability and title/menu composition using the locked
arcade art direction. Keep title actions visible at 1280x720 and smaller viewports;
preserve controller navigation and accessibility. Evidence: inspected before/after
captures, real menu interactions, build/tests/bot gates.

Implemented a rink-side responsive title layout, baked ice wear, open mesh goal
nets, and stronger on-ice name tags / HUD contrast. Inspected title and rink
captures at `.gaming/captures/1788701950788-2BVdYd/`; desktop/mobile and human
interaction baseline at `.gaming/playtests/1788702131694-aXtMW6/`. Later HUD
validation is recorded in the handoff. Self-review: first-session perspective
prefers the visible play actions; visual readability improved. Real hardware
frame-rate and gamepad play are not established by these software-renderer checks.

## P2: On-ice responsiveness and decision-making (in-progress, depends on P0)

Human pass/receive control-flow check completed:
`.gaming/playtests/1788706278835-21ERT2/` passes keyboard pass H1 -> moving H2,
natural reception, automatic control switch and H2 follow-up shot, without
resetting possession between actions. Event evidence: human-passing.json;
human-pass-received.png inspected (control ring and HUD identify H2).
Baseline `.gaming/runs/1788706220798-dKMKJY/` passes build/132 tests/bot gates.
No game code changed. Self-review: prefer stronger first-session input evidence;
abstain on full-match human feel and hardware timing. Further P2 tuning should
wait for that evidence; next iteration proceeds to P3 full-run/accessibility
validation now that core input/AI contracts have been exercised.

Completed iteration: intentional pass reception. Intended receivers previously
became generic support while the passer chased the puck. Added a receive role
that meets the flight path; teammates retain support. Expired passes, shots and
knocked receivers return to normal pursuit. Four new cases cover these contracts.
Baseline `.gaming/runs/1788706012059-0wqvUk/`; final
`.gaming/runs/1788706128182-2IW4bQ/`: build, 132 tests, eight hockey gates pass.
Completion 35.6% -> 46.1%, completed passes 377 -> 479, attempts 1059 -> 1040;
goals 6.25 -> 6.375. Extended 40-match means: 6.1/6.6/7.9/7.9 by difficulty.
Browser flow `.gaming/playtests/1788706140087-ADmTHc/` passes.
One focused repair decoupled boss-roster assertions from legal goalie pulling;
it still checks the exact original roster plus exactly one boss addition.
Self-review prefers improved reception evidence; no real-time human feel claim.
Next: human pass/receive/control-switch browser evidence, then P3 run progression.

Completed iteration: AI pass-lane awareness. Two fixtures reproduced unsafe
passes with/without pressure over 100 decision seeds each. AI now checks the lane
and actual pass resolver, chooses an available outlet, or keeps skating. Both
fixtures require passing to resume when an outlet opens. No human input changes.
Baseline `.gaming/runs/1788705854469-WsImZH/`; candidate
`.gaming/runs/1788705904359-XYPt7T/`: 128 tests and all hockey gates pass.
Completion 33.5% -> 35.6%, interception 55.7% -> 53.7%, attempts 1381 -> 1059;
mean goals 7.625 -> 6.25. Forty extra matches produced difficulty means
4.7/7.3/6.4/7.8 goals, with no numerical failure or match reaching the tick cap.
Browser flow `.gaming/playtests/1788705916742-yAcgQ0/` passes.
Self-review: prefer-after for avoiding demonstrably covered lanes; improvement
is modest and does not prove satisfying human passing. Next inspect pass-target
AI behavior during flight, then sustained human pass/receive interaction.

Completed iteration: sustained passing/possession evidence. Read-only bot metrics
and seven accounting tests added; baseline match outcomes exactly unchanged and
repeat metrics deterministic. `.gaming/runs/1788705761716-bDK6Sz/` passes build,
126 tests and eight bot games. Of 1,381 passes: 462 intended completions (33.5%),
141 team/pass-owner recoveries, 769 interceptions, nine unresolved. Loose puck:
34.4% of live play. Diagnostic, not a new gate. Next investigate AI passing into
blocked lanes and receiver behavior before tuning passing frequency.

Completed bounded iteration: separate breakout support lanes. Six regression
cases reproduced both outlets choosing the same wing; both attack directions
now offer opposite-side targets stable as teammates cross the carrier.
Baseline `.gaming/runs/1788705059826-yhxxwh/`; passing candidate
`.gaming/runs/1788705129993-HN6e1o/` (119 tests, eight bot matches).
Mean goals 8.75 -> 7.625 within unchanged bounds; own goals unchanged at two.
Browser flow passed `.gaming/playtests/1788705136939-8MsoSl/`.
Self-review: prefer-after for distinct passing options; abstain on real-time feel
and broader balance from this small cohort. Next: sustained pass completion and
possession evidence, then P3 progression/accessibility checks.

Inspect and exercise human controls and AI play. Improve evidenced shortcomings in
passing, possession, teammate support and action feedback. Add behavioral tests for
changed mechanics; compare seeded hockey metrics and exercise human match flow.

Fixed shots using movement instead of dedicated aim. AI now fills the same aim
contract, preserving its prior trajectory choices. Two regression tests failed
before the fix and passed afterward; all 113 tests and hockey gates pass at
`.gaming/runs/1788702247420-5oABlM/` (mean goals remains 8.75). Browser fixture
confirmed aiming far while skating near. Also fixed gameplay key bindings eating
team-name letters. Next: sustained passing/possession and teammate-support play,
then complete-run progression, settings/reduced-motion and hardware limitations.

## P3: Full-game polish and validation (in-progress)

Completed full Hit Parade browser play evidence. New hit-parade-full.mjs prepares
only the reachable node, then plays 60 simulated seconds via DOM movement/check
keys and natural timer expiry. Idle loses0/8 without reward; seeded nearest-target
pursuit wins41/8, receives60 cash/draft and skips without extra cash. Both repeated
runs agree. Final `.gaming/hit-parade-full/1788710587394-xEcwfX/` passes; first
reward capture `.gaming/hit-parade-full/1788710509062-sMyivE/chase-result.png`
inspected. Build/147 tests/bot `.gaming/runs/1788710525593-Cgz9HN/` pass.
No game tuning. Self-review confirms connected hit/scoring/reward flow; scripted
target tracking cannot establish fair/fun human difficulty. Next: narrow/large
text skill reward and match-result layouts, then broader full-run/hardware.

Completed seeded Hit Parade steering: extracted DOM-free HitParadeDummies with
challenge-local RNG, duplicate-time guard, existing target ranges and turbo odds.
Skills uses a derived match seed and commits run RNG after consuming that seed.
Four cases cover full-minute input replay, full MatchSim movement/nonzero scoring
replay with pause, seed variation and escaped-dummy return. Final build/147 tests/
bot gates `.gaming/runs/1788710370603-dMhVS1/` pass. Browser pause/end regression
`.gaming/hit-parade/1788710347654-meIvzn/` passes. Self-review prefers repeatable
challenge behavior; this does not establish human difficulty/fun. Next: sustained
Hit Parade hits and natural timer expiry/rewards, then full-run and hardware.

Completed Hit Parade pause fix: P/Escape opens Resume and explicit End challenge;
paused sim/score/timer/save are retained. Timer follows simulation advancement,
and a menu-resume callback cannot recount the previous hit. Final gates
`.gaming/runs/1788709992132-oxjbOB/` pass build/143 tests/bot. Browser fixture
`.gaming/hit-parade/1788710099180-EMQPCu/` passes timer freeze across300 ticks,
resume without duplicate score, P/Escape, and explicit end/no unearned cash.
Pause capture inspected in `.gaming/hit-parade/1788710070619-zqiDL3/`.
Self-review prefers recoverable interruption. Dummy AI still uses Math.random;
determinism, full challenge play and narrow layouts remain next work.

Completed crowd-wave lifecycle fix: explicit active uniform gates periodic wave
lift; idle/finished waves no longer deform spectators. Two tests cover lifecycle,
no restart while active, restart after finish and disabled-animation materials.
Build/143 tests/bot gates `.gaming/runs/1788709703768-0nP8H0/` pass. Corrected
animated browser fixture `.gaming/captures/1788709803139-wBFPvJ/` passes three
motion shaders and activity0/1/0; wave/settled captures inspected. Initial fixture
mistakenly set unapplied overrides and was static; failed assertion preserved in
`.gaming/captures/1788709722060-XMGpu9/`. Self-review prefers bounded celebration;
no high-tier/hardware claim. Next: Hit Parade pause currently calls finish().

Completed crowd presentation pass: rounded connected silhouettes, bent seated
legs, hair/skin/trousers separated from muted apparel using per-vertex and
per-instance shader attributes. Retains three instanced meshes, no sim edits.
Before `.gaming/captures/1788709240924-js6IQ3/`, after
`.gaming/captures/1788709325766-P0iDN1/`: inspected low1280x720 attract scenes,
not frame-identical. Capture restart helper corrected afterward; final seeded
capture `.gaming/captures/1788709438559-xA8rJC/` passes and was inspected.
Gates `.gaming/runs/1788709308602-dEBySB/`: build/141 tests/bot pass after one
shader typing repair. High baseline `.gaming/captures/1788709090435-Yefhkc/`
timed out on software rendering. Self-review prefers rounded spectators and
reduced color distraction; high-tier/animated appearance and hardware cost remain
unverified. Extra geometry preserves draw-call count, not necessarily frame rate.

Completed on-ice controller contract validation: playtest.mjs --gamepad reuses
the production match fixtures with synthetic analog sticks/A/B/Start. Also checks
dead zone, analog magnitude, independent aim, turbo/deke/special edges and
disconnect release. `.gaming/playtests/1788708953817-5FESBe/` passes; keyboard
regression `.gaming/playtests/1788708955188-Z2OeTW/` passes. Build/141 tests/bot:
`.gaming/runs/1788708913724-eFPNGj/`. No game-code change. Self-review supports
input contracts, not physical-controller latency or human game feel. Inspected
first controller capture shows crowd visual noise; inspect high-quality arena
next before deciding a graphical change. Match/skills narrow layouts remain open.

Completed Controls navigation fix: enable Nav outside capture; retain selected
row through rebind/cancel, reset focus, and allow controller B to cancel capture
without leaving Controls. During capture other menu inputs are ignored.
`.gaming/controls-layout/1788708779263-OFpAwU/` passes keyboard rebind/cancel,
navigation using newly assigned down key, reset/back, synthetic D-pad/A/B capture
and cancel/back, plus prior layout gates. Build/141 tests/bot gates pass:
`.gaming/runs/1788708741933-urIPCz/`. Self-review prefers mouse-free access;
real gamepad compatibility/latency and full-run play remain unproven.

Completed Controls layout iteration: bounded 640px list, readable body labels,
compact unskewed actions, stacked narrow rows and restrained dark backdrop.
Baseline `.gaming/controls-layout/1788708545165-I5BgRw/` clips reset at narrow
normal text and all action labels at narrow150%. Candidate
`.gaming/controls-layout/1788708623724-DUAwYk/` passes all three viewport/text
cases, keys/labels/actions/overflow and Reset/Back. Desktop/narrow150% images
inspected. Gates `.gaming/runs/1788708608986-GMoruF/`: build/141 tests/bot pass.
Impeccable informed bounded typography, standard buttons and stacked layout.
Self-review prefers readability; keyboard/controller menu navigation still needs
repair because controlsScreen disables Nav for the entire screen, not just capture.

Completed input-safety iteration: occupied gameplay bindings now swap instead of
silently unbinding another action; menu confirmation/back cannot be stolen.
Settings help uses actual bindings. Four unit cases cover swapping, reserved keys,
free/same keys and reset. Build/141 tests/bot gates pass:
`.gaming/runs/1788708392096-NJb0i1/`. Remapped browser flow passes:
`.gaming/playtests/1788708404722-kehkjo/` (Controls swap, Enter protection, Escape
cancel, reload, help labels, actual pass/receive/shoot with swapped keys).
Controls capture inspected. Self-review prefers retained controls/accessibility;
Controls layout remains cramped, and gamepad/full-run/hardware evidence is open.

Completed visual iteration: bounded result/league layouts, opaque dark broadcast
backdrop, readable prose separate from actual scores, smaller unskewed actions,
responsive tables and scroll access. Baseline
`.gaming/result-layout/1788707781676-7ySsWP/` found clipped actions in six of
eight cases. Candidate `.gaming/result-layout/1788707860332-S4bygF/` passes all
eight desktop/narrow/125%-text cases. Desktop league and narrow large-text
league/summary captures inspected against baseline. Build/137 tests/bot gates:
`.gaming/runs/1788707847426-FJ6tHB/`. Impeccable guided bounded typography,
neutral backdrop and restrained action hierarchy. Self-review prefers readability
for first-session/accessibility users; gameplay unchanged. Next: match-result
table at narrow sizes, remapping/gamepad, and full-run/hardware evidence.

Completed iteration: championship routing evidence. Prepare last-boss checkpoint
and terminal outcomes, then use real UI to verify boss loot before league offer,
offer reload, bank versus Act 4 extension, saved league resumption and championship
settlement after league loss. No gameplay tuning. Acceptance requires saved state
and rendered UI evidence for both branches, not a claim of three-act human play.
`.gaming/championship/1788707458721-sj07JL/` passes both branches; offer and
Act 4 loss/champion summary captures inspected. Baseline
`.gaming/runs/1788707379630-yPuaDB/`; final
`.gaming/runs/1788707619491-N8bTra/` passes build/137 tests/bot gates.
No game-code changes. Self-review: confirmed roguelite routing, but summary copy
is excessively wide and small supporting text has weak contrast. Next: result /
league screen readability at desktop, narrow viewport and larger text.

Completed iteration: retain ended runs until settlement. App previously deleted the
save at the loss result screen, before runOver credited meta cash. Preserve ended
save/Continue routing, record settlement receipts with meta, and clear the save
only after successful payout persistence. Acceptance: browser reload before summary,
failed meta write/retry, and stale ended-save recovery without duplicate cash,
feats or records. Preserve existing payout formulas and normal run behavior.
Baseline `.gaming/runs/1788707033327-V2Q2Fn/`; final
`.gaming/runs/1788707264175-muMw5D/` passes build, 137 tests and bot gates.
`.gaming/endings/1788707276471-IdZKa0/` passes loss reload, failed meta write/retry
and stale-save idempotency. Summary payout capture inspected in first candidate
`.gaming/endings/1788707165189-kIsV9P/`. Self-review prefers retained earnings;
full-run play and banking/league branches still require evidence.

Completed iteration: skills-node rewards share durable pending drafts and once-only
claims. Preserve the existing zero-cash skills skip policy after reload. Verify
Shootout/Hit Parade unit cases and real shootout result/reload/claim UI using a
prepared node and terminal-win fixture. Full-run completion remains unverified.
Baseline `.gaming/runs/1788706788043-3cuXhj/`; final
`.gaming/runs/1788706863930-tCCxhq/` passes build, 137 tests and bot gates.
`.gaming/rewards/1788706874800-J0EsKl/` passes shootout reward pick and skip
after result/draft reloads, stable choices, telemetry and zero-cash skip.
Resumed draft inspected. Self-review prefers reward integrity; human skills play
and full-run routing remain unproven. Next: complete-act/run-over/league routing.

Completed iteration: durable post-match rewards. Source inspection found wins
advance/save the map before draft choices exist in the save, so reload can skip
earned loot. Persist pending choices before showing results; route Continue to
the pending draft before level-ups/league/map. Claim/skip must resolve once,
preserve choices/RNG on reload, and avoid recounting offer telemetry. Verify
unit persistence tests and browser result/draft reload for pick and skip.
Final `.gaming/runs/1788706637028-1ElBlU/` passes build/135 tests/bot gates;
`.gaming/rewards/1788706647393-2Sr4uZ/` passes both browser paths including
once-only telemetry. Resumed draft capture inspected. Self-review: prefer-after
for roguelite reward integrity; no claim of full-run victory or accessibility.
Next: skills-node rewards and complete-act/run routing, then accessibility.

Exercise title, quick match, new run, progression, pause/settings and reduced motion.
Fix issues found; inspect final graphics and evaluate the relevant player
perspectives with concrete evidence. Track remaining hardware-only validation
honestly. Passing narrow automation alone does not complete the overall goal.
