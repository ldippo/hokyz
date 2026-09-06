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

## P3: Full-game polish and validation (ready, depends on P1 and P2)

Exercise title, quick match, new run, progression, pause/settings and reduced motion.
Fix issues found; inspect final graphics and evaluate the relevant player
perspectives with concrete evidence. Track remaining hardware-only validation
honestly. Passing narrow automation alone does not complete the overall goal.
