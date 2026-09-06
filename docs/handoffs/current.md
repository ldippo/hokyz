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

Latest UI pass: src/ui/screens/match.ts wraps match box score in labelled focusable
match-stats region. Arrow keys stop propagation to gameplay input and scroll
natively; CSS preserves460px table/name widths and whole headers, adds narrow
scroll hint. Baseline at390/150% fit but fragmented SOG/HITS/BIG labels; skills
cards already fit and were left alone. Impeccable guided readable tabular content.
New result-probe.mjs shared by rewards.mjs/hit-parade-full.mjs --layout
--assert-layout checks desktop720,390x844,390x844/150% all actions/cells and page
overflow; also keyboard scroll and nowrap headers when match region overflows.
Baselines .gaming/rewards/1788710708232-xLvk3L/ and
.gaming/hit-parade-full/1788710706937-XQXRV0/ inspected. Final
.gaming/rewards/1788710827030-56FDCK/ and
.gaming/hit-parade-full/1788710828274-iwAQzu/ pass layout/reward/full-challenge
checks. Final narrow match screenshot inspected. Build/147 tests/bot gates
.gaming/runs/1788710803701-HycEyF/ pass. Self-review prefers readable labels;
horizontal scrolling is an explicit tradeoff, not simultaneous visibility of
all columns. Controller table scrolling and physical hardware remain unverified.
Next precise action: evaluate broader run progression across successive actual
nodes, including noncombat choices and act advancement, not only terminal
fixtures. Keep human game feel/hardware as open evidence gaps; full goal active.

Latest evidence: scripts/harness/hit-parade-full.mjs exercises idle and chase
through 60 actual simulated seconds with DOM key events (WASD/Shift/K), nearest
standing dummy pursuit and natural timer expiry. Only reachable node is prepared;
no scores/hits/terminal outcomes injected. Idle0/8, pursuit41/8 in two runs.
Requires idle loss/no reward, pursuit victory/+60cash/pending draft/skip no extra
cash. Final .gaming/hit-parade-full/1788710587394-xEcwfX/ passes; first reward
capture .gaming/hit-parade-full/1788710509062-sMyivE/chase-result.png inspected.
Build/147 tests/bot .gaming/runs/1788710525593-Cgz9HN/ pass. No game code changed.
Self-review confirms connected challenge flow, not human difficulty/fun: perfect
nearest-target tracking is not representative input, so no thresholds tuned.
Next precise action: reuse natural skills result and a prepared match result to
check all cards/table columns/actions at390px/150% text and desktop, fix evidenced
layout issues. Then broader full-run progression and physical hardware checks.

Latest gameplay change: src/sim/hitParade.ts HitParadeDummies owns seeded wander/
turbo inputs, preserving prior ranges/probability and boundary return. It ignores
duplicate/nonadvancing timestamps. skills.ts derives its seed from matchSeed,
commits run RNG after consuming matchSeed, and no longer uses Math.random for
dummy behavior. Four new tests in tests/sim/hitParade.test.ts: full60s input trace
without global RNG, pause/no-RNG-consumption, seed variation/boundaries, and full
MatchSim movement/nonzero hit-score replay across pause. A nullable controlledId
typing error in that fixture was repaired; failed run
.gaming/runs/1788710308211-JZr1nN/ preserved. Final
.gaming/runs/1788710370603-dMhVS1/ passes build/147 tests/bot. Browser pause/end
regression .gaming/hit-parade/1788710347654-meIvzn/ passes. No new rendering edits.
Self-review prefers repeatability; headless scripted play doesn't establish human
challenge difficulty/fun. Next precise action: exercise full60s Hit Parade with
actual movement/check inputs and natural timer expiry, inspect earned rewards/
loss results. Then resume broader full-run/hardware/result-layout validation.

