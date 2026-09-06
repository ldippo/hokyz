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

Latest HUD polish: hud-feedback stacks compact announcement/countdown below
scoreboard.32px main/16px sub/48px countdown, dark broadcast backing, wrapped
copy, restrained entry motion;1.6s timing and reduced-motion expiry unchanged.
Impeccable informed hierarchy/contrast; arcade palette preserved. Before image
.gaming/map-focus/1788715904975-5Tl4vr/outnumbered-match.png; after
1788716050612-G3q9aV/ and final1788716097171-d172hT/ inspected. Center players
and puck unobscured. Final --motion/--feedback-layout passes opening geometry,
app/OS reduced-motion restoration, long boss copy desktop/narrow150% reachability.
Long-copy case uses Hud.announce fixture, not natural boss trigger. Gates
.gaming/runs/1788716044167-HSywew build/157 tests/bot pass. Self-review prefers
clear ice and readable feedback, abstains on human feel. Narrow capture still
shows existing clipped scoreboard/bottom HUD; do not claim whole-HUD responsive.
Next precise action: fourth Outnumbered skater appears absent visually despite
sim roster4. MatchView builds meshes only in constructor; inspect synchronization
after bossPhase adds skater, assert actual mesh map/scene entry and capture it.
Preserve unrelated README/ROADMAP edits. Full goal active.

Latest harness-only fix: blank opening image was pending viewport resize clearing
canvas after render. map-focus now waits two animation frames after desktop
resize, before stopped-loop drawing. .gaming/map-focus/1788715848516-EQLNDe/
and final1788715904975-5Tl4vr/ show rink; both inspected. Screenshot bright-ice
region check added (880x160 at200,400; >15% pixels RGB>150), old blank image0,
corrected89.7%. Numerical opening checks still3v4/min1.8m. No game/render edits.
Gates .gaming/runs/1788715855028-AKH0RA/ build/157 tests/bot pass. Self-review
prefers trustworthy visual evidence, not a broad graphics-quality endorsement.
Next precise action: reduce oversized HUD announcements/countdown obscuring
center ice; PERIOD1 and countdown currently overlap players at opening. Read
Impeccable before UI edits, inspect same live event before/after, preserve timed
feedback, reduced-motion and scoreboard visibility. Full goal remains active.

Latest: fixed overlapping extra skaters at faceoffs in src/sim/rules.ts. Existing
center/two wings unchanged; additional pair uses rear row3m deeper, y±2.25.
tests/sim/faceoff.test.ts checks3/4/5 players both directions/all five dots,
pair clearance and rink bounds. Initial fixture accidentally truncated to3 in
MatchSim constructor; corrected explicit additions/count assertions yielded two
red tests (distance0), then passed. Baseline .gaming/runs/1788715622965-zdDqNl/;
final .gaming/runs/1788715709528-qhFxsJ/ build/157 tests/bot pass; eight seeded
match reports exactly unchanged. Browser map-focus now stops at actual opening
faceoff and records/asserts positions: baseline1788715677184-hIucOx min0, final
1788715727249-MXCfhO min1.8 under .gaming/map-focus/. Intro/nav/3v4 checks pass.
Both screenshots inspected: ice blank behind HUD.90 render-only updates also
blank, removed unnecessary loop; numerical evidence valid, no visual approval.
Self-review prefers non-overlapping formations; human feel remains unverified.
Next precise action: diagnose blank opening capture in stopped-loop map-focus
versus normal live/render capture, without assuming renderer failure from this
fixture. Preserve unrelated README/ROADMAP edits; full goal remains active.

