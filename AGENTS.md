# Hokyz

Browser arcade hockey roguelite: TypeScript, Three.js, Vite, pnpm, Vitest.
Read `CONTEXT.md` for module boundaries and `docs/design/` for the game-quality
contract. Existing v2/v3 roadmaps are historical; do not infer new work or current
publishing authority from them. `docs/ROADMAP-v4.md` is currently empty.

## Development

- `pnpm dev` starts Vite; `pnpm build` typechecks and builds; `pnpm test` runs tests.
- `pnpm harness:check` runs build, tests, and seeded hockey bot gates, writing
  evidence under `.gaming/runs/`. `pnpm harness:capture` captures the built game.
- Keep simulation deterministic and independent of DOM, renderer, and audio.
  Preserve save migrations, input remapping, and reduced-motion behavior.
- Gameplay changes need simulation evidence. Visual changes also need inspected
  browser captures. A passing build does not establish game feel or visual quality.
- Preserve existing work. Never use whole-tree checkout/reset/clean as a failed
  experiment rollback. Revert only changes attributable to the current task.
- Git inspection errors are blockers for Git operations, not proof of a clean tree.

## Gaming harness

Project skills: `$hokyz-plan`, `$hokyz-loop`, `$hokyz-handoff`. Their maintained
sources are in `docs/harness/skills/`, exposed through `.agents/skills/`.
Read `docs/harness/README.md` for commands, migration differences, and limitations.
For continuation tasks read `docs/handoffs/current.md`; explicit user requests
override stale handoff goals. Ordinary small edits do not require a burst.
Treat planning, implementation, style review, and persona review as distinct
passes; no parallel agents are required. Report self-review as self-review.
Do not start a timed improvement burst merely because this harness is installed.
