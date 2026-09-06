# Current handoff

Active goal: polish graphics and gameplay using the new harness. The full goal
remains active. No timed burst requested. Queue: docs/harness/queue.md.

## Completed

- Restored 12 zero-byte source/test files from intact Git index blobs: core/save;
  run/feats, mapGen, meta, runState; screens/league, records, rest, runMap, runOver;
  tests/run/endgame and run. Nonempty files preserved; four core hashes verified.
- Responsive title menu (1280x720 and 390x844), accessible button names.
- Baked ice detail, open mesh nets, higher-contrast player tags and HUD panels.
  Roof/jumbotron now hidden from gameplay camera after a screenshot revealed
  major center-ice occlusion. Low cinematic views retain overhead structures.
- Fixed shooting from movement instead of dedicated aim. AI explicitly supplies
  its previous aim, preserving balance. Two regression tests failed before fix.
- Fixed gameplay shortcuts eating letters in team/seed input fields.
- Fixed match startup overriding reduced-motion shake suppression.
- Settings now scrolls: browser testing found Back unreachable below the viewport.
- Added pnpm harness:playtest for actual keyboard typing/navigation, captain
  selection, save/continue, Settings/reduced motion, fixed-step movement/aim
  fixtures and pause/resume. It captures screenshots and failure state.

## Verified evidence

- Restored baseline: .gaming/runs/1788701296498-RbWjap/ (111 tests, all gates);
  .gaming/captures/1788701315813-ngmk9H/ (fresh build).
- Title/ice/net pass: .gaming/captures/1788701950788-2BVdYd/, inspected.
- .gaming/runs/1788702538736-R6y25J/: build, 113 tests and eight hockey matches
  pass; mean goals unchanged at 8.75. Bounds were not weakened.
- .gaming/playtests/1788702543830-zPTfA0/: keyboard, typing, captain, save/continue,
  movement/aim fixtures and pause/resume pass. Screenshot inspected: roof no
  longer occludes play and HUD/labels are readable.
- Final gates: .gaming/runs/1788702644703-RmEU89/ passed build, 113 tests and botplay.
  .gaming/playtests/1788702650829-2GNXpz/ passed the expanded browser flow, including
  actual Settings-to-match reduced-motion navigation after fixing Settings overflow.
- git diff --check passes. Harness, UI/gameplay and character models were pushed
  to main in 02842c4, 1379ac8 and 5181b69 with explicit user authorization.

## Next

Latest P3 fix: skills finishSkills now prepares/saves pending draft before showing
inline result cards, and claim/skip uses once-only resolution. Shared draftSkipCash
preserves skills' zero-cash skip policy on both inline and reload screens; match
drafts still grant +25. Two new unit cases cover Shootout and Hit Parade save/
reload/skip. `node scripts/harness/rewards.mjs --skills` prepares a reachable
shootout and terminal win, then exercises real result/reload/Continue/pick and skip.
Baseline .gaming/runs/1788706788043-3cuXhj/; final
.gaming/runs/1788706863930-tCCxhq/ passes build, 137 tests and hockey gates.
.gaming/rewards/1788706874800-J0EsKl/ passes both browser paths with identical
choices, stable telemetry and correct persisted claims. Resumed draft inspected:
all choices visible and Skip perk has no cash bonus. Self-review prefers recovery
integrity; no claim of human skills victory or a complete run. Next precise action:
exercise complete-act, act-3 league offer/bank, loss/run-over and save/reload routing;
then larger-text/remapping/gamepad paths. Source inspection also found Hit Parade
uses Math.random for scripted movement; deterministic challenge behavior needs a
later focused check, not an unreviewed change in this reward chunk.