Latest gameplay fix: Outnumbered now actually dresses fourth opponent inperiod1.
runState.buildMatch appends boss phases instead of erasing mutator phases, and
creates extraSkater outside boss-only branch when any phase needs it. MatchSim
applies initial phases before opening setupFaceoff (previously only on later
periods). tests/run/depth.test.ts adds elite/boss real-build integration cases:
missing fourth/missing mutator failed before, now4 opponents at300ticks with
original goalie, and later phase application cannot duplicate extra. Red-stage
.gaming/runs/1788715226640-7efzfQ/ failed those two new tests, build/bot passed;
final .gaming/runs/1788715268066-4XehhI/ build/154 tests/bot pass, eight bot match
reports exactly unchanged (mean6.375). Browser map-focus --intro-layout
--elite-intro/--boss-intro --outnumbered passes actual start andperiod1 home3/away4:
.gaming/map-focus/1788715300730-grsrA0/ elite and1788715335370-7nc6BB boss.
Boss desktop outnumbered-match.png inspected; no outcome/clock injection.
Self-review prefers encounter truthfulness, abstains on broader balance/human feel.
Next precise action: setupFaceoff in rules.ts places winger0 onone side and every
other winger onthe same offset. Four-skater teams therefore start two attackers
overlapping. Reproduce actual Outnumbered opening faceoff positions, fix spacing
for both attack directions without changing ordinary three-skater arrangements,
and verify subsequent faceoffs/goalie pulls as appropriate. Preserve unrelated
README.md/ROADMAP-v4.md edits. Full goal remains active.

Latest evidence: map-focus --intro-layout --boss-intro / --elite-intro prepares
boss_maidens, grudge beaten2, ascension5 and long_bombs on reachable nodes after
normal map-focus checks. Asserts taunt/modifier text and>=2 boss phase cards,
all those boxes plus actions reachable at1280x720/390x844/150%; keyboard back/
re-entry and pad Drop the Puck. Boss .gaming/map-focus/1788715098167-WNvzuV/ and
elite .gaming/map-focus/1788715097770-VECDF7/ pass. Boss150% image inspected.
No game edits required. Initial trials1788715045223-OE2y9n/1788715046495-vi9jWI
failed because fixture used invalid maidens instead of boss_maidens; not game bugs.
Gates .gaming/runs/1788715047446-UyrwuE/ build/152 tests/bot pass. Self-review
supports extended intro access, abstains on balance/human play/natural progression.
Next precise action: Outnumbered mutator in mutators.ts pushes an extraSkater
phase for period1, but buildMatch generates mods.extraSkater only within boss
branch, and MatchSim phase code requires that definition. Reproduce an actual
elite+outnumbered buildMatch->MatchSim sequence and assert fourth opponent joins;
existing depth tests manually populate extraSkater and may mask this omission.
Also check boss phase assignment does not erase mutator phases. Fix only confirmed
behavior, compare deterministic gates, preserve unrelated README/ROADMAP edits.

Latest layout fix: matchIntroScreen gets match-intro/content wrapper; scoped CSS
bounds content860px, scrolls overflow, preserves centered desktop, stacks teams
<=700px, uses readable team/gimmick/action text and440px max unskewed buttons.
map-focus --intro-layout measures names/gimmicks/modifiers/actions at1280x720,
390x844 normal/150%, then keyboard Escape/re-entry and synthetic-pad Drop the Puck.
Baseline .gaming/map-focus/1788714840163-Af9nOw/ clips team names/gimmick atnarrow,
both buttons at150%. Final .gaming/map-focus/1788714924438-UXY5kE/ passes; inspected
desktop/narrow150% show complete text and vertically reachable buttons. Same
seeded rival/roster, randomized home name differs. Gates
.gaming/runs/1788714906198-Wqa1Pe/ build/152 tests/bot and input/passing/save/
reduced-motion regression .gaming/playtests/1788714925928-67yvMD/ pass. Baseline
1788714841141-Y3SziR passes. Impeccable guided restrained readable hierarchy and
structural stacking. Self-review prefers accessibility/first-session clarity;
not full human-match feel or all intro variants. Next precise action: exercise
boss phases, grudge taunts and mutator notes at narrow150% with all text/actions
reachable, then actual Back/Start paths. Normal-case evidence does not establish
those larger-copy variants. Preserve unrelated README.md/ROADMAP-v4.md edits.

