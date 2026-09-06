# Hokyz domain map

Hokyz combines short arcade hockey matches with a branching roguelite run:
captain/roster choices, perks, shops, events, rival grudges, bosses, and persistent
unlocks. Current implementation includes training, shootouts, accessibility
settings, records, and highlight replays (see the v3 roadmap status log).

| Area | Responsibility |
| --- | --- |
| `src/sim/` | Fixed-step match state, hockey rules/physics, AI, fights, shootouts |
| `src/core/` | RNG, input, loop, events, save storage |
| `src/run/` | Rosters, run map, progression, content, serialization and migrations |
| `src/render/` | Three.js scene, match view, rigs, effects, camera and replay presentation |
| `src/ui/`, `src/training/` | Screens, navigation, HUD, controls, drills |
| `src/audio/` | Audio presentation |
| `src/app.ts` | Lifecycle and binding between simulation, presentation and screens |
| `tests/sim/`, `tests/run/` | Headless behavioral coverage |

Simulation coordinates: x along rink length, y across width; rendering maps the
ice plane into 3D. `MatchSim.step()` advances state and emits events; presentation
consumes those events. Keep browser dependencies out of the simulation and run
model. Use the seeded RNG for gameplay randomness.

Hit Parade dummy steering lives in `src/sim/hitParade.ts`, with a challenge-local
seeded RNG independent of the match and rendering RNGs. The skills screen owns
the challenge timer, pause, score and reward lifecycle; duplicate-time steering
updates do not consume randomness.

`window.__hokyz` already exposes the App for inspection. There is no survival-game
`window.__bot` API. Harness bot play runs MatchSim directly; browser capture checks
the rendered attract match separately. Neither proves the full human run flow.