Latest P3 fix: earned match drafts now persist before the result screen. Added
optional pendingDraft, prepareDraft/claimDraft in runState; match callback prepares
reward after advancing node, before save; runMap routes pending reward before
level-ups or league offer; draftScreen reuses choices and resolves pick/skip once.
Offer telemetry is counted once across reloads. Old saves remain loadable.
Three tests in tests/run/draftResume.test.ts cover stable choices/RNG, once-only
claims and skip cash, invalid picks and legacy no-pending saves. Browser command:
node scripts/harness/rewards.mjs uses a terminal-win fixture then real result /
reload / Continue / draft / reload / pick-or-skip interactions. No fabricated
claim of human victory or full-run completion.
Baseline .gaming/runs/1788706390294-HYk76Z/; final build/135 tests/bot gates:
.gaming/runs/1788706637028-1ElBlU/. Final browser reward recovery:
.gaming/rewards/1788706647393-2Sr4uZ/ passes both paths, including stable offer
telemetry. Resumed draft screenshot inspected; choices and Skip visible.
Self-review prefers preserved earned rewards for roguelite/first-session players.
Next precise action: inspect skills-node reward persistence (it has a separate
inline draft), then complete-act/run-over routing and larger-text/remapping.

Latest validation chunk: scripts/harness/playtest.mjs now exercises real keyboard
pass release, natural moving-AI pickup, automatic control switch and a follow-up
shot in a continuous fixed-step sequence. Only the initial open-ice state is
prepared; no possession injection after release. Passing evidence:
.gaming/playtests/1788706278835-21ERT2/; human-passing.json records H1 -> H2,
H2 ownership/control and H2 shot. Inspected human-pass-received.png confirms
control ring and HUD identify H2. Full baseline build/132 tests/bot gates pass:
.gaming/runs/1788706220798-dKMKJY/. No game-code changes in this chunk.
Self-review: first-session control-flow evidence improved, real-time feel not
proven. Next precise action: inspect/run complete roguelite progression through
match outcome, reward, next node, save/reload and run-over, then larger-text,
remapping and gamepad paths. Proceed to P3 validation rather than more isolated
AI tuning until sustained human play supplies additional evidence.

Latest P2 iteration: added `receive` role in teamAI/skaterAI. Intended receiver
meets the puck trajectory near their position; passer/third skater retain support
instead of chasing. Four tests cover receiver assignment/steering and fallback
for knocked receiver, expired pass or shot. Baseline:
.gaming/runs/1788706012059-0wqvUk/. First candidate:
.gaming/runs/1788706070156-aBTMT6/ failed one boss roster test because a legal
goalie pull added a fifth attacker. Focused repair in tests/run/depth.test.ts
asserts exact starting skaters plus extra1, excluding original goalie. Final:
.gaming/runs/1788706128182-2IW4bQ/ passes build, 132 tests and bot gates;
.gaming/playtests/1788706140087-ADmTHc/ passes browser flow. Completion improves
35.6% -> 46.1%; attempts 1059 -> 1040; completions 377 -> 479; interceptions
569 -> 509; goals 6.25 -> 6.375. Extra 40-game diagnostics in first candidate's
extended-balance.log: means 6.1/6.6/7.9/7.9 goals, zero own goals, no cap reached.
Self-review prefers actual reception improvement; real-time human feel unproven.
Next precise action: exercise real keyboard passing, sustained receiver movement,
automatic control switch on reception and subsequent shot in browser fixtures;
then move to full-run progression and accessibility checks (P3).

Latest P2 gameplay iteration: AI now checks `laneBlocked` and `pickPassTarget`
before pressured/outlet passes, skips knocked-down recipients, and keeps skating
when no lane is available. Changes: src/sim/ai/skaterAI.ts and two new cases in
tests/sim/support.test.ts. Each case samples 100 seeds: old logic made 14 blocked
outlet passes / 34 pressured passes; new logic makes none, but passes when an
outlet opens. Baseline .gaming/runs/1788705854469-WsImZH/; candidate
.gaming/runs/1788705904359-XYPt7T/ passes build, 128 tests and eight bot gates.
Completion 33.5% -> 35.6%, interceptions 55.7% -> 53.7%, attempts 1381 -> 1059,
goals 7.625 -> 6.25. Extended 40-match diagnostic is extended-balance.log in that
candidate directory (difficulty means 4.7/7.3/6.4/7.8 goals; max duration below
tick cap). Browser playtest .gaming/playtests/1788705916742-yAcgQ0/ passed.
Self-review prefers lane-aware choices; modest aggregate improvement, not proof
of fantastic game feel. No visual or human input changes. Next: inspect whether
intended pass receivers abandon their receiving lane while the puck is in flight;
add sustained human pass/receive evidence before further tuning.

