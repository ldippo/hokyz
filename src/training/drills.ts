import type { MatchSim } from '../sim/match';
import type { MatchEvent, MatchState, Skater, Vec2 } from '../sim/types';
import { EMPTY_INPUT } from '../sim/types';
import { givePuck } from '../sim/puck';
import { RINK } from '../sim/constants';

export interface DrillCtx {
  sim: MatchSim;
  st: MatchState;
  me: Skater; // controlled human skater
  mate: Skater; // human teammate dummy (AI off, scripted by us)
  dummies: Skater[]; // opponent skaters (scripted)
  goalie: Skater | null; // our goalie
  t: number; // time in drill
  events: MatchEvent[]; // this tick's events
  marker: (pos: Vec2 | null) => void;
}

export interface Drill {
  id: string;
  title: string;
  /** objective text with button glyphs, e.g. "Hold [K] to charge, aim [↑] and score top corner" */
  text: string;
  setup: (c: DrillCtx) => void;
  /** per tick; return true when complete */
  tick: (c: DrillCtx) => boolean;
  /** optional hint after N seconds */
  hint?: string;
}

const place = (s: Skater, x: number, y: number, facing = 0) => {
  s.pos.x = x;
  s.pos.y = y;
  s.vel.x = s.vel.y = 0;
  s.facing = facing;
  s.knockdown = 0;
  s.stumble = 0;
  s.lunge = 0;
  s.hasPuck = false;
};
const park = (c: DrillCtx) => {
  c.dummies.forEach((d, i) => place(d, -20, -8 + i * 6, 0));
  c.sim.scriptInputs.clear();
};
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