Latest reduced-motion UI fix: app.applyAccessPrefs sets #ui data-reduced-motion;
styles.css uses inherited animation-name variables for pulse/pop/countdown/flash.
Game preference OR OS reduce stops nonessential pulses/transitions/hover movement.
still-announcement keeps1.6s information lifecycle with opacity only (no scale/
rotation); countdown remains visible, flashes hidden. Existing renderer handling
unchanged. map-focus --motion toggles off/app-only/OS-only/off, mounts temporary
HUD-class fixtures to inspect animation keyframes/opacity then removes them.
Baseline .gaming/map-focus/1788714608773-vOU064/ showed pulse in every mode. Final
.gaming/map-focus/1788714726321-Pe1EZN/ passes pulse/transition suppression and
restoration, announcement opacity1 at400ms/0 at1600ms/no transform frames,
countdown visible/no zoom, status pulses/flash disabled, plus map focus/activation.
Map screenshot inspected; static focus remains clear. Gates
.gaming/runs/1788714710008-Jl3F2M/ build/152 tests/bot pass; baseline
1788714609779-MyTMm6 also passes. Browser input/save/reduced-motion/match/passing
regression .gaming/playtests/1788714727852-kjkYTI/ passes. Impeccable guided
preserving information without motion. Self-review prefers accessibility; fixtures
are CSS behavior evidence, not live human game feel or all renderer motion audit.
Next precise action: capture pre-match introduction (matchup/modifiers/actions)
at390x844/150% and desktop. Verify Back to Map and Drop the Puck reachable through
actual keyboard/controller. Other run-shell/result checks do not cover this screen.
Keep unrelated README.md/ROADMAP-v4.md edits unstaged. Full goal remains active.

Latest visual fix: .node.available.focus now has static outer ring and ▶ marker,
26px scroll margin. No animation added. New map-focus.mjs seeds map-focus-1,
captures initial/keyboard-next/controller-previous/narrow150% and verifies Enter
opens chosen rival. Baseline .gaming/map-focus/1788714361262-oSBXZo/ had no focus
outline/marker; final .gaming/map-focus/1788714445147-y2Cb0w/ passes; desktop and
narrow captures inspected, selected GHOULS unambiguous beside available WIZARDS.
Same map/roster/viewport, randomized home team name differs. Gates
.gaming/runs/1788714425884-ruMo59/ build/152 tests/bot pass; baseline
.gaming/runs/1788714362257-ddUtsW/ passes. Map/rest --layout --nav regression
.gaming/rest/1788714446436-hcG1t0/ passes layouts, keyboard/pad Save/Continue and
training/skip persistence. Impeccable guided static shape cue; self-review prefers
selection clarity, no physical-controller or overall animation-compliance claim.
Next precise action: inspect reduced-motion CSS handling. app.applyQualityPref
uses meta.reducedMotion for renderer, but applyAccessPrefs sets no CSS motion
state, and OS media rule only disables title transitions. Map nodes still pulse
under requested reduced motion. Reproduce both app setting and OS preference,
then ensure nonessential UI pulses/transitions stop while focus stays visible.
Preserve existing render behavior and unrelated README.md/ROADMAP-v4.md edits.