Latest gameplay fix: src/ui/screens/skills.ts Hit Parade now pauses on P/Escape
instead of finishing. Pause reuses existing menu with Resume/End challenge and
score/time; finish clears pause/screen. lastTick gate prevents previous hit events
being counted twice when Nav resumes after a skipped sim tick. Timer derives from
actual sim advancement. Gates .gaming/runs/1788709992132-oxjbOB/ pass build/143
tests/bot. New scripts/harness/hit-parade.mjs prepares reachable node and one big
hit on pause tick, runs production simStep/input, asserts frozen state/save/cash,
300paused ticks don't consume timer, resume doesn't duplicate hit, P/Escape work,
explicit end settles2/8 with no unearned cash. Final
.gaming/hit-parade/1788710099180-EMQPCu/ passes; prior pause screenshot inspected
.gaming/hit-parade/1788710070619-zqiDL3/paused.png. Self-review prefers interruption
safety; not evidence of human challenge victory or narrow layout accessibility.
Next precise action: move Hit Parade dummy steering away from Math.random to a
seeded simulation-independent controller, verify repeated seed/input yields same
movement/score and pause doesn't consume RNG; then actual challenge difficulty,
result layouts and full-run/hardware. Unrelated README/roadmap remain untouched.

Latest crowd fix: waveActive uniform starts0, startWave sets1/reset phase, end
sets0. Shader multiplies wave lift by active; previous sentinel -10 could not
disable a periodic sine. Added tests/sim/crowd.test.ts lifecycle/restart and
animation-disabled material tests. Gates .gaming/runs/1788709703768-0nP8H0/
pass build/143 tests/bot. Capture --arena --low --crowd-motion records three
stages, asserts motion meshes3 and active0/1/0. Initial fixture incorrectly set
rig.overrides without applying; .gaming/captures/1788709621323-IXbCd7/ was STATIC,
not valid animated baseline. Assertion caught same issue in candidate
.gaming/captures/1788709722060-XMGpu9/. Repaired helper sets rig.settings.crowdAnim
before constructing fixture. Final .gaming/captures/1788709803139-wBFPvJ/ passes;
wave and settled screenshots inspected with visible return to idle. Self-review
prefers bounded celebration; no hardware/high-tier quality claim. Forced animation
is test-only; reduced-motion disabling remains unit-tested and untouched.
Next precise action: src/ui/screens/skills.ts Hit Parade onTick calls finish() on
pause, ending the challenge. Implement real pause/resume with an explicit abandon
choice; verify clock/score/state freeze and resume, and deterministic dummy input
(currently Math.random). Keep skills rewards/save integrity. Full-run/hardware
and match/skills narrow results remain open.

Latest graphics pass: src/render/crowd.ts replaces box bodies with rounded
torso/limbs, bent seated legs, shoes, neck/head/hair and separated skin/apparel/
trouser colors. Custom colorNode mixes vertex fanColor with per-instance muted
apparel through a mask, retaining three instanced meshes. No simulation edits.
First build failed generic TSL type inference; explicit vec3 repaired it.
Final gates .gaming/runs/1788709308602-dEBySB/ pass build/141 tests/bot.
High-quality baseline .gaming/captures/1788709090435-Yefhkc/ timed out on software
renderer screenshot. Low before .gaming/captures/1788709240924-js6IQ3/ and after
.gaming/captures/1788709325766-P0iDN1/ were inspected: rounded spectators,
separate colors and reduced crowd distraction. These are matching quality/
viewport/scenario, NOT frame-identical: first helper did not reset attract due
its early return. Fixed helper calls disposeView before attract; final seeded
360-step capture .gaming/captures/1788709438559-xA8rJC/ passes and inspected.
Command pnpm harness:capture --arena --low (high default without --low).
Self-review prefers crowd readability; no high-tier/animated-crowd or hardware
performance claim. More geometry keeps three draw calls but may add GPU cost.
Next precise action: verify animated crowd shader and reduced-motion behavior;
source wave uniform starts at zero and sine lift seems active even without a
goal, so inspect that contract before tuning. Full-run/hardware, match/skills
narrow result layouts remain open. Preserve unrelated README/roadmap edits.

