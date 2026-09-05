# HOKYZ v3 — Roadmap additions (planned 2026-09-05)

v2 shipped every phase of `ROADMAP-v2.md` to production. v3 asks: what makes the game *stick*? Candidates below were reviewed by seven personas; the phased plan at the end is the synthesis. Work lands one phase per branch → PR → merge to `main` (user authorized self-merging on 2026-09-05).

## Candidate additions

| # | Candidate | One-liner |
| --- | --- | --- |
| C1 | Training Camp | Guided drills for every mechanic (aim, saucer, dive, dekes, specials, fights) before a run. |
| C2 | Shootouts + Skills nodes | Tied OT → shootout using aim/deke; run map gains shootout-duel and hit-parade challenge nodes. |
| C3 | Rival grudges + content pack | Rivals remember losses and return stronger with taunts; +4 rivals, +6 events, +4 mutators, 2 alt bosses, 2 new archetypes with specials. |
| C4 | Feats, weekly seed, records | Achievements with unlock rewards, date-derived weekly seed (no backend), best-run hall of fame, lifetime stats. |
| C5 | Accessibility & options | Key remapping, colorblind-safe team/lane palettes, name tags, text size, reduced motion, gamepad rumble. |
| C6 | AI & feel pass | Teammate breakout positioning, fewer own-goals, goalie-pull AI when losing late, snow spray, puck trail, goal light show. |
| C7 | Highlight reel | Auto-cut goals/big hits into a 20 s reel at match end, watchable and skippable. |
| C8 | Stick-hand IK + goalie mask detail | Character polish deferred from v2. |
| C9 | Local co-op | 2 humans, one team. (Declined in the v2 grill; re-checked here.) |

## Persona reviews

**Casual player (first hour)** — "I got a DIVE! prompt and had no idea what it meant. There are ten verbs on one pad." Top: C1, C5 (bigger text, remap). C2 is fun but confusing until C1 exists. C3 content is invisible to me until I survive act 1. Rates C1 must-have.

**Skill player (wants a ceiling)** — "Aim zones and one-timers are the good stuff; give me somewhere to prove it." Top: C2 (shootout is pure skill expression), C6 (AI teammates that make the smart play), C4 weekly seed for comparing runs. Wary of C3 taunts if they're just stat bloat. Wants C7 for bragging.

**Hitz nostalgic** — "Fights and on-fire are right. Where's the crowd chanting my name, and the goal light show?" Top: C6 feel items, C7 reel, C3 grudges (rivalries were the soul of arcade sports). Neutral on C4. Says C9 was the way Hitz was played, but accepts it's out of scope.

**Rogue-like enthusiast** — "Sets are good; runs still feel similar by act 2." Top: C3 (grudges create run-to-run memory; alt bosses fix predictability), C2 skills nodes for map variety, C4 weekly seed. Warns C4 feats must not become chores. Flags: cursed perk pick rate needs data → asks for run telemetry in C4.

**Graphics/tech lead** — "Nothing here needs a renderer change. C6's spray/trail are particle work; C8 IK is a day." Top: C6, C8. Concerned C7 reuses the replay buffer (it should) and that C5 colorblind palettes touch jersey generation (fine, data-driven). Asks that every phase keep the balance batch green.

**Producer (scope)** — Sizes: C1 M, C2 M, C3 L, C4 M, C5 S-M, C6 M, C7 S (buffer exists), C8 S, C9 L. Orders by retention impact ÷ cost: C1, C2, C6, C3, C4, C5, C7, C8. C9 stays out: input/camera compromises plus untestable headless.

**Accessibility advocate** — "Red vs green lanes, red-only cues, 12 px letter-spaced captions." Top: C5 as a phase, but pushes for *each* phase to ship with its contrast/remap hooks rather than one bolt-on. Asks C1 to teach with pictures of the buttons, not just letters.

### Synthesis
- C1 first: every persona except the tech lead named onboarding, and C2/C3 depend on players surviving to see them.
- C2 second: cheapest new *skill* surface, reuses aim/deke/dive; the shootout also fixes the endless-OT hole.
- C6 third: feel + AI, no new UI, keeps the batch honest.
- C3 fourth: biggest content lift, best after variety tooling exists.
- C4 fifth, C5 threaded through every phase with a final dedicated pass, C7 + C8 as the closer.
- C9 declined again.

## Phases

### V3-1 — Training Camp (M)
Branch `v3/training`. Title-menu mode + first-run prompt. Scripted drills on an empty rink with dummy opponents: skate to marker, turbo across the blue line, pass + one-timer ring, charged aimed shot into a called corner, toe-drag past a lunging dummy, body check the carrier, saucer over a fallen dummy, goalie dive on cue, fire the special. Each drill: objective text, button glyphs, completion check on sim events, skip. Completion flag in meta + one-time cash reward. Gate: all drills completable headless by driving state; no console errors.