Resolved prior navigation investigation. Probe bug: ArrowDown maps to aimDown,
not Nav down. Corrected run-probe reads movement binding (normallyS), asserts
down edge, retains focus trace. Prior clipping/unchanged-focus claims are not
valid evidence of bad scroll alignment. No centering change shipped.
Corrected baseline .gaming/rest/1788714111297-IzWPke/ rest-keyboard-focus-trace
proves genuine mouseover focus theft: keyboard Save/Quit then scroll-induced
hover jumps to card1, total6/7 visited. Nav now listens to coordinate-changing
mousemove and ignores redundant current selection; original nearest scrolling
retained. Final .gaming/rest/1788714168526-X4ZPlU/ and
.gaming/shop/1788714169827-IVkimd/ pass keyboard/synthetic-pad traversal and
Save/Quit->Continue at150% on map/rest/shop, nine layout cases, and full original
shop/rest persistence. Rest pad-continued capture inspected. Controls regression
.gaming/controls-layout/1788714171116-QEQuk7/ passes. Gates
.gaming/runs/1788714145662-Cs6OR3/ build/152 tests/bot pass; baseline
.gaming/runs/1788714056639-3D3xsW/ pass. Self-review prefers stable navigation;
no physical gamepad/human-feel claim. Changed nav.ts, run-probe and harness docs.
Next precise action: inspect focused versus available map nodes with actual S/D-pad
navigation. styles.css has no .node.focus rule, so selected node may be visually
indistinguishable from other available nodes. Add a distinct non-color cue only
after capturing baseline, then verify input activation and reduced-motion visuals.
Preserve unrelated README.md/ROADMAP-v4.md edits. Full goal remains active.

Latest investigation, NO navigation fix shipped: run-probe.mjs --nav adds full
keyboard/synthetic-pad cycling at390x844/150%, focused-action bounds, and planned
Save & Quit/Continue state checks. Baseline rest1788713751874-2LCq2c failed focus
visibility; richer repro .gaming/rest/1788713787826-LRJeS4/ has selected WALLS node
x=-168.5,y8,w108,h108 (focus-failure.png inspected). Shop baseline
.gaming/shop/1788713753455-TLguft/ selected card clipped. Center alignment candidate
rest1788713843832-gt3x7V visited1/4; shop1788713845105-Tr6M9O selected card y=-806.75.
One focused repair changed mouseover to movement-only hover; still failed:
.gaming/rest/1788713903174-N6eEik/ node x=-168.5 and
.gaming/shop/1788713904466-Z7mu1Y/ visited1/7. Both edits to nav.ts fully reverted
(git diff empty). Controls regression on candidate passed
.gaming/controls-layout/1788713905765-WIT9Va/, not proof run navigation works.
Retain optional --nav diagnostic and document expected failures; do not claim pad
or Save/Continue coverage because keyboard failure aborts earlier. No root cause
established. Next precise action: instrument Nav idx, input justPressed, element
bounds and ancestor scroll offsets before/after keydown, simStep and keyup; compare
real-time loop against fixed-step probe at150% zoom. Distinguish probe artifacts,
input timing, hover and native scrolling before a fresh focused implementation.
Reverted-state gates .gaming/runs/1788713958996-Hsfix5/ pass build/152 tests/bot.
Self-review abstains on navigation quality; new evidence invalidates any broad
keyboard-access claim based on geometry alone. Previous responsive UI remains
intact. Preserve unrelated README/ROADMAP edits.

Latest visual fix: styles.css/runMap.ts run shell wraps topbar summary/actions,
uses minmax(0,1fr) main column,44px body-font unskewed buttons, bounded cards/menus,
smaller wrapping titles, stacked roster text. At<=900px shell scrolls vertically,
roster follows main content; route map retains horizontal scroll. No state changes.
run-probe.mjs called by rest/shop --layout checks all action/card-title/description
boxes reachable after scrolling and no outer overflow at1280x720,390x844,390x844
150%. Baseline .gaming/rest/1788713469227-cQtMGQ/ and
.gaming/shop/1788713470507-hyznmq/ clipped Save & Quit, Manage lineup and large-text
choices. Final .gaming/rest/1788713565918-8r8iaO/ and
.gaming/shop/1788713567257-nmkQGY/ pass all nine geometry cases and existing
save/reload/train/skip/purchase/hire/reroll regressions. Inspected narrow150% rest/
shop and desktop map captures; randomized rosters/offers differ from baseline,
same scenario types/viewports. Gates .gaming/runs/1788713550541-57gopL/ pass
build/152 tests/bot; baseline1788713471415-SZEBSD also passes. Impeccable guided
stacking and action readability. Self-review prefers first-session/accessibility
access; no keyboard/gamepad traversal claim from geometry or mouse-only checks.
Next precise action: verify actual keyboard/synthetic-controller focus traversal
and activation through narrow stacked header, map/choices, roster and back flows;
check focus scrolling exposes selected nodes/actions. Preserve state tests and
unrelated README.md/ROADMAP-v4.md changes. Full goal remains active.

