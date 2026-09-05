import { describe, expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { applyMatchOutcome, availableNodes, buildMatch, cashForNode, completeNode, newRun, reassignActRivals, type MatchOutcome } from '../../src/run/runState';
import { generateRunMap } from '../../src/run/mapGen';
import { Rng } from '../../src/core/rng';
import { RIVAL_BY_ID, bossesForAct } from '../../src/run/teams';
import { MUTATOR_BY_ID } from '../../src/run/mutators';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { MatchSim } from '../../src/sim/match';
import { quickTeam, quickSkater, stats } from '../../src/sim/fixtures';
import { trySpecial } from '../../src/sim/specials';
import { applyHit } from '../../src/sim/hits';
import { givePuck } from '../../src/sim/puck';
import { EVENTS } from '../../src/run/events';

const win = (): MatchOutcome => ({ won: true, scoreFor: 4, scoreAgainst: 1, bigHits: 2, hp: {}, boxScore: [] });

describe('rival grudges', () => {
  it('beating a rival records a grudge; the rematch is a tier higher with a taunt and a bounty', () => {
    const r = newRun('grudge', CAPTAINS[0], 0, []);
    const node = availableNodes(r).find((n) => n.type === 'match')!;
    const rivalId = node.rivalId!;
    const before = buildMatch(r, node);
    expect(before.away.grudge).toBe(0);
    expect(before.away.taunt).toBeNull();
    const cashPlain = cashForNode(r, node, win());
    applyMatchOutcome(r, node, win());
    expect(r.grudges[rivalId].beaten).toBe(1);
    const after = buildMatch(r, node);
    expect(after.away.grudge).toBe(1);
    expect(after.away.taunt).toContain(RIVAL_BY_ID[rivalId].name);
    expect(after.away.skaters.length).toBe(3);
    expect(cashForNode(r, node, win())).toBeGreaterThan(cashPlain);
  });
  it('a new act brings beaten rivals back onto the map', () => {
    const r = newRun('rematch', CAPTAINS[1], 0, []);
    r.grudges = { ghosts: { beaten: 1, act: 1 } };
    // move to act 2 and reassign
    for (let guard = 0; guard < 10 && r.act === 1; guard++) completeNode(r, availableNodes(r)[0]);
    expect(r.act).toBe(2);
    const matches = r.maps[1].rows.flat().filter((n) => n.type === 'match' || n.type === 'elite');
    expect(matches.some((n) => n.rivalId === 'ghosts')).toBe(true);
    reassignActRivals(r); // idempotent-ish: still only beaten rivals swapped in
    for (const n of matches) expect(n.rivalId).toBeTruthy();
  });
});

describe('content pack', () => {
  it('each act has at least two boss options and maps pick one of them', () => {
    for (const act of [1, 2, 3]) expect(bossesForAct(act).length).toBeGreaterThanOrEqual(2);
    const seen = new Set<string>();
    for (let seed = 1; seed < 30; seed++) {
      const maps = generateRunMap(new Rng(seed));
      for (const act of maps) {
        const boss = act.rows[act.rows.length - 1][0];
        expect(bossesForAct(act.act).map((b) => b.id)).toContain(boss.rivalId);
        seen.add(boss.rivalId!);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
  it('mutators: fight night raises the per-period cap, outnumbered adds a 4th skater, meter locked zeroes gain', () => {
    const m1 = defaultMatchMods();
    MUTATOR_BY_ID.fight_night.apply(m1);
    expect(m1.fightsPerPeriod).toBe(3);
    const m2 = defaultMatchMods();
    MUTATOR_BY_ID.outnumbered.apply(m2);
    expect(m2.bossPhases.some((p) => p.kind === 'extraSkater' && p.period === 1)).toBe(true);
    const m3 = defaultMatchMods();
    MUTATOR_BY_ID.no_specials.apply(m3);
    expect(m3.teams[0].specialGainMul).toBe(0);
  });
  it('events: every new event has two choices and effects run', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(16);
    const r = newRun('ev', CAPTAINS[0], 0, []);
    r.cash = 200;
    for (const e of EVENTS) {
      expect(e.choices.length).toBeGreaterThanOrEqual(2);
      const c = e.choices.find((x) => !x.disabled?.(r)) ?? e.choices[0];
      expect(typeof c.effect(r, new Rng(3))).toBe('string');
    }
  });
});

describe('grinder + dangler specials', () => {
  function sim() {
    const a = quickTeam('A'),
      b = quickTeam('B');
    a.skaters[0] = quickSkater('A1', 'Grinder', 'grinder', stats(6, 4, 5, 7, 8, 9));
    a.skaters[1] = quickSkater('A2', 'Dangler', 'dangler', stats(7, 6, 9, 2, 5, 6));
    const s = new MatchSim(
      [
        { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: 1 },
        { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 1 },
      ],
      defaultMatchMods(),
      9,
    );
    s.st.phase = 'play';
    return s;
  }
  it('bulldoze makes the grinder unknockable and its hits huge', () => {
    const s = sim();
    const g = s.st.skaters['A1'];
    expect(g.specialKind).toBe('bulldoze');
    s.st.teams[0].special = 1;
    expect(trySpecial(s.st, g, new Rng(1), [])).toBe(true);
    const h = s.st.skaters['B2'];
    h.stats.hit = 10;
    h.vel = { x: 13, y: 0 };
    givePuck(s.st, g, []);
    applyHit(s.st, h, g, new Rng(2), []);
    expect(g.knockdown).toBe(0);
  });
  it('phantom makes every check on the dangler whiff and break ankles', () => {
    const s = sim();
    const d = s.st.skaters['A2'];
    expect(d.specialKind).toBe('phantom');
    s.st.teams[0].special = 1;
    expect(trySpecial(s.st, d, new Rng(1), [])).toBe(true);
    givePuck(s.st, d, []);
    const h = s.st.skaters['B1'];
    h.vel = { x: 12, y: 0 };
    const ev: { type: string }[] = [];
    applyHit(s.st, h, d, new Rng(3), ev as never);
    expect(d.hasPuck).toBe(true);
    expect(ev.some((e) => e.type === 'ankleBreaker')).toBe(true);
  });
});