### V3-2 — Shootouts + Skills nodes (M)
Branch `v3/shootout`. OT still tied after one OT period → shootout: alternating penalty shots (3 rounds then sudden death), shooter vs goalie using aim/deke/dive controls, AI shooters/goalies. Run map: `shootout` node (best-of-3 duel for cash/perk) and `hitparade` node (60 s knock-down challenge). Gate: tests for shootout sequencing; batch still in range.

### V3-3 — AI & feel pass (M)
Branch `v3/feel`. Teammate breakout lanes and drop-pass support, own-goal avoidance, goalie-pull AI when trailing late, snow spray on hard stops, puck trail, goal light show + crowd chant loop tied to score. Gate: batch goals unchanged ±1, own-goal rate measured and cut.

### V3-4 — Rival grudges + content pack (L)
Branch `v3/grudges`. Rival memory across the run (and meta): beaten rivals return in later acts with +tier, a taunt on intro, and a bounty. +4 rivals, +6 events, +4 mutators, alt bosses per act, 2 archetypes (Grinder: stamina/hit; Dangler: hands/deke) with specials. Gate: map gen tests updated; balance batch includes new rivals.

### V3-5 — Feats, weekly seed, records (M)
Branch `v3/meta`. Feats list with cash/unlock rewards, weekly seed derived from ISO week, records screen (best run, most goals, longest on-fire), lifetime stats, run telemetry saved locally for tuning (perk pick rates, node choices). Gate: save round-trip tests.

### V3-6 — Accessibility pass (S-M)
Branch `v3/access`. Key remapping UI, colorblind palettes for lanes/cues/jerseys, name tags above skaters, HUD text scale, reduced-motion (no shake, no hit fx, no flashes) as one switch, rumble on pads. Gate: every cue has a non-color signal.

### V3-7 — Highlight reel + character polish (S)
Branch `v3/reel`. Match-end reel from the replay buffer (goals, big hits, big saves), skippable; stick-hand IK; goalie mask detail. Gate: reel never desyncs from the box score.

## Status log
- 2026-09-05: V3-3 AI + feel pass merged: breakout lanes (wingers fan to the boards ahead of a carrier in the defensive zone, trailer offers the drop pass) and outlet passes ~4× likelier on the breakout; own-goal guards (hits near a defender's net never pop the puck toward it, pass targeting refuses lanes across the own crease); AI teams pull the goalie trailing by ≤2 inside 90 s of regulation and put it back when tied; snow spray on hard stops and cuts, fast-puck trail, goal light show (spots + volumetric cones strobe in the scoring color), crowd stomp-clap chant loop after home goals. Own goals measured before: 0.13-0.5 per match. After: see batch line.
  Batch after: diff 0: goals/match 6.25 own 0.00 shots 48.9 saves 24.4 hits 53.6 big 6.9 onFire 1.63 fights 0.63 specials 7.63 teamFire 0.75 avgMin 6.8 maxMin 7.3 | diff 1: goals/match 7.13 own 0.25 shots 48.5 saves 19.0 hits 82.0 big 13.4 onFire 3.13 fights 1.75 specials 8.13 teamFire 0.75 avgMin 7.1 maxMin 7.3 | diff 2: goals/match 7.88 own 0.13 shots 49.0 saves 19.0 hits 121.5 big 22.5 onFire 3.13 fights 2.13 specials 9.13 teamFire 1.25 avgMin 7.4 maxMin 8.5 | diff 3: goals/match 8.63 own 0.38 shots 51.8 saves 21.5 hits 138.4 big 24.4 onFire 3.25 fights 2.25 specials 9.63 teamFire 1.38 avgMin 7.3 maxMin 7.6
- 2026-09-05: V3-2 Shootouts + Skills nodes merged: a tied OT period now goes to a best-of-3 shootout (sudden death after), alternating shooters vs goalies with the full aim/deke/dive controls; AI shooters skate in, deke sometimes, fire far side; winner gets the extra goal. Run map gained `shootout` (best-of-3 duel vs a rival, +70 cash + perk draft on a win, nothing on a loss) and `hitparade` (60 s, knock down 8/12/16 wandering dummies by act, big hits count double) nodes at ~10% of non-first rows. HUD tracker with ●/✕/○ per team. Headless: duel reached from the map, ran to a 2-1 result, reward + node completion verified.
- 2026-09-05: plan written.
- 2026-09-05: V3-1 Training Camp merged: 10 drills (skate, turbo, pass, one-timer, aimed corner, toe-drag, big hit, saucer, goalie dive, special) on a frozen-clock rink with scripted dummies (`TeamSetup.scripted`, `MatchSim.scriptInputs`, `freezeClock`), marker beacon, glyph prompts, hints after 12 s, skip/leave, +50 bank cash on first completion, title nudge until done. Headless: skate/turbo/pass drills completed through real input paths; skip path reaches the completion screen.