Latest fix: skills.startShootout now consumes matchSeed before commitRng. Browser
shootout-full checks final committed draw against actual MatchSim seed using its
production RNG constructor and one mulberry32 draw rewind. Initial probe
.gaming/shootout-full/1788713235013-1NFbi8/ mistakenly read run.rng (undefined),
so its failure is invalid. Corrected to rngState and temporarily restored original
source for valid repro .gaming/shootout-full/1788713289828-VW3mDc/: committed last
draw290275201, next398546513 equals already-consumed seed398546513. Final
.gaming/shootout-full/1788713319800-Ep7GIr/ passes last398546513/next636625330;
idle0-1 andAI3-4 losses, durations and every attempt's team/scored outcome exactly
match prior natural evidence. No penalty/reward and reload retained; image inspected.
Final .gaming/runs/1788713311188-MOkzcV/ build/152 tests/bot pass. Initial baseline
.gaming/runs/1788713236034-8H95Kk/ passes too. No balance/visual changes; later run
choices intentionally advance past consumed seed. Self-review prefers RNG integrity,
abstains on full human play/natural wins/hardware. Changed skills.ts, shootout-full
and harness docs. Unrelated README.md/ROADMAP-v4.md remain unstaged.
Next precise action: inspect run-map/shop/rest at390x844 and150% text with browser
captures and all-action reachability, then fix demonstrated layout/navigation
problems. Keep persistence tests and actual keyboard/controller flows intact.

Latest evidence: new scripts/harness/shootout-full.mjs checks real skills screen,
idle/production AI, natural unshortened attempts/outcome, alternating turns,
exactly one shootoutEnd/deciding point, displayed attempt totals, unchanged roster,
cash and reload. Only reachable node/rival prepared; seed shootout-flow-1.
.gaming/shootout-full/1788713109620-Rx67eH/ passes idle0-1/5 attempts/54.85s and
AI3-4/20 attempts/115.47s (extended sudden death). Both lost naturally; result
image inspected. Both return row1 with no penalty/reward and no pending draft.
Natural-win branch exists but unexercised: no win/reward claim from these trials.
Build/152 tests/bot .gaming/runs/1788713108191-JEbwRC/ pass. No game-code edits.
Self-review prefers full challenge recovery evidence; abstains on human difficulty,
hardware and complete runs. Next precise action: startShootout in skills.ts calls
commitRng before rng.int(matchSeed), leaving saved RNG one draw behind. Hit Parade
already consumes seed before commit. Reproduce the stream-continuity issue and
fix if confirmed; verify repeat challenge setup and result/reward behavior.
Keep unrelated README.md/ROADMAP-v4.md edits unstaged. No timed burst is active.

Latest presentation: MatchOutcome optional shootoutGoals copies final successful
attempts only when shootout.stage is done. matchResultScreen explains both teams'
shootout totals, deciding point and player G/A exclusions beneath final score.
Uses existing result-description styling; Impeccable guided subordinate readable
copy. rewards.mjs --shootout-result prepares terminal state, asserts explanation
and existing pick/skip recovery; result-probe includes summary reachability.
Baseline .gaming/rewards/1788712844269-aJDz1D/; final
.gaming/rewards/1788712925461-PomMfN/ passes 1280x720,390x844 normal/150% with no
overflow/clipping and reachable choices/table. Desktop and150% images inspected;
baseline same terminal scenario/viewport but randomized labels differ. Regulation
.gaming/rewards/1788712926755-YzbwR2/ confirms no shootout copy, reward regression.
Gates .gaming/runs/1788712910680-SIaFE6/ pass build/152 tests/bot; baseline
.gaming/runs/1788712842818-EcorvN/ also passes. Self-review prefers clarity for
first-session/accessibility players, abstains on human feel/full-run/hardware.
Next precise action: exercise a full natural shootout skills node through its
real browser controller and outcome/reward. Existing skills reward harness uses
terminal injection; headless natural shootout tests do not cover browser wiring.
Keep real difficulty, attempt clocks and outcome; disclose scripted/AI control.
Unrelated README.md and docs/ROADMAP-v4.md remain unstaged.

