import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { collidePuckSkaters } from '../../src/sim/blocks';
import { stepGoalie, resetGoalieMem } from '../../src/sim/goalie';
import { givePuck } from '../../src/sim/puck';
import { makeSkater } from '../../src/sim/skater';
import { generateGoalie } from '../../src/run/roster';
import { buildRivalRoster, RIVALS } from '../../src/run/teams';
import { migrateRun } from '../../src/core/save';
import { newRun, serializeRun } from '../../src/run/runState';
import { CAPTAINS } from '../../src/run/meta';
import { Rng } from '../../src/core/rng';
import { stats } from '../../src/sim/fixtures';
import { EMPTY_INPUT, type Input, type MatchEvent } from '../../src/sim/types';

function sim(diffB = 1, seed = 5) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  const s = new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: true, difficulty: 1 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: diffB },
    ],
    defaultMatchMods(),
    seed,
  );
  s.st.phase = 'play';
  return s;
}
const fixedRng = (v: number) => ({ next: () => v }) as unknown as Rng;

/** a free shot flying in -x at the given speed, about to hit B1 standing at the origin */
function shotAt(s: MatchSim, speed = 20, z = 0.2) {
  const st = s.st;
  const b1 = st.skaters['B1'];
  b1.pos = { x: 0, y: 0 };
  b1.vel = { x: 0, y: 0 };
  for (const id of st.order) if (id !== 'B1') st.skaters[id].pos = { x: 15, y: 15 };
  st.puck.owner = null;
  st.puck.pos = { x: b1.radius + 0.05, y: 0 };
  st.puck.vel = { x: -speed, y: 0 };
  st.puck.z = z;
  st.puck.vz = 0;
  st.puck.isShot = true;
  st.puck.lastTouch = 'A1';
  st.puck.lastTouchTeam = 0;
  st.puck.freeTime = 1;
  return b1;
}

describe('shot blocking', () => {
  it('a clean block kills the puck and credits the blocker', () => {
    const s = sim();
    const b1 = shotAt(s);
    const ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0), ev);
    const p = s.st.puck;
    expect(Math.hypot(p.vel.x, p.vel.y)).toBeLessThan(4);
    expect(p.isShot).toBe(false);
    expect(p.lastTouch).toBe('B1');
    expect(b1.blocks).toBe(1);
    const e = ev.find((x) => x.type === 'shotBlock') as Extract<MatchEvent, { type: 'shotBlock' }>;
    expect(e.clean).toBe(true);
    expect(e.shooter).toBe('A1');
  });
  it('a deflection keeps the puck live at reduced speed and sends it away from the body', () => {
    const s = sim();
    shotAt(s);
    const ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0.99), ev);
    const p = s.st.puck;
    const sp = Math.hypot(p.vel.x, p.vel.y);
    expect(sp).toBeGreaterThan(8);
    expect(sp).toBeLessThan(14);
    expect(p.vel.x).toBeGreaterThan(0); // bounced back toward the shooter's side
    expect(p.isShot).toBe(true);
    expect((ev.find((x) => x.type === 'shotBlock') as { clean: boolean }).clean).toBe(false);
  });
  it('the shooter does not block their own shot right after release', () => {
    const s = sim();
    shotAt(s);
    s.st.puck.lastTouch = 'B1';
    s.st.puck.freeTime = 0.05;
    const ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0), ev);
    expect(ev.length).toBe(0);
    expect(s.st.puck.vel.x).toBe(-20);
  });
  it('high shots sail over upright skaters', () => {
    const s = sim();
    shotAt(s, 20, 1.3);
    const ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0), ev);
    expect(ev.length).toBe(0);
  });
  it('hard shots sting low-balance blockers but not sturdy ones', () => {
    const s = sim();
    const b1 = shotAt(s, 26);
    b1.stats.balance = 4;
    let ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0), ev);
    expect(ev.some((e) => e.type === 'sting')).toBe(true);
    expect(b1.stumble).toBeGreaterThan(0);
    const s2 = sim();
    const b = shotAt(s2, 26);
    b.stats.balance = 9;
    ev = [];
    collidePuckSkaters(s2.st, fixedRng(0), ev);
    expect(ev.some((e) => e.type === 'sting')).toBe(false);
  });
  it('fallen bodies bounce slow pucks without a block credit', () => {
    const s = sim();
    const b1 = shotAt(s, 5);
    s.st.puck.isShot = false;
    b1.knockdown = 1;
    const ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0), ev);
    expect(ev.length).toBe(0);
    expect(s.st.puck.vel.x).toBeGreaterThan(0);
    expect(s.st.puck.lastTouch).toBe('A1');
    expect(b1.blocks).toBe(0);
  });
  it('upright skaters leave slow pucks to the pickup logic', () => {
    const s = sim();
    shotAt(s, 5);
    s.st.puck.isShot = false;
    const ev: MatchEvent[] = [];
    collidePuckSkaters(s.st, fixedRng(0), ev);
    expect(s.st.puck.vel.x).toBe(-5);
  });
});

