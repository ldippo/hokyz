# HOKYZ v4 — Roadmap additions (planned 2026-09-05)

v3 shipped (`ROADMAP-v3.md`). v4 asks: what protects the game as it grows, and what gives a player *ownership* of a run? Same method: candidates, seven personas, synthesis, one branch per phase merged to `main` after headless verification.

## Candidate additions

| # | Candidate | One-liner |
| --- | --- | --- |
| D1 | Robustness + CI | Versioned save migrations, global error recovery to the title, GitHub Actions running typecheck/tests/build/balance on every push. |
| D2 | Roster management + team identity | Pick your starters, cut/trade, see traits; name, logo shape, and colors chosen at captain select instead of random. |
| D3 | Shot blocking + goalie styles | Pucks collide with skaters (blocks, deflections, shin-pad stings); goalie archetypes (Butterfly / Stand-up / Puck-handler) with matching AI. |
| D4 | Overtime League + ascension 3-5 | After a championship the run continues into escalating acts for records; higher ascensions add curses (cursed-only drafts, no rest heals, boss extra phases). |
| D5 | Quality of life | Pause-menu box score, Quick Match home-team picker from unlocked captains, `?seed=` links, photo mode (PNG with overlay). |
| D6 | Goalie fights / enforcer duels | Goalie-vs-goalie fights when both enforcers are out. Novelty. |
| D7 | Announcer | Synth or text-to-speech play-by-play. |
| D8 | Mobile / touch | Re-checked; still declined (input surface too wide). |

## Persona reviews

**Casual player** — "I renamed my team in my head. Let me do it in the game." D2 first. D5's pause box score answers "who's hot?" without leaving play. Neutral on D3; worried blocks make scoring harder.

**Skill player** — D3 is the one that changes decision-making: shot lanes matter when bodies stop pucks; goalie styles reward reading the keeper. D4 gives a reason to keep playing after a win. `?seed=` links (D5) for challenge sharing.

**Hitz nostalgic** — D3 (shin pads ringing off a slapshot is *the* sound), D2 (custom teams were half the fun), D7 announcer if it doesn't sound like a robot; it would, so skip.

**Rogue-like enthusiast** — D2 lineup agency is overdue; auto-lineup hides a real decision. D4 endless + ascension curses are the endgame loop the weekly seed needs. Wants D1's migrations so a mid-run save survives updates.

**Tech lead** — D1 before anything: fifteen merges have added save fields with scattered `?? default` guards; one missed guard is a black screen on an old save. Global error recovery turns a crash into a toast. CI is thirty lines. D3's puck-body collision touches the hottest loop; wants the balance batch as a CI artifact first so regressions show up in the PR.

**Producer** — Sizes: D1 S-M, D2 M, D3 M, D4 M, D5 S, D6 S, D7 L, D8 L. Order by risk removed then retention: D1, D2, D3, D5, D4. D6 low value, D7/D8 out.

**Accessibility advocate** — D2's color picker must respect the colorblind collision check; D5 photo mode should embed the same name tags; D1's error toast must be readable and dismissible by keyboard.

### Synthesis
- D1 first (every persona that thinks about breakage put it first; it also gives the batch-in-CI guard D3 needs).
- D2 second: ownership + lineup agency, no sim risk.
- D3 third: the biggest gameplay change, guarded by CI balance.
- D5 fourth: cheap, and photo mode + seed links feed the weekly.
- D4 fifth: endgame once the rest is stable.
- D6/D7/D8 out.

## Phases

### V4-1 — Robustness + CI (S-M)
Branch `v4/robust`. `SCHEMA_VERSION` on meta and run saves with migration functions that deep-fill defaults and discard runs whose maps predate current node types; tests feed v1-era payloads through. Global `error` / `unhandledrejection` handler: log, toast, dispose the view, return to the title; a hard-error card with a reload button after repeated failures. GitHub Actions: pnpm install, tsc, vitest, build, and a 4-match balance batch printed to the job summary on every push and PR.

### V4-2 — Roster management + team identity (M)
Branch `v4/roster`. Roster screen from the map: drag/click to pick three starters, bench order, cut a skater (small cash), view traits/XP; injuries respected. Captain select gains team name, logo shape, primary/secondary color pickers (colorblind check applied), used by jerseys, HUD, intro slam-in.

### V4-3 — Shot blocking + goalie styles (M)
Branch `v4/blocks`. Puck vs skater capsule collision for free pucks: blocks (puck drops dead, `shotBlock` event, feat), deflections (angle change), stings (blocker stumbles on hard shots unless balance high). AI defenders step into lanes when the carrier winds up. Goalie archetypes with save-profile shifts (Butterfly +low/−high, Stand-up +high/−low, Puck-handler outlet passes + brick wall shorter) and generation/UI. Gate: batch goals stay 6-10; block rate reported.

### V4-4 — Quality of life (S)
Branch `v4/qol`. Pause menu box score + perks, Quick Match home team from unlocked captains, `?seed=` deep links to start a seeded run, photo mode (canvas → PNG with scoreboard overlay) from the pause menu.

### V4-5 — Overtime League + ascension 3-5 (M)
Branch `v4/endgame`. After the act-3 boss the run may continue into Act 4+ with regenerated maps at rising tiers, records per act reached; ascension 3 (cursed-only epic drafts), 4 (no rest heals), 5 (every boss gets an extra phase). Unlockables and records updated.

## Status log
- 2026-09-05: plan written; V4-1 in progress.
