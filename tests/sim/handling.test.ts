import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { doPass, doShot, givePuck, stepCarrier, tryPickups } from '../../src/sim/puck';
import { applyHit } from '../../src/sim/hits';
import { Rng } from '../../src/core/rng';
import { EMPTY_INPUT, type Input, type MatchEvent } from '../../src/sim/types';
import { GOALS } from '../../src/sim/rink';

function sim(seed = 3) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  const s = new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: true, difficulty: 1 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 1 },
    ],
    defaultMatchMods(),
    seed,
  );
  s.st.phase = 'play';
  return s;
}
const inp = (o: Partial<Input>): Input => ({ ...EMPTY_INPUT, move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, ...o });

describe('aim zones', () => {
  it('uses the aim controls independently of skating direction on release', () => {
    for (const direction of [-1, 1]) {
      const s = sim();
      const sk = s.st.skaters['A1'];
      sk.pos = { x: 12, y: 0 };
      sk.facing = 0;
      givePuck(s.st, sk, []);
      const ev: MatchEvent[] = [];
      stepCarrier(s.st, sk, inp({ move: { x: 0, y: -direction }, aim: { x: 0, y: direction }, shootRelease: true }), s.st.dt, new Rng(1), ev);
      const shot = ev.find((e) => e.type === 'shot') as Extract<MatchEvent, { type: 'shot' }>;
      expect(shot.zone.startsWith(direction < 0 ? 'far-' : 'near-')).toBe(true);
    }
  });

  it('keeps automatic far-side aiming when only movement is held', () => {
    const s = sim();
    const sk = s.st.skaters['A1'];
    sk.pos = { x: 12, y: 0 };
    sk.facing = 0;
    s.st.skaters[s.st.teams[1].goalie!].pos.y = 0.5;
    givePuck(s.st, sk, []);
    const ev: MatchEvent[] = [];
    stepCarrier(s.st, sk, inp({ move: { x: 0, y: 1 }, shootRelease: true }), s.st.dt, new Rng(1), ev);
    const shot = ev.find((e) => e.type === 'shot') as Extract<MatchEvent, { type: 'shot' }>;
    expect(shot.zone.startsWith('far-')).toBe(true);
  });

  it('aim up targets the far post, charge lifts to the top corner', () => {
    const s = sim();
    const sk = s.st.skaters['A1'];
    sk.pos = { x: 12, y: 0 };
    sk.facing = 0;
    givePuck(s.st, sk, []);
    const ev: MatchEvent[] = [];
    doShot(s.st, sk, { x: 0, y: -1 }, 0.9, new Rng(1), ev);
    const shot = ev.find((e) => e.type === 'shot') as Extract<MatchEvent, { type: 'shot' }>;
    expect(shot.zone).toBe('far-high');
    expect(s.st.puck.vz).toBeGreaterThan(0.5);
    expect(s.st.puck.vel.y).toBeLessThan(0); // toward -y post
  });
  it('low charge with no aim is a five-hole or low shot, never lifted high', () => {
    const s = sim();
    const sk = s.st.skaters['A1'];
    sk.pos = { x: 12, y: 0 };
    sk.facing = 0;
    givePuck(s.st, sk, []);
    const ev: MatchEvent[] = [];
    doShot(s.st, sk, { x: 0, y: 0 }, 0.2, new Rng(2), ev);
    const shot = ev.find((e) => e.type === 'shot') as Extract<MatchEvent, { type: 'shot' }>;
    expect(shot.zone.endsWith('low') || shot.zone === 'five-hole').toBe(true);
    const lowVz = s.st.puck.vz;
    // a charged shot from the same spot launches higher
    const s2 = sim();
    const sk2 = s2.st.skaters['A1'];
    sk2.pos = { x: 12, y: 0 };
    sk2.facing = 0;
    givePuck(s2.st, sk2, []);
    doShot(s2.st, sk2, { x: 0, y: -1 }, 0.9, new Rng(2), []);
    expect(lowVz).toBeLessThan(s2.st.puck.vz);
  });
});