Latest P2 evidence iteration: added `scripts/harness/possession.ts`, integrated
in botplay, and seven tests in `tests/sim/possessionMetrics.test.ts`. Read-only
end-of-tick ownership plus immediate pass/shot events; distinguishes intended
completion, same-team recovery, interception and unresolved-at-stoppage outcomes.
Baseline `.gaming/runs/1788705678149-2HeKMA/`; final
`.gaming/runs/1788705761716-bDK6Sz/` passes build, 126 tests and all bot gates.
All original match fields exactly match baseline; repeated instrumentation run
`.gaming/botplay/1788705715966.json` yields identical metrics. 1,381 attempts,
462 completions, 141 recoveries, 769 interceptions, nine unresolved. Live play
34.4% loose puck. No gameplay or visual changes, no new balance thresholds.
Self-review: useful arcade-veteran diagnostic evidence, not proof of human feel.
Next precise action: reproduce AI choosing blocked passing lanes (pressured and
outlet branches), inspect intended receiver movement, then compare candidates
against this completion/interception baseline and existing hockey bounds.

Latest resumed P2 iteration: fixed breakout outlets converging on the same wing.
`src/sim/ai/skaterAI.ts` derives both support lanes from the carrier's side;
`tests/sim/support.test.ts` covers six cases (both attack directions, three carrier
positions), including teammates crossing the carrier without changing targets.
All six failed before the fix, pass afterward. Baseline:
.gaming/runs/1788705059826-yhxxwh/. Candidate:
.gaming/runs/1788705129993-HN6e1o/ (build, 119 tests, eight bot matches).
Mean goals 8.75 -> 7.625; total shots 451 -> 404; hits 853 -> 780; own goals
unchanged at two. Existing bounds unchanged. Browser flow:
.gaming/playtests/1788705136939-8MsoSl/ passed. No rendering/input changes.
Self-review prefers distinct passing options; sustained human feel and broader
balance remain unproven. Next precise action: add sustained pass completion /
possession evidence before further AI tuning, then proceed to P3 checks.

Latest explicit request: improve hockey players without a low-poly art style.
Implemented rounded tailored jerseys/limbs, facial features, curved visors,
helmet vents/straps, segmented gloves, skate details and goalie pad seams in
assets/src/build_skater.py; regenerated both public GLBs with the same 21 bones.
Visual self-review fixed elbow gaps, obscured eyes and an existing detached stick
blade (baked blade coordinates now join the shaft). Models remain stylized,
not photorealistic. About 92k/98k triangles and 3.2/3.3 MB per asset; target-device
frame rate and future LOD remain unverified.

Model evidence: .gaming/models/1788704049959-VakX35/ contains before comparisons;
final .gaming/models/1788704198320-UuEwjT/ skater, goalie and five-pose captures
were inspected. Build passed after final export. Harness build/tests/botplay:
.gaming/runs/1788704036275-o2faif/. Browser gameplay checks passed with the new
models before the final blade-only geometry correction:
.gaming/playtests/1788704150019-obzb57/.
Repeat captures with `node scripts/harness/models.mjs` after building;
`--compare` additionally requires the local .gaming/models-before/ backups.
The viewer supports `capture=1` to settle poses without a real-time render loop.

P2 remains in progress: sustained passing/possession and teammate-support play.
P3 remains: complete-run progression, larger text, remapping/gamepad interactions,
higher-quality graphics and target-hardware frame rate. Current browser evidence
uses software WebGL/Low with fixed-step fixtures; it does not establish real-time
game feel or a complete run. Do not claim the full goal achieved from these checks.

Review is self-review. First-session and accessibility perspectives favor the
visible menu, readable HUD, working aim and text entry. Arcade veteran / roguelite
overall approval needs sustained play and progression evidence.

Git repaired with user approval: restored the exact missing HEAD object from a
verified mirror of origin, without changing refs or working files. `git fsck
--full` succeeds (one harmless dangling commit). Recovery backup:
/tmp/hokyz-git-recovery-DyR5Xc/ contains original Git metadata and a worktree archive
excluding generated/dependency directories. README and v4 roadmap had pre-existing
deletions; leave them uncommitted. User now authorizes committing and pushing
verified incremental work to main for testing. Do not force-push.
