import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { offerFight } from '../../src/sim/fight';
import { trySpecial, stepTeamFire } from '../../src/sim/specials';
import { givePuck } from '../../src/sim/puck';
import { Rng } from '../../src/core/rng';
import { EMPTY_INPUT, type Input, type MatchEvent } from '../../src/sim/types';
import { FIGHT, SPECIAL } from '../../src/sim/constants';

function sim(seed = 5, humanA = true) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  const s = new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: humanA, difficulty: 1 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 1 },
    ],
    defaultMatchMods(),
    seed,
  );
  s.st.phase = 'play';
  return s;
}
const inp = (o: Partial<Input>): Input => ({ ...EMPTY_INPUT, move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, ...o });

describe('fights', () => {
  it('offer freezes play; declining resumes it', () => {
    const s = sim();
    const ev: MatchEvent[] = [];
    offerFight(s.st, 'A2', 'B1', ev);
    expect(s.st.phase).toBe('fight');
    expect(ev.some((e) => e.type === 'fightOffer')).toBe(true);
    // human declines with pass
    s.step({ 0: inp({ pass: true }) });
    for (let i = 0; i < 90 && s.st.phase === 'fight'; i++) s.step({ 0: inp({}) });
    expect(s.st.phase).toBe('play');
    expect(s.st.fight).toBeNull();
  });
  it('accepting starts the duel; correct cue presses land punches; a KO ejects the loser', () => {
    const s = sim(11);
    const st = s.st;
    // make the AI always accept
    st.skaters['B1'].temper = 1;
    st.skaters['B1'].stats.hit = 10;
    offerFight(st, 'A2', 'B1', []);
    let started = false;
    for (let i = 0; i < 120 && !started; i++) {
      const ev = s.step({ 0: inp({ check: true }) });
      if (ev.some((e) => e.type === 'fightStart')) started = true;
    }
    expect(started).toBe(true);
    expect(st.teams[0].controlledId).toBe('A2');
    // play the duel: answer every cue targeted at A2 correctly, instantly
    let hits = 0;
    let ended: MatchEvent | undefined;
    for (let i = 0; i < 60 * 12 && !ended; i++) {
      const f = st.fight!;
      let press: Partial<Input> = {};
      if (f.stage === 'duel' && f.cue && f.cue.target === 0 && !f.cue.done) {
        press = f.cue.kind === 'high' ? { check: true, shoot: true } : f.cue.kind === 'low' ? { deke: true } : f.cue.kind === 'feint' ? { pass: true } : { shoot: true };
      }
      const ev = s.step({ 0: inp(press) });
      for (const e of ev) {
        if (e.type === 'fightHit' && e.attacker === 'A2') hits++;
        if (e.type === 'fightEnd') ended = e;
      }
    }
    expect(hits).toBeGreaterThan(0);
    expect(ended && ended.type === 'fightEnd').toBe(true);
    const end = ended as Extract<MatchEvent, { type: 'fightEnd' }>;
    expect(end.a).toBe('A2');
    if (end.loser) {
      // after the result stage the loser is off the ice until the period break
      for (let i = 0; i < 60 * 4; i++) s.step({ 0: inp({}) });
      const loserTeam = st.teams[st.skaters[end.loser].team];
      expect(loserTeam.skaters).not.toContain(end.loser);
      expect(st.skaters[end.loser].ejected).toBe(true);
      expect(st.skaters[end.winner!].onFire).toBeGreaterThan(0);
    }
  });
  it('noFights mod never offers', () => {
    const mods = defaultMatchMods();
    mods.noFights = true;
    const a = quickTeam('A'),
      b = quickTeam('B');
    const s = new MatchSim(
      [
        { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: 3 },
        { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 3 },
      ],
      mods,
      2,
    );
    let offers = 0;
    for (let i = 0; i < 60 * 60 * 3 && s.st.phase !== 'over'; i++) for (const e of s.step()) if (e.type === 'fightOffer') offers++;
    expect(offers).toBe(0);
    void FIGHT;
  });
});

describe('specials', () => {
  it('meter must be full; laser makes the next shot unsavable; shockwave floors nearby opponents', () => {
    const s = sim();
    const st = s.st;
    const sniper = st.skaters['A1'];
    expect(trySpecial(st, sniper, new Rng(1), [])).toBe(false);
    st.teams[0].special = 1;
    const ev: MatchEvent[] = [];
    expect(trySpecial(st, sniper, new Rng(1), ev)).toBe(true);
    expect(sniper.specialTimer).toBeGreaterThan(0);
    expect(st.teams[0].special).toBe(0);
    expect(ev.some((e) => e.type === 'special' && e.kind === 'laser')).toBe(true);
    // enforcer shockwave
    const enf = st.skaters['A2'];
    const o1 = st.skaters['B1'],
      o2 = st.skaters['B2'];
    enf.pos = { x: 0, y: 0 };
    o1.pos = { x: 2, y: 0 };
    o2.pos = { x: 0, y: -2.5 };
    givePuck(st, o1, []);
    st.teams[0].special = 1;
    const ev2: MatchEvent[] = [];
    expect(trySpecial(st, enf, new Rng(2), ev2)).toBe(true);
    expect(o1.knockdown).toBeGreaterThan(0);
    expect(o2.knockdown).toBeGreaterThan(0);
    expect(st.puck.owner).toBeNull();
    void SPECIAL;
  });
  it('blink pass gives the puck to a teammate with an extended perfect window', () => {
    const s = sim();
    const st = s.st;
    const pm = st.skaters['A3'];
    pm.specialKind = 'blink';
    givePuck(st, pm, []);
    st.teams[0].special = 1;
    const ev: MatchEvent[] = [];
    expect(trySpecial(st, pm, new Rng(3), ev)).toBe(true);
    expect(st.puck.owner).not.toBe(pm.id);
    const receiver = st.skaters[st.puck.owner!];
    expect(receiver.team).toBe(0);
    expect(receiver.perfectUntil).toBeGreaterThan(st.t);
  });
  it('team fire ignites everyone after three unanswered goals', () => {
    const s = sim();
    const ev: MatchEvent[] = [];
    stepTeamFire(s.st, 1 / 60, ev, [3, 0]);
    expect(ev.some((e) => e.type === 'teamFire' && e.team === 0)).toBe(true);
    for (const id of s.st.teams[0].skaters) expect(s.st.skaters[id].onFire).toBeGreaterThan(0);
    expect(s.st.teams[0].teamFireCooldown).toBeGreaterThan(0);
  });
});