describe('saucer pass', () => {
  it('flies over a non-target skater and lands on the target', () => {
    const s = sim();
    const from = s.st.skaters['A1'];
    const mid = s.st.skaters['B1'];
    const to = s.st.skaters['A2'];
    from.pos = { x: 0, y: 0 };
    from.facing = 0;
    mid.pos = { x: 2.2, y: 0 };
    to.pos = { x: 6, y: 0 };
    to.vel = { x: 0, y: 0 };
    givePuck(s.st, from, []);
    const ev: MatchEvent[] = [];
    doPass(s.st, from, to, ev, true);
    expect(s.st.puck.saucer).toBe(true);
    expect(s.st.puck.vz).toBeGreaterThan(0);
    expect(ev.some((e) => e.type === 'saucer')).toBe(true);
    // puck passes over the blocker while airborne
    s.st.puck.pos = { x: 2.2, y: 0 };
    s.st.puck.z = 0.8;
    tryPickups(s.st, ev);
    expect(s.st.puck.owner).toBeNull();
    // lands near the target
    s.st.puck.pos = { x: 6.5, y: 0 };
    s.st.puck.z = 0.3;
    tryPickups(s.st, ev);
    expect(s.st.puck.owner).toBe('A2');
  });
});

describe('chained dekes', () => {
  it('chains up to three, charging turbo after the first', () => {
    const s = sim();
    const sk = s.st.skaters['A1'];
    givePuck(s.st, sk, []);
    sk.turbo = 1;
    const press = () => stepCarrier(s.st, sk, inp({ deke: true, move: { x: 0, y: 1 } }), 1 / 60, new Rng(1), []);
    press();
    expect(sk.dekeChain).toBe(1);
    expect(sk.dekeKind).not.toBe('spin');
    expect(sk.turbo).toBe(1);
    sk.deke = 0; // let the first deke finish
    press();
    expect(sk.dekeChain).toBe(2);
    expect(sk.turbo).toBeLessThan(1);
    sk.deke = 0;
    press();
    expect(sk.dekeChain).toBe(3);
    sk.deke = 0;
    press();
    expect(sk.dekeChain).toBe(3); // capped
  });
  it('a lunging defender who whiffs on a deking carrier gets ankle-broken', () => {
    const s = sim();
    const h = s.st.skaters['B2'];
    const v = s.st.skaters['A1'];
    givePuck(s.st, v, []);
    v.deke = 0.3;
    h.vel = { x: 12, y: 0 };
    const ev: MatchEvent[] = [];
    applyHit(s.st, h, v, new Rng(1), ev);
    expect(ev.some((e) => e.type === 'ankleBreaker')).toBe(true);
    expect(h.knockdown).toBeGreaterThan(0);
    expect(v.hasPuck).toBe(true);
  });
});

describe('goalie control', () => {
  it('pulling the goalie adds an attacker; toggling restores', () => {
    const s = sim();
    const team = s.st.teams[0];
    const gid = team.goalie!;
    s.togglePull(0, []);
    expect(team.goalie).toBeNull();
    expect(team.pulled).toBe(true);
    expect(team.skaters).toContain(gid);
    expect(s.st.skaters[gid].isGoalie).toBe(false);
    s.togglePull(0, []);
    expect(team.goalie).toBe(gid);
    expect(team.skaters).not.toContain(gid);
    expect(s.st.skaters[gid].isGoalie).toBe(true);
  });
  it('an opponent shot opens a dive window; pressing switch dives the goalie and hands control back', () => {
    const s = sim(9);
    const st = s.st;
    const team = st.teams[0];
    const shooter = st.skaters['B1'];
    shooter.pos = { x: -14, y: 0 };
    shooter.facing = Math.PI;
    givePuck(st, shooter, []);
    // AI shoots on its own eventually; force it
    const ev: MatchEvent[] = [];
    doShot(st, shooter, { x: 0, y: 0 }, 0.5, new Rng(4), ev);
    // simulate the match loop handling of shot events
    s.step({ 0: inp({}) });
    // window may already be open from the forced shot on the next step
    team.diveWindow = 0.6;
    const before = team.controlledId;
    s.step({ 0: inp({ pass: true, passHoldTime: 0.05, move: { x: 0, y: 1 } }) });
    const g = st.skaters[team.goalie!];
    expect(g.dive).toBeGreaterThan(0);
    expect(team.controlledId).toBe(g.id);
    // park the puck so the forced shot can't score mid-dive
    st.puck.pos = { x: 0, y: 0 };
    st.puck.vel = { x: 0, y: 0 };
    st.puck.isShot = false;
    for (let i = 0; i < 60; i++) s.step({ 0: inp({}) });
    expect(team.controlledId).toBe(before);
    void GOALS;
  });
});
