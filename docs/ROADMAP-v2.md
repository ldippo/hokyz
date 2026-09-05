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

### C — Ice, arena, crowd (L)
Branch `phase/arena`.
- Ice: PBR ice albedo/normal/roughness (Poly Haven, KTX2) under the painted-lines canvas; TSL material with planar reflection texture (mirror camera pass, roughness blur) + fresnel; skate-mark RT: blades stamp into a 2048² accumulation target, reset on period end.
- Boards/glass/nets: painted-metal kick plate, ad-board texture strip (generated), glass with reflection + smudge normal, net mesh with alpha.
- Crowd: 3-4 fan GLTF variants, `InstancedMesh` with per-instance color/phase attributes, TSL vertex sway / jump on goal / wave.
- Jumbotron: render target with score/clock canvas + replay frame; spotlights (`SpotLight` + volumetric cone mesh), rafters, banners. Port the 3 rink themes.
- Gate: reflection + skate marks on High; Low disables both; frame budget holds.

### D — Cinematics + audio (M)
Branch `phase/presentation`.
- Replay buffer: ring of last 240 sim snapshots (positions/facings/puck). Goal → replay cam behind net, 0.4× speed on the crossing, skippable.
- Intro fly-in, team slam-in, captain close-up; MVP card at final.
- Dynamic cam: zoom by zone/breakaway, roll on hits. Big-hit slow-mo cut-in only for on-fire hitters.
- Audio: CC0 samples (crowd calm/roar loops, horn, skates, boards, gloves), opus, layered via existing `Sfx`; organ loop on menus.
- Gate: user playtest of feel; replay never desyncs from the score.

### E — On-ice depth (M)
Branch `phase/handling`.
- Sim: aim reticle input (`Input.aim`), 5-zone targeting, lift by charge, goalie late-read; goalie dive input + pull-goalie; chained dekes with turbo cost + ANKLE BREAKER streak; saucer pass (z arc) + lane evaluation; one-timer ring.
- Render/HUD: reticle, lane lines, timing ring, PERFECT pop.
- Input: right stick / mouse aim; keyboard arrows aim.
- Tests: aim zones map to net coords, saucer clears fallen skater, deke chain cost, pull-goalie lineup.
- Gate: balance batch still in range (goals 6-11), user feel ok.

### F — Spectacle (M)
Branch `phase/spectacle`.
- Sim: fight state machine (trigger rules, duel rounds, outcomes), specials meter + 5 kits, team-fire.
- AI: fight decisions by hit stat + temper trait; special usage heuristics.
- Render: fight cam + UI prompts, special VFX (laser trail, shockwave ring, afterburner, blink), meter HUD.
- Tests: fight trigger conditions, special effects on state, meter fill rates.

### G — Run depth (M)
Branch `phase/run-depth`.
- Perk tags + set bonuses (data + `modifiers.ts` hooks), cursed perks, risk events, skater XP/levels with node-time level-up choice, boss phase rules (period-triggered mutations in `MatchSim`).
- UI: tag counts on draft, level-up screen, boss mechanic reveal on intro.
- Tests: set bonus application, XP thresholds, boss phase triggers.

### H — Polish + budget (S)
Branch `phase/polish`. Asset budget audit (≤40 MB, lazy loading, attract mode on light scene), settings completeness, README/docs, final balance batch, production merge.

## Risks and mitigations
- **TSL / WebGPU maturity in r185**: fallback path is tested every phase; if a node effect misbehaves on WebGL2, tier it High-only.
- **Planar reflection cost**: mirror pass renders skaters + crowd only (no post), half-res on Med.
- **Blender rig via bpy scripting**: armature + auto-weights are scriptable; if weights look bad, fall back to rigid per-part parenting (still bone-driven, no skinning).
- **Headless can't hold keys / no WebGPU**: user playtests each preview; Playwright covers layout + fallback only.
- **Balance drift** from aim/specials/fights: `pnpm sim:batch` remains the regression check; targets stay goals 6-11, big hits 6-25.

## Not in scope
Local co-op, online play, season mode, daily seed/leaderboard, mobile/touch, hand-painted per-team textures.
