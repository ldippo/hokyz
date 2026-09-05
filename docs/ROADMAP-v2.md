# HOKYZ v2 — Graphical Overhaul + Gameplay Expansion

Decisions locked 2026-09-05 (grill session). This is the execution plan. Every phase = its own branch, Vercel preview, user playtest, then merge to `main`.

## Locked decisions

| Area | Decision |
| --- | --- |
| Art target | Stylized-realistic arcade. PBR materials, wet reflective ice, chunky Hitz proportions, punchy grade. |
| Assets | Hybrid: CC0 PBR texture sets (Poly Haven / ambientCG via direct CDN fetch) + GLTF models authored in Blender via MCP (fresh `.blend`, never the user's open scene). Procedural shaders layered on top. |
| Characters | Rigged GLTF skater + goalie, bones driven procedurally from sim state each frame. No animation clips to source. |
| Renderer | `WebGPURenderer` + TSL node materials, automatic WebGL2 fallback. Three's post-processing nodes. |
| Ice | Planar reflection pass + persistent skate-mark render target + PBR ice textures under painted lines. |
| Perf | 60 fps discrete GPU, 30+ fps integrated. Low/Med/High tiers, auto-picked by GPU probe + frame-time watchdog, exposed in Settings. |
| Post-fx (High) | Bloom + color grade + vignette, GTAO, TRAA, hit-reaction fx (hit-stop, radial blur, chroma split, turbo speed lines). |
| Arena | Instanced low-poly fans (3-4 variants) with TSL vertex animation, jumbotron (live score + replay), spotlight rig with soft volumetrics, rafters + banners. |
| Cinematics | Goal replay (second cam, slow-mo), match intro fly-in + MVP card, dynamic gameplay camera, big-hit slow-mo cut-in (gated to on-fire hits). |
| Jerseys | One UV jersey template; per-team colors, 4 stripe patterns, generated SVG mascot logo, numbers on back, logo on goalie mask. Run team picks name + logo at captain select. |
| Audio | CC0 samples for crowd beds, horn, skates, board slams, glove pops, layered over existing synth. Synth stays for UI. Arena organ loop for menus. |
| Gameplay tracks | Arcade spectacle, on-ice depth, rogue-like depth. No co-op / season / daily seed. |
| Fights | Retaliation trigger, 8 s timing duel (high/low/feint windows + mash recover), loser sits rest of period, winner goes on-fire. |
| Specials | Shared meter (~90 s to fill, hits/goals/saves accelerate). Sniper LASER SHOT, Enforcer SHOCKWAVE, Speedster AFTERBURNER, Playmaker BLINK PASS, Goalie BRICK WALL. Perks modify specials. |
| Aim | Right stick / mouse net reticle (5 zones), auto far-side when idle, charge >60% lifts, quick release beats charged vs goalie read. Keyboard: arrows aim while WASD moves. |
| Goalie | Tap switch during opponent's shot window → 0.6 s dive input. Pull goalie (hold pass 1 s in last 2 min) for extra attacker. |
| Handling | Chained dekes (up to 3, turbo cost, ANKLE BREAKER streak credit), saucer pass + lane preview, one-timer timing ring with PERFECT pop. |
| Run depth | Perk synergy tags + set bonuses, cursed perks + risk events, skater XP + level-ups, boss phases with period-based rule changes. |
| Sequencing | Graphics foundation first, then gameplay vertical slices each shipping with its VFX. |
| Verification | Per phase: vitest green, headless balance batch in range, Playwright screenshots on WebGL2 path, in-page perf probe on both paths. User playtests preview on real hardware. No merge without user ok. |
| Git flow | `phase/<name>` branch → Vercel preview → user ok → PR merge to `main`. |
| Constraints | Asset budget ≤ ~40 MB, lazy-loaded (KTX2, Draco, opus). `main` stays playable throughout; old renderer lives until Phase A reaches parity on both backends. |

## Phases

### A — Renderer foundation (L) — IN REVIEW (branch `phase/renderer`)
Goal: same visuals as today, new pipeline.
Status 2026-09-05: WebGPURenderer + WebGL2 fallback, RenderPipeline post stack (bloom, GTAO, TRAA/FXAA, radial-zoom + chroma hit fx, grade + vignette), Low/Med/High tiers with GPU probe + watchdog, `?perf=1` overlay, hit-stop, Settings quality row. Verified on the WebGL2 path in headless; WebGPU path needs a real-GPU playtest. Bundle grew to ~1 MB (292 KB gzip) from three/webgpu + addons; code-split is a Phase H item.
- Swap `SceneRig` to `WebGPURenderer`; convert all materials to node materials (`MeshStandardNodeMaterial` etc.).
- Post stack via `PostProcessing` + nodes: bloom, color grade (LUT-ish TSL), vignette, GTAO, TRAA.
- Hit-reaction fx: hit-stop (loop.speed dip 3 frames), radial blur + chroma split uniform driven by `st.shake`, turbo speed lines.
- Quality tiers: `render/quality.ts` — GPU probe (adapter info / renderer string), frame-time watchdog that steps down a tier after 3 s under target. Settings row.
- Perf probe: `?perf=1` overlays frame-time graph and tier; logs to console for Playwright capture.
- Gate: title/map/match/all screens render on WebGPU and WebGL2 fallback; vitest green; screenshots match old layout.

### B — Characters (L) — IN REVIEW (branch `phase/characters`, stacked on A)
Status 2026-09-05: `assets/src/build_skater.py` builds skater + goalie (chunky proportions, rigid-part skinning, waist blend, jersey UV atlas) via headless Blender 4.5 (`~/opt/blender-4.5.13-linux-x64/blender -b -P ...`), exports `public/models/{skater,goalie}.glb` (~460 KB total, no Draco yet). `render/skaterRig.ts` drives 21 bones from sim state: stride/crouch, lean + turn roll, chest wind-up/snap on shots, lunge arms, knockdown splay, goalie butterfly, celebrate, head tracks puck. `render/jerseyTexture.ts` generates per-team/per-player jerseys (4 stripe patterns, 5 emblem shapes, number + name on back). Debug viewer: `/?rigview=1&poses=idle,skate,lunge,charge,down,celebrate&goalie=butterfly&cam=front|side|back|iso`. Note: glTF export strips dots from bone names (`thigh.L` → `thighL`). Deferred: Draco, real face/helmet detail, stick-hand IK (arms are pre-posed holding the stick).
- Blender (MCP, new file `assets/src/skater.blend`): bpy script builds chunky skater mesh (helmet, visor, shoulder pads, gloves, pants, skates, stick), armature (root, hips, spine, chest, head, L/R shoulder-elbow-wrist, L/R hip-knee-ankle, stick bone), auto-weights, UV jersey template, goalie variant (pads, blocker, glove, mask). Export Draco GLTF to `public/models/`.
- `render/skaterRig.ts`: `SkinnedMesh` per skater; bone driver from sim: stride cycle from speed, crossover lean from lateral accel, torso twist toward puck, stick blade tracks `stickPoint`, lunge pose during `lunge`, ragdoll-ish tumble on `knockdown` (spring-damped bones), get-up blend, goalie butterfly on `butterfly`, celebrate on goal.
- Jersey material: TSL node combining base fabric PBR (Poly Haven fabric normal/roughness) + generated team texture (canvas: colors, stripes, mascot SVG, number). Team logo on goalie mask.
- Gate: all archetypes + goalie visible in Quick Match, knockdown/get-up reads correctly, no bone popping at faceoff snaps, Low tier still ≥30 fps integrated.

### C — Ice, arena, crowd (L) — IN REVIEW (branch `phase/arena`, stacked on B)
Status 2026-09-05: `render/iceMaterial.ts` TSL ice: procedural baked scratch normal + roughness (ambientCG ice sets were cracked lake ice, not rink ice, so the base is procedural), planar `reflector()` pass on High with fresnel + scratch distortion, skate-mark accumulation RT (`render/skateMarks.ts`, Med+, cleared each period). Boards rebuilt as UV-correct ribbons: painted-metal kick plate (ambientCG PaintedMetal006, downscaled to 512 via Blender), generated ad strip, cap rail, glass with stanchions. `render/crowd.ts`: 3 procedural fan variants, ~870 instances, TSL vertex bounce/jump/wave (Med+). `render/arena.ts`: jumbotron (live score/clock/last event), 4 spotlights + volumetric cones, rafters, banners. RoomEnvironment PMREM for PBR reflections. Themes carry spot color + banner text. Deferred: KTX2, replay frame on jumbotron (Phase D), crowd jersey colors per matchup, reflection blur by roughness.
- Ice: PBR ice albedo/normal/roughness (Poly Haven, KTX2) under the painted-lines canvas; TSL material with planar reflection texture (mirror camera pass, roughness blur) + fresnel; skate-mark RT: blades stamp into a 2048² accumulation target, reset on period end.
- Boards/glass/nets: painted-metal kick plate, ad-board texture strip (generated), glass with reflection + smudge normal, net mesh with alpha.
- Crowd: 3-4 fan GLTF variants, `InstancedMesh` with per-instance color/phase attributes, TSL vertex sway / jump on goal / wave.
- Jumbotron: render target with score/clock canvas + replay frame; spotlights (`SpotLight` + volumetric cone mesh), rafters, banners. Port the 3 rink themes.
- Gate: reflection + skate marks on High; Low disables both; frame budget holds.

### D — Cinematics + audio (M) — IN REVIEW (branch `phase/presentation`, stacked on C)
Status 2026-09-05: `render/director.ts` keyframed camera shots (intro fly-in with team/captain slam-ins, goal replay from behind the beaten net at 0.45×, on-fire big-hit cut-in at 0.22×, player-of-the-game orbit); `render/replay.ts` 300-frame ring buffer replayed onto scratch skater states so the live sim is untouched; sim is held during intro/replay/mvp and any button skips. Follow cam gained zone zoom, breakaway lead, hit roll. MVP card on the result screen. AUDIO DEVIATION: no reliably CC0 rink samples found (OGA crowd pack is CC-BY 4.0; horn/whistle/skate searches empty), so `assets/src/render_audio.py` pre-renders 13 samples with numpy/scipy (layered crowd voices + reverb, horn chord, pea whistle, skate carves, board slam, hits, organ riff) to `public/audio/*.ogg` (264 KB). `audio/samples.ts` layers them over the synth; drop CC0 recordings with the same file names to replace them.
- Replay buffer: ring of last 240 sim snapshots (positions/facings/puck). Goal → replay cam behind net, 0.4× speed on the crossing, skippable.
- Intro fly-in, team slam-in, captain close-up; MVP card at final.
- Dynamic cam: zoom by zone/breakaway, roll on hits. Big-hit slow-mo cut-in only for on-fire hitters.
- Audio: CC0 samples (crowd calm/roar loops, horn, skates, boards, gloves), opus, layered via existing `Sfx`; organ loop on menus.
- Gate: user playtest of feel; replay never desyncs from the score.

### E — On-ice depth (M) — IN REVIEW (branch `phase/handling`, stacked on D)
Status 2026-09-05: aim input (arrows / right stick / mouse) picks the post, charge > 0.6 lifts to the top corners with a physically solved launch (found and fixed: the old lift was ~1 m/s so shots never rose; now over-the-bar misses are possible from distance); 3D reticle on the goal mouth. Pass now fires on release: hold ≥ 0.22 s = saucer (airborne, only the target can catch it), hold ≥ 1 s in the last 2:00 = pull goalie (goalie skates out as a 4th attacker, returns at the next faceoff). Opponent shots open a 0.6 s dive window: switch button + up/down snaps to the goalie for a dive (right side ×1.4 saves + BIG SAVE, wrong side ×0.5). Chained dekes (toe-drag L/R or spin, up to 3 in 1 s, turbo cost after the first); a lunging defender who whiffs on a deking carrier gets knocked down and the carrier earns ANKLE BREAKER streak credit. One-timer ring after receiving a pass, PERFECT pop on the shot. Pass lanes drawn as strips for the carrier (Playmakers see farther). Balance batch: goals 6.8 / 8.3 / 10.7 / 11.3 by difficulty.
- Sim: aim reticle input (`Input.aim`), 5-zone targeting, lift by charge, goalie late-read; goalie dive input + pull-goalie; chained dekes with turbo cost + ANKLE BREAKER streak; saucer pass (z arc) + lane evaluation; one-timer ring.
- Render/HUD: reticle, lane lines, timing ring, PERFECT pop.
- Input: right stick / mouse aim; keyboard arrows aim.
- Tests: aim zones map to net coords, saucer clears fallen skater, deke chain cost, pull-goalie lineup.
- Gate: balance batch still in range (goals 6-11), user feel ok.

### F — Spectacle (M) — IN REVIEW (branch `phase/spectacle`, stacked on E)
Status 2026-09-05: `sim/fight.ts` fight state machine: a big hit on a repeat victim (>3 knockdowns this period) or an Enforcer flattening the carrier offers DROP THE GLOVES (1.6 s, K = fight, J = walk away; AI accepts by hit stat + temper trait), then an 8 s cue duel (HIGH = K, LOW = L, FEINT = block with J, MASH = K when low; AI reacts by hit + difficulty), loser is ejected until the period break and the winner goes on-fire; capped at 1 fight per period. `sim/specials.ts`: per-team meter (~115 s of play, big hits/goals/saves/ankle-breakers accelerate), Space / pad Y fires the controlled skater's kit: Sniper LASER SHOT (next shot unsavable if on net), Enforcer SHOCKWAVE (floors everyone within 4.2 m, puck pops), Speedster AFTERBURNER (3.2 s at 1.6× speed, phases through checks), Playmaker BLINK PASS (puck jumps to the best teammate with a 0.7 s guaranteed one-timer window), Goalie BRICK WALL (next 3 shots saved; AI goalies use it on incoming shots). AI uses kits situationally. Team fire: two skaters on fire at once or 3 unanswered goals ignites the whole team for 20 s. Presentation: fight camera + HP bars + cue prompts, guard/punch/stagger poses, shockwave ring, laser trail, afterburner flames, meter HUD. `TeamMods` gained `specialGainMul` and `fightPowerMul` for Phase G perks; `MatchMods.noFights` for mutators. Batch: fights 0.3-2.3, specials 8-10, team fire 1-2 per match.
- Sim: fight state machine (trigger rules, duel rounds, outcomes), specials meter + 5 kits, team-fire.
- AI: fight decisions by hit stat + temper trait; special usage heuristics.
- Render: fight cam + UI prompts, special VFX (laser trail, shockwave ring, afterburner, blink), meter HUD.
- Tests: fight trigger conditions, special effects on state, meter fill rates.

### G — Run depth (M) — IN REVIEW (branch `phase/run-depth`, stacked on F)
Status 2026-09-05: every perk carries tags (FIRE, IRON, JET, SNIPE, WALL, SCRAP, CASH); 3 of a tag completes a set: Wildfire (fire spreads to a teammate), Iron Curtain (injuries zeroed, +15% resist), Afterburners (2× turbo regen, +6% speed), Dead Aim (+40% accuracy, +30% meter), Fortress (goalie gets a free auto-save each period), Goon Squad (fights +50%, more offers), Franchise (25% shop discount, +25% cash). Draft/shop cards show tag progress, the roster panel lists tags and completed sets. Four cursed epics (Glass Jaw, Blood Money, Loose Cannon, Overclock) plus two risk events (Underground Game, Black Market Doc). Skater XP from box scores (captain 1.5×), levels at 100/250/450/700/1000; level-ups are spent on a screen before the next map view (+1 to one of two stats, or a trait). Boss phases: Wreckers add a 4th skater in P3; Blur turns the ice slick in P2 and gives infinite turbo in P3; Legends' goalie catches fire after 2 goals against and the boards go bouncy in P3; revealed on the match intro and announced in-match. New sim hooks: `fireSpread`, `periodBrickWall`, `temperMul`, `MatchMods.bossPhases` / `extraSkater`.
- Perk tags + set bonuses (data + `modifiers.ts` hooks), cursed perks, risk events, skater XP/levels with node-time level-up choice, boss phase rules (period-triggered mutations in `MatchSim`).
- UI: tag counts on draft, level-up screen, boss mechanic reveal on intro.
- Tests: set bonus application, XP thresholds, boss phase triggers.

### H — Polish + budget (S) — IN REVIEW (branch `phase/polish`, stacked on G)
Status 2026-09-05: budget audit: models 464 KB, textures 160 KB, audio 264 KB, JS 189 KB app + 978 KB three vendor chunk (65 + 270 KB gzip), no production source maps; total shipped ≈ 2.1 MB against the 40 MB cap, so KTX2/Draco stay deferred. Assets stream behind the title (attract match re-creates itself when rigs land, loading hint until then); rig viewer lazy-imported. Settings gained menu music, cinematics, screen shake, hit-fx toggles. Final batch (10 matches/difficulty): goals 7.9 / 6.8 / 9.5 / 9.7, fights 0.5-2.4, specials 7.8-9.5, team fire 0.8-1.5.

## What's next (not in the v2 plan)
- Merge the stack #1 → #8 in order after playtests; production only moves on `main`.
- KTX2 textures + Draco meshes if assets ever approach the cap.
- Stick-hand IK for the wind-up (hands currently slip slightly off the stick).
- CC0 recordings to replace the pre-rendered SFX (same file names in `public/audio/`).
- Reflection blur by roughness; per-matchup crowd jersey colors; replay frame on the jumbotron.
- Run economy tuning from real runs: set reachability by act 2, cursed perk pick rates, boss phase difficulty.
- Mobile/touch, co-op, daily seed remain out of scope.

## Risks and mitigations
- **TSL / WebGPU maturity in r185**: fallback path is tested every phase; if a node effect misbehaves on WebGL2, tier it High-only.
- **Planar reflection cost**: mirror pass renders skaters + crowd only (no post), half-res on Med.
- **Blender rig via bpy scripting**: armature + auto-weights are scriptable; if weights look bad, fall back to rigid per-part parenting (still bone-driven, no skinning).
- **Headless can't hold keys / no WebGPU**: user playtests each preview; Playwright covers layout + fallback only.
- **Balance drift** from aim/specials/fights: `pnpm sim:batch` remains the regression check; targets stay goals 6-11, big hits 6-25.

## Not in scope
Local co-op, online play, season mode, daily seed/leaderboard, mobile/touch, hand-painted per-team textures.
