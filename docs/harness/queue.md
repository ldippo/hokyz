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
