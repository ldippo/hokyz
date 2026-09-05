# HOKYZ

Arcade 3-on-3 hockey with NHL Hitz DNA (turbo, big hits, on-fire streaks, no offsides) wrapped in a rogue-like run:
branching tournament map, perk drafts between games, injuries, permadeath runs, persistent unlocks.

Browser game: Vite + TypeScript + Three.js. No assets — everything is procedural (meshes, textures, SFX).

## Play

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

Controls (keyboard / gamepad):

| Action | Keyboard | Pad |
| --- | --- | --- |
| Move | WASD | Left stick / d-pad |
| Aim shot (post) | Arrow keys / mouse | Right stick |
| Turbo | Shift | RT / RB |
| Pass / switch skater (release) | J | A |
| Saucer pass | Hold J briefly | Hold A |
| Pull goalie (last 2:00) | Hold J 1 s | Hold A 1 s |
| Goalie dive (after an opponent's shot) | J + up/down | A + stick |

Bodies matter: a skater standing in the lane blocks or deflects a shot (hard shots sting low-balance skaters), and AI defenders step into lanes when the carrier winds up. Goalies come in three styles: Butterfly (eats low shots), Stand-up (owns the top corners), Puck-handler (fast outlet passes, shorter Brick Wall).
| Shoot (hold to charge) / body check | K | B |
| Deke (with direction = toe drag) | L | X |
| Special move (meter full) | Space | Y |
| Fight: high / low / block / mash | K / L / J / K | B / X / A / B |
| Pause | P / Esc | Start |

## Features

- NHL Hitz-style 3v3: turbo, big hits, on-fire streaks, team fire, fights, archetype specials (laser shot, shockwave, afterburner, blink pass, brick wall).
- Rogue-like run: branching 3-act map, perk drafts with 7 synergy sets, cursed perks, shops, events, rest stops, skater XP + level-ups, injuries, bosses with phase mechanics, meta unlocks.
- Training Camp, shootouts, skills nodes, rival grudges, feats, weekly seeded runs, records + local telemetry, key remapping, colorblind palettes, reduced motion, match-end highlight reel.
- Rendering: WebGPU (WebGL2 fallback) with TSL post-processing, rigged procedurally-animated skaters, reflective scratched ice with skate marks, instanced animated crowd, arena dressing, cinematic intro/replay/MVP shots. Low/Med/High auto quality tiers.

## Structure

- `src/sim/` — pure deterministic 60 Hz simulation (no Three.js). Physics, skaters, puck, hits, goalie, rules, on-fire, AI. All feel tuning in `src/sim/constants.ts`.
- `src/render/` — Three.js scene, rink, low-poly skaters, particles, follow camera.
- `src/run/` — rogue-like layer: map generation, run state, perks, rival teams, mutators, events, meta unlocks.
- `src/ui/` — DOM overlay HUD and screens, keyboard/gamepad menu navigation.
- `src/audio/` — Web Audio synth SFX.
- `tests/` — vitest suites for sim, rules, hits, AI balance, map gen, run state.

## Scripts

```bash
pnpm test              # vitest
pnpm sim:batch 10      # headless AI-vs-AI balance report per difficulty
pnpm build             # typecheck + vite build → dist/
```

Deploys to Vercel as a static Vite site (`vercel.json`).

## Asset builds

```bash
~/opt/blender-4.5.13-linux-x64/blender -b -P assets/src/build_skater.py -- --out public/models   # skater + goalie GLBs
python3 assets/src/render_audio.py public/audio                                                  # pre-rendered SFX (numpy/scipy + ffmpeg)
```

Share a run: the map's SEED chip and the run-over screen copy a `/?seed=<text>` link that opens captain select with that seed prefilled. Pause (P/Esc) shows the live box score and your perks, and Photo Mode saves a PNG of the current frame with a scoreboard strip.

Debug views: `/?perf=1` frame-time overlay, `/?rigview=1&poses=idle,skate,lunge,charge,down,celebrate&goalie=butterfly&cam=front` character poses.