Latest fix: shootout attempts leaked goals/assists into regulation player stats,
and undoing only1 team point leaked goal-value perk bonuses. rules.checkGoal now
emits goal feedback with value1/no assist in shootouts without modifying those
stats or team score; stepShootout still awards one final deciding point, no undo.
Expanded tests/sim/shootout.test.ts: natural shootout-only zero player G/A plus
weighted-goal shootout preserving preexisting regulation G/A and tied2-2 score.
Both failed before repair. Baseline .gaming/runs/1788712587650-7DVzVz/; final
.gaming/runs/1788712642528-8fyRaM/ build/152 tests/bot pass, all eight bot match
records identical. Route harness now retains boss shootout/player-goal evidence.
Browser --act --seed=route-act-1 .gaming/route/1788712656883-116E1K/ passes:
normal4-3, boss2-3 at same545.07s; shootout0-2 with regulation player totals2-2.
Boss result screenshot inspected: away G0/0/2, no phantom goalie assists.
Self-review prefers accurate regulation stats and perk-independent shootout
settlement; abstains on broader human feel and hardware. No layout changes.
Next precise action: show shootout resolution explicitly in match result copy;
currently final2-3 lacks an SO label despite regulation player totals2-2. Inspect
desktop/narrow/large-text evidence and preserve result/reward/reload routing.
Unrelated README.md and docs/ROADMAP-v4.md remain unstaged.

Latest P3 evidence: route.mjs --act extends natural combat through earned perk,
three level-ups (stable first offers after reload), remaining rest/shop and boss.
Optional --seed enters a named seed; post-combat-run.json/post-boss-run.json retain
complete saves. First .gaming/route/1788712073614-OXZPW9/ normal4-0/boss loss1-4
used draft skip; final .gaming/route/1788712222197-Echhmd/ --seed=route-act-1 took
Nitrous, normal4-3/boss loss2-3. Both pass natural loss/reload settlement. Act2 win
branch exists but remains unexercised: do not claim natural act advancement.
Build/151 tests/bot gates .gaming/runs/1788712074632-iou44F/ pass. Both boss result
images inspected. Self-review prefers recovery evidence, abstains on human feel,
hardware and full-run victory. No game-code changes. Changed route script plus
harness README/queue/handoff; unrelated README.md/ROADMAP-v4.md remain unstaged.
Next precise action: investigate apparent scoreboard/stat mismatch in named-seed
natural-boss-result.png: away player G totals4 while team score3. Check own-goal
attribution and retained match/report evidence before deciding whether a fix is
needed. Preserve natural outcomes; do not seed-search to imply representative
balance. Then resume broader progression/accessibility evidence.

Latest evidence: route.mjs --combat extends event/shop/rest into a normal match
on row3 (types prepared, original links and actual roster/modifiers preserved).
Home team is switched to production AI for the test; simulation runs full-length
without editing score/phase/winner/clocks/stats. Final
.gaming/route/1788711810087-KuK8hh/ passes: natural3-1 win in period3 at413.38sim
seconds, team shots34/15, hits55/21, bigHits15/12; matchesPlayed/Won count once,
earned draft survives reload and skip clears it. Result screenshot inspected.
Build/151 tests/bot .gaming/runs/1788711811092-7y2kkQ/ pass. No game-code edits.
Self-review supports connected combat/progression, not human feel/full-run win.
The --combat harness handles natural loss too, but this run only verified its win
branch; earlier terminal-loss fixtures remain distinct evidence.
Next precise action: extend through any pending level-ups after draft, remaining
Act1 rest/encounter, and natural boss outcome/act transition. Preserve actual
match difficulty and clocks; report losses instead of injecting victories. Save
full checkpoint artifacts if future continuation should reuse a natural run.

