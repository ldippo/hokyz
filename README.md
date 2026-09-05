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
| Move | WASD / arrows | Left stick / d-pad |
| Turbo | Shift | RT / RB |
| Pass / switch skater | J | A |
| Shoot (hold to charge) / body check | K or Space | B |
| Deke / spin dodge | L | X |
| Pause | P / Esc | Start |

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