Latest P3 evidence: playtest.mjs --gamepad drives existing fixed-step match
fixtures via synthetic standard pad and production polling. Checks analog
movement/right-stick aim, pass->moving receiver->control switch->shot, far aim
while moving near, and Start pause/resume. Additional contract snapshots cover
dead zone, magnitude, turbo/deke/special edge/hold and disconnect release in
gamepad-input.json. Final .gaming/playtests/1788708953817-5FESBe/ passes;
keyboard regression .gaming/playtests/1788708955188-Z2OeTW/ passes. Gates
.gaming/runs/1788708913724-eFPNGj/ (build/141 tests/bot pass). No game-code edits.
Self-review supports controller mapping, not real hardware or human game feel.
Inspected first controller capture .gaming/playtests/1788708899057-SCREBB/
human-pass-received.png: smoother players are readable, but bright blocky crowd
draws attention from ice. Next precise action: inspect a high-quality live arena
capture and crowd implementation, improve evidenced visual noise/detail while
preserving player/puck readability and performance. Match/skills narrow results,
full-run play and physical hardware remain open; full goal is not complete.

Latest P3 functional fix: Controls now enables Nav, stores selected row across
render/capture, resets focus to Reset after reset, and handles back as cancel
while capturing versus exit while idle. Nav.update ignores navigation during
capture but permits controller B/back cancellation. Keyboard capture owns keys.
Expanded controls-layout.mjs proves keyboard down->rebind Q->retained focus->
Escape cancel->new Q down navigation->reset->Escape back; synthetic standard
gamepad D-pad/A capture, ignored D-pad during capture, B cancel and B exit.
Evidence .gaming/controls-layout/1788708779263-OFpAwU/ passes these plus all
layout cases. Gates .gaming/runs/1788708741933-urIPCz/ pass build/141 tests/bot.
Self-review prefers mouse-free accessibility; no physical controller claim.
Remapped real-keyboard match regression passes:
.gaming/playtests/1788708792247-9OQQGq/ (reload, pass/receive/switch/shot).
Next: explicit narrow/large-text match and skills result variants; then broader
gamepad on-ice behavior and sustained full-run gameplay evidence. Do not equate
terminal fixtures or software-renderer automation with human game feel.

Latest P3 visual pass: Controls uses scoped controls-screen/bindings-list styles,
640px maximum width, body labels/buttons, dark backdrop, 44px minimum actions,
stacked rows at narrow widths and full-width Reset/Back. No simulation changes.
Baseline gates .gaming/runs/1788708511158-v8FEVr/; final
.gaming/runs/1788708608986-GMoruF/ (build/141 tests/bot pass).
New controls-layout.mjs baseline .gaming/controls-layout/1788708545165-I5BgRw/
shows narrow reset and 150% labels clipped. Final
.gaming/controls-layout/1788708623724-DUAwYk/ passes desktop720/narrow844/
narrow150%, including all keys/labels/actions/overflow and Reset/Back interaction.
Desktop and narrow150% captures inspected. Impeccable informed hierarchy, standard
buttons and stacked layout. Self-review prefers accessibility readability.
Remap/reload/pass/receive/shot regression also passes:
.gaming/playtests/1788708625009-2Sdimn/.
Next precise action: Controls currently calls showScreen(el,false) for the whole
screen, so keyboard/gamepad menu navigation is disabled even outside capture.
Restore navigation while idle, suspend only during capture, preserve selection,
and verify keyboard entry/rebinding/cancel/reset/back without a mouse. Then test
match/skills result layouts and gamepad/hardware/full-run behavior.

Latest P3 fix: safe remapping in src/core/input.ts swaps occupied gameplay keys,
rejects stealing confirm/back, and clears held keyboard actions after a change.
Controls explains swaps/reserved keys and handles rejection; Settings help renders
current bindings instead of default literals. tests/sim/keymap.test.ts adds four
cases. scripts/harness/playtest.mjs --remap checks actual Controls UI swap, Enter
rejection, Escape cancel, reload persistence and Settings labels before reusing
pass/receive/shot fixtures with K pass/J shoot. Final gates:
.gaming/runs/1788708392096-NJb0i1/ (build,141 tests,botplay pass); remapped browser:
.gaming/playtests/1788708404722-kehkjo/ passes. Remapped-controls screenshot
and default-key regression .gaming/playtests/1788708425127-QtDWcU/ pass.
The remapped-controls screenshot was
inspected: bindings visible, but narrow label column and oversized buttons remain
cramped; this iteration does not claim layout quality. Self-review prefers safe
remapping for accessibility/first-session users; abstain on hardware/gamepad feel.
Next precise action: improve Controls layout and verify narrow/large-text access
including reset/back, then match/skills result variants and gamepad coverage.
Unrelated README.md and docs/ROADMAP-v4.md edits remain intentionally unstaged.