Latest evidence: scripts/harness/route.mjs runs connected event->shop->rest with
reloads in one run. Generated links untouched; first three row types and initial
injuries prepared. Actual event +45cash funds doctor -45/full heal, rest trains
one stat+2, all pending state clears and row/path advance once. Final
.gaming/route/1788711601985-aJ5MeJ/ passes and map screenshot inspected. First
.gaming/route/1788711550846-Q65mBR/ failed comparison because migrateRun adds
xp/level/pendingLevels0; fixture now normalizes only these documented defaults.
Build/151 tests/bot .gaming/runs/1788711551823-jNXiO4/ pass. No game-code changes.
Self-review supports connected encounter state, not full-run combat or game feel.
Next precise action: extend connected route into a normal match with its actual
run roster/modifiers and natural terminal outcome. If using AI control, disclose
it; don't inject score/winner/phase, shorten clocks, grant stats or relax balance
to claim a real run victory. Verify match result/save/reward or loss settlement,
then act transition. Human and physical hardware evidence remain open.

Latest progression fix: runState.pendingRest/prepareRest caches training offers
and heal policy; first entry heals only below ascension4. claimRest validates
pending node/offered skater and guards once-only train/skip; completeNode clears.
restScreen saves on entry; runMap Continue resumes it. Optional field supports
old saves. tests/run/rest.test.ts covers ascensions0/4, offers/RNG serialize,
invalid/duplicate claims and skip without training. Gates
.gaming/runs/1788711286817-4nlqDI/ pass build/151 tests/bot. New rest.mjs prepares
injuries/node, then uses real Save & Quit/Continue/train or skip/reload.
.gaming/rest/1788711339833-XEh5t0/ passes normal heals/+2 and ascension4 no heals/
skip, identical saved offers/RNG and one completed row. Ascension4 screenshot
inspected. Self-review prefers persistent choices; no broad run/hardware claim.
Next precise action: exercise successive event -> shop -> rest route choices and
reload after each, verifying path/row/cash/roster/perks and saved pending-state
cleanup interact correctly. Then advance actual combat nodes through natural
outcomes/act transitions, preserving human game-feel uncertainty.

Latest progression fix: runState.pendingShop/prepareShop retains shop offers,
free-agent definition, hired flag and reroll count. shopScreen saves on entry and
mutates saved state on purchases/hire/reroll; prices recompute on render so Haggler
applies immediately. Perk purchase checks affordability/remaining offer/ownership;
hire guards duplicate purchase. runMap routes pending shop before other map work;
completeNode clears matching shop on departure. Optional field preserves old saves.
Unit tests/run/shop.test.ts covers serialize/reopen/RNG retention and clear.
Gates .gaming/runs/1788711047667-d6aiY1/ pass build/148 tests/bot. New
scripts/harness/shop.mjs prepares node/funds, uses real UI entry/reload/purchase/
hire/reroll/reload/leave/reload. .gaming/shop/1788711107764-m2KFGx/ passes identical
state/RNG/cash, persistent reroll price, no second hire and row1 after leave.
Resumed shop capture inspected; self-review prefers stable economy, not full-run
or narrow-layout claim. Next precise action: restScreen generates training offers
on entry then commits RNG but keeps offers only locally. Save & Quit from rest can
therefore reroll offers; persist active rest training/Continue route analogously,
check healing/training/skip once and ascension4 no-heal policy. Event choices
already save effects before Continue, but still need successive-node evidence.

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