describe('AI lane stepping', () => {
  it('a brutal defender steps between a winding-up carrier and its goal', () => {
    const s = sim(3, 9);
    const st = s.st;
    const a1 = st.skaters['A1'];
    a1.pos = { x: 12, y: 4 };
    givePuck(st, a1, []);
    a1.charging = true;
    const b2 = st.skaters['B2'];
    b2.pos = { x: 14, y: -6 };
    const inp = (o: Partial<Input>): Input => ({ ...EMPTY_INPUT, move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, ...o });
    s.scriptInputs.set('A1', inp({ shoot: true }));
    s.freezeClock = true;
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      s.step();
      a1.charging = true;
      for (const id of st.teams[1].skaters) {
        const br = s.brains[1].brain(id);
        const t = br.target;
        // lane point sits ~2.6 m from the carrier toward +x goal (team 0 attacks +x)
        if (t.x > a1.pos.x + 1.5 && t.x < a1.pos.x + 4 && Math.abs(t.y - a1.pos.y) < 2.5) found = true;
      }
    }
    expect(found).toBe(true);
  });
});

describe('goalie styles', () => {
  it('goalies default to butterfly; skaters carry no style', () => {
    const g = makeSkater('g', 'G', 0, stats(5, 3, 6, 4, 8, 6), 'goalie', true);
    expect(g.goalieStyle).toBe('butterfly');
    const sk = makeSkater('s', 'S', 0, stats(6, 6, 6, 6, 6, 6), 'sniper', false);
    expect(sk.goalieStyle).toBeNull();
  });
  it('generated goalies get one of the three styles and rivals can pin one', () => {
    const rng = new Rng(4);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(generateGoalie(rng).goalieStyle!);
    expect(seen.size).toBe(3);
    const walls = RIVALS.find((r) => r.id === 'walls')!;
    expect(buildRivalRoster(new Rng(1), walls, 0).goalie.goalieStyle).toBe('standup');
  });
  it('puck-handlers move the puck out faster than butterfly goalies', () => {
    const hold = (style: 'handler' | 'butterfly') => {
      const s = sim();
      const st = s.st;
      const g = st.skaters[st.teams[1].goalie!];
      g.goalieStyle = style;
      resetGoalieMem(g);
      givePuck(st, g, []);
      let t = 0;
      const ev: MatchEvent[] = [];
      while (g.hasPuck && t < 2) {
        stepGoalie(st, g, 1 / 60, new Rng(1), ev);
        t += 1 / 60;
      }
      return t;
    };
    expect(hold('handler')).toBeLessThan(hold('butterfly'));
  });
  it('old saves get a goalie style', () => {
    const run = newRun('style-seed', CAPTAINS[0], 0, []);
    const raw = JSON.parse(serializeRun(run));
    delete raw.goalie.goalieStyle;
    const back = migrateRun(raw)!;
    expect(back.goalie.goalieStyle).toBe('butterfly');
  });
});

describe('goalie freeze', () => {
  it('a pressured goalie covers up and the play restarts at the nearest dot', () => {
    const s = sim();
    const st = s.st;
    const g = st.skaters[st.teams[1].goalie!];
    g.goalieStyle = 'butterfly';
    resetGoalieMem(g);
    givePuck(st, g, []);
    st.skaters['A1'].pos = { x: g.pos.x - 1.2, y: g.pos.y + 0.5 };
    st.skaters['A2'].pos = { x: g.pos.x - 1.2, y: g.pos.y - 0.5 };
    const ev: MatchEvent[] = [];
    for (let i = 0; i < 90 && st.phase === 'play'; i++) stepGoalie(st, g, 1 / 60, new Rng(1), ev);
    expect(ev.some((e) => e.type === 'freeze')).toBe(true);
    expect(st.phase).toBe('faceoff');
    expect(Math.abs(st.faceoffSpot.x)).toBeGreaterThan(5);
    expect(ev.some((e) => e.type === 'pass')).toBe(false);
  });
  it('one forechecker in the face gets the puck rimmed around the boards, not a whistle', () => {
    const s = sim();
    const st = s.st;
    const g = st.skaters[st.teams[1].goalie!];
    resetGoalieMem(g);
    givePuck(st, g, []);
    for (const id of st.teams[0].skaters) st.skaters[id].pos = { x: 0, y: 0 };
    st.skaters['A1'].pos = { x: g.pos.x - 1.2, y: g.pos.y + 0.8 };
    const ev: MatchEvent[] = [];
    for (let i = 0; i < 90 && g.hasPuck; i++) stepGoalie(st, g, 1 / 60, new Rng(1), ev);
    expect(ev.some((e) => e.type === 'freeze')).toBe(false);
    expect(ev.some((e) => e.type === 'pass')).toBe(true);
    expect(st.phase).toBe('play');
    expect(st.puck.vel.y).toBeLessThan(0); // away from the forechecker's side
    expect(Math.hypot(st.puck.vel.x, st.puck.vel.y)).toBeGreaterThan(12);
  });
  it('an unpressured goalie still passes out', () => {
    const s = sim();
    const st = s.st;
    const g = st.skaters[st.teams[1].goalie!];
    resetGoalieMem(g);
    givePuck(st, g, []);
    for (const id of st.teams[0].skaters) st.skaters[id].pos = { x: 0, y: 0 };
    const ev: MatchEvent[] = [];
    for (let i = 0; i < 90 && g.hasPuck; i++) stepGoalie(st, g, 1 / 60, new Rng(1), ev);
    expect(ev.some((e) => e.type === 'pass')).toBe(true);
    expect(st.phase).toBe('play');
  });
});