Latest visual pass: src/ui/styles.css bounds result content to 860px/actions to
440px, allows screen scroll, strengthens dark background/contrast, uses readable
body type/actions and responsive tables. League/runOver explanatory copy now uses
result-description rather than oversized score-line. Impeccable product-register
guidance informed typography/contrast. New result-layout.mjs exercises 8 cases:
league/summary x desktop normal, desktop125%, narrow normal, narrow125%. Baseline
.gaming/result-layout/1788707781676-7ySsWP/ had clipped actions in 6/8 cases;
candidate .gaming/result-layout/1788707860332-S4bygF/ passes all. Inspected desktop
league, narrow125% league/summary against baseline; text and values now fit.
Build/137 tests/bot gates passed .gaming/runs/1788707847426-FJ6tHB/.
Self-review prefers readable results/accessibility. No gameplay changes. Shared
result styles also apply to match and skills results; those table/card variants
need explicit narrow-size evidence next. A long feat toast can show faintly under
summary content in this stopped-loop fixture; toast presentation merits follow-up.
Next: inspect match/skills result narrow layouts and actual Settings text-size /
remapping flows, then gamepad and target-hardware/full-run evidence.

Latest P3 validation: added node scripts/harness/championship.mjs. Starts a real
new run, prepares last-boss checkpoint, supplies terminal outcomes, then uses real
reward/league/save/reload/summary UI. Checks boss draft (four offers) before league
choice, reload of that choice, Bank -> champion settlement, and Extend -> Act 4
map -> Save & Quit -> reload -> loss -> champion settlement. Both branches verify
one meta win and no active save after settlement. Evidence:
.gaming/championship/1788707458721-sj07JL/ passes both; offer and Act 4 champion
summary screenshots inspected. Baseline .gaming/runs/1788707379630-yPuaDB/;
final .gaming/runs/1788707619491-N8bTra/ passes build, 137 tests and bot gates.
No game-code changes; not proof of playing previous acts. Self-review confirms
routing but identifies excessively wide summary copy and low-contrast small
supporting text. Next precise action: improve result/league screens' bounded
layout and readability, verify desktop/narrow/larger-text captures, then remapping
and gamepad flows. Actual full-run/human feel/hardware performance remain open.

Latest P3 fix: App saves/loads ended runs until summary settlement instead of
deleting them at the loss result screen. runOver records a receipt keyed by saved
seed/goalie/captain roster IDs in meta, skips already-settled rewards/records/feats,
and clears the ended save only after saveMeta succeeds. saveMeta now returns a
success boolean (existing callers may ignore it); a failed summary save leaves
the run intact and prompts retry/reload. No payout formula changes.
Baseline .gaming/runs/1788707033327-V2Q2Fn/; final
.gaming/runs/1788707264175-muMw5D/ passes build, 137 tests, bot gates.
New command node scripts/harness/endings.mjs uses terminal loss fixture and real
UI: loss-result reload, Continue settlement, injected quota failure/retry, stale
ended save after payout. Final .gaming/endings/1788707276471-IdZKa0/ passes all.
First candidate recovered summary screenshot inspected:
.gaming/endings/1788707165189-kIsV9P/recovered-run-over.png (payout visible).
Self-review prefers retained rewards/idempotency; this is not full-run evidence.
Next precise action: exercise act-3 pending draft -> league offer -> bank versus
extend -> save/reload -> league loss, verifying champion/act/settlement state;
then full progression and larger-text/remapping accessibility.

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