export const DRILLS: Drill[] = [
  {
    id: 'skate',
    title: 'SKATE',
    text: 'Skate to the marker. Move with [{up}{left}{down}{right}] or the left stick.',
    setup: (c) => {
      park(c);
      place(c.me, -6, 0, 0);
      place(c.mate, -22, 10);
      c.marker({ x: 6, y: 0 });
    },
    tick: (c) => dist(c.me.pos, { x: 6, y: 0 }) < 1.2,
  },
  {
    id: 'turbo',
    title: 'TURBO',
    text: 'Hold [{turbo}] / [RT] for turbo and cross the far blue line. Watch the meter drain.',
    setup: (c) => {
      place(c.me, -12, 0, 0);
      c.me.turbo = 1;
      c.marker({ x: RINK.blueLineX + 2, y: 0 });
    },
    tick: (c) => c.me.pos.x > RINK.blueLineX && c.me.turboActive,
    hint: 'Turbo only works while moving.',
  },
  {
    id: 'pass',
    title: 'PASS',
    text: 'Tap [{pass}] / [A] to pass to your teammate. Aim with the stick toward them.',
    setup: (c) => {
      place(c.me, 0, 0, 0);
      place(c.mate, 8, -5, Math.PI);
      c.marker(null);
      givePuck(c.st, c.me, []);
    },
    tick: (c) => c.events.some((e) => e.type === 'pass' && e.from === c.me.id) || c.mate.hasPuck,
  },
  {
    id: 'onetimer',
    title: 'ONE-TIMER',
    text: 'Your teammate passes back. Shoot [{shoot}] / [B] while the gold ring is closing for a PERFECT one-timer.',
    setup: (c) => {
      place(c.me, 12, 3, 0);
      place(c.mate, 12, -5, 0.5);
      givePuck(c.st, c.mate, []);
      (c as unknown as { passAt: number }).passAt = c.t + 1.2;
    },
    tick: (c) => {
      const x = c as unknown as { passAt: number; passed?: boolean };
      if (!x.passed && c.t >= x.passAt && c.mate.hasPuck) {
        x.passed = true;
        c.sim.scriptInputs.set(c.mate.id, { ...EMPTY_INPUT, move: { x: 0, y: 1 }, aim: { x: 0, y: 0 }, pass: true, passHoldTime: 0.05 });
      } else c.sim.scriptInputs.delete(c.mate.id);
      return c.events.some((e) => e.type === 'shot' && e.shooter === c.me.id && e.oneTimer);
    },
    hint: 'Shoot the instant the puck arrives. The ring shows the window.',
  },
  {
    id: 'aim',
    title: 'PICK A CORNER',
    text: 'Hold [{shoot}] to charge past 60%, aim [{aimUp}] or [{aimDown}] (right stick) to pick the far or near post, release. Score top corner.',
    setup: (c) => {
      place(c.me, 11, 0, 0);
      givePuck(c.st, c.me, []);
      c.marker(null);
    },
    tick: (c) => {
      if (!c.me.hasPuck && !c.st.puck.owner && c.st.puck.freeTime > 2.5) {
        place(c.me, 11, 0, 0);
        givePuck(c.st, c.me, []);
      }
      return c.events.some((e) => e.type === 'goal' && e.team === 0 && c.st.puck.z > 0.6);
    },
    hint: 'A full charge lifts the puck. Low charge stays on the ice.',
  },
  {
    id: 'deke',
    title: 'TOE DRAG',
    text: 'A defender lunges as you close in. Press [{deke}] / [X] with a direction to drag past him. Break his ankles.',
    setup: (c) => {
      place(c.me, -4, 0, 0);
      givePuck(c.st, c.me, []);
      place(c.dummies[0], 4, 0, Math.PI);
      c.dummies[0].stats.hit = 9;
    },
    tick: (c) => {
      const d = c.dummies[0];
      if (dist(d.pos, c.me.pos) < 3.2 && d.checkCooldown === 0 && d.lunge === 0 && d.knockdown === 0) {
        c.sim.scriptInputs.set(d.id, { ...EMPTY_INPUT, move: { x: c.me.pos.x - d.pos.x, y: c.me.pos.y - d.pos.y }, aim: { x: 0, y: 0 }, check: true });
      } else c.sim.scriptInputs.delete(d.id);
      if (!c.me.hasPuck && !c.st.puck.owner && c.st.puck.freeTime > 2) {
        place(c.me, -4, 0, 0);
        givePuck(c.st, c.me, []);
        place(d, 4, 0, Math.PI);
      }
      return c.events.some((e) => e.type === 'ankleBreaker' && e.skater === c.me.id);
    },
    hint: 'Time it: deke right as he lunges.',
  },
  {
    id: 'check',
    title: 'BIG HIT',
    text: 'Without the puck, press [{shoot}] / [B] to body check. Turbo first for a BIG HIT.',
    setup: (c) => {
      place(c.me, -6, 0, 0);
      c.me.turbo = 1;
      place(c.dummies[0], 3, 0, 0);
      givePuck(c.st, c.dummies[0], []);
      c.dummies[0].stats.balance = 3;
    },
    tick: (c) => {
      const d = c.dummies[0];
      // dummy skates slowly away from you
      c.sim.scriptInputs.set(d.id, { ...EMPTY_INPUT, move: { x: 0.3, y: 0 }, aim: { x: 0, y: 0 } });
      if (d.pos.x > 18) place(d, 3, 0, 0), givePuck(c.st, d, []);
      return c.events.some((e) => e.type === 'hit' && e.hitter === c.me.id && e.victim === d.id && e.big);
    },
    hint: 'Line him up and check from full speed.',
  },
  {
    id: 'block',
    title: 'SHOT BLOCK',
    text: 'No stick needed: skate [{up}][{left}][{down}][{right}] into the lane between the shooter and your net. Block three shots with your body.',
    setup: (c) => {
      place(c.me, -14, 4, Math.PI);
      c.me.stats.balance = Math.max(c.me.stats.balance, 7);
      place(c.dummies[0], -9, 0, Math.PI);
      givePuck(c.st, c.dummies[0], []);
      const x = c as unknown as { shootAt: number; blocks: number };
      x.shootAt = c.t + 2;
      x.blocks = 0;
      c.marker({ x: -12.4, y: 0 });
    },
    tick: (c) => {
      const d = c.dummies[0];
      const x = c as unknown as { shootAt: number; blocks: number };
      if (c.t >= x.shootAt && d.hasPuck) c.sim.scriptInputs.set(d.id, { ...EMPTY_INPUT, move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, shoot: true, shootRelease: true });
      else c.sim.scriptInputs.delete(d.id);
      const p = c.st.puck;
      if (!d.hasPuck && ((p.owner && p.owner !== d.id) || p.freeTime > 2.2)) {
        if (p.owner) c.st.skaters[p.owner].hasPuck = false;
        p.owner = null;
        place(d, -9, 0, Math.PI);
        givePuck(c.st, d, []);
        x.shootAt = c.t + 2;
      }
      if (c.events.some((e) => e.type === 'shotBlock' && e.blocker === c.me.id)) x.blocks++;
      return x.blocks >= 3;
    },
    hint: 'Stand still in the lane; the puck finds you.',
  },
  {
    id: 'saucer',
    title: 'SAUCER PASS',
    text: 'A body is in the lane. Hold [{pass}] / [A] a moment and release to saucer the puck over him to your teammate.',
    setup: (c) => {
      place(c.me, 0, 0, 0);
      place(c.mate, 8, 0, Math.PI);
      place(c.dummies[0], 4, 0, 0);
      c.dummies[0].knockdown = 999;
      givePuck(c.st, c.me, []);
    },
    tick: (c) => {
      c.dummies[0].knockdown = 999;
      if (!c.me.hasPuck && !c.mate.hasPuck && !c.st.puck.owner && c.st.puck.freeTime > 2) {
        place(c.me, 0, 0, 0);
        givePuck(c.st, c.me, []);
      }
      if (c.mate.hasPuck && c.st.puck.saucer === false && (c as unknown as { sauced?: boolean }).sauced) return true;
      if (c.events.some((e) => e.type === 'saucer' && e.from === c.me.id)) (c as unknown as { sauced?: boolean }).sauced = true;
      return c.mate.hasPuck && !!(c as unknown as { sauced?: boolean }).sauced;
    },
    hint: 'Short hold = saucer. A tap is a flat pass.',
  },
  {
    id: 'dive',
    title: 'GOALIE DIVE',
    text: 'The shooter fires. When DIVE! appears, press [{pass}] / [A] plus [{up}]/[{down}] toward the puck side for a BIG SAVE.',
    setup: (c) => {
      place(c.me, -14, 6, Math.PI);
      place(c.dummies[0], -10, 0, Math.PI);
      givePuck(c.st, c.dummies[0], []);
      (c as unknown as { shootAt: number }).shootAt = c.t + 1.5;
    },
    tick: (c) => {
      const d = c.dummies[0];
      const x = c as unknown as { shootAt: number };
      if (c.t >= x.shootAt && d.hasPuck) {
        c.sim.scriptInputs.set(d.id, { ...EMPTY_INPUT, move: { x: 0, y: 0 }, aim: { x: 0, y: -1 }, shoot: true, shootRelease: true });
      } else c.sim.scriptInputs.delete(d.id);
      if (!d.hasPuck && !c.st.puck.owner && c.st.puck.freeTime > 2.5) {
        place(d, -10, 0, Math.PI);
        givePuck(c.st, d, []);
        x.shootAt = c.t + 1.5;
      }
      if (c.st.puck.owner === c.goalie?.id && c.st.puck.freeTime === 0) {
        // goalie froze it: reset
      }
      return c.events.some((e) => e.type === 'bigSave');
    },
    hint: 'Watch the puck: dive to the side it is heading.',
  },
  {
    id: 'special',
    title: 'SPECIAL',
    text: 'Your meter is full. Press [{special}] / [Y] to fire your archetype special.',
    setup: (c) => {
      park(c);
      place(c.me, 4, 0, 0);
      place(c.dummies[0], 6.5, 1, Math.PI);
      place(c.dummies[1], 6.5, -1.5, Math.PI);
      place(c.mate, 14, -4, Math.PI);
      givePuck(c.st, c.me, []);
      c.st.teams[0].special = 1;
    },
    tick: (c) => {
      c.st.teams[0].special = Math.max(c.st.teams[0].special, c.me.specialTimer > 0 ? 0 : 1);
      return c.events.some((e) => e.type === 'special' && e.skater === c.me.id);
    },
  },
];
