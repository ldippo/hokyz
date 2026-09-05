import { Rng } from '../core/rng';
import { TeamBrains } from './ai/teamAI';
import { RULES, SIM_DT } from './constants';
import { stepGoalie } from './goalie';
import { resolveHits, tryStartCheck, trySpinDodge } from './hits';
import { defaultMatchMods } from './modifiers';
import { stepOnFire } from './onfire';
import { collideSkaters, stepPuckPhysics } from './physics';
import { carryPuck, makePuck, setControlled, stepCarrier, tryPickups } from './puck';
import { checkGoal, dropPuck, setupFaceoff } from './rules';
import { makeSkater } from './skater';
import { stepSkater } from './skater';
import { EMPTY_INPUT, type Input, type MatchEvent, type MatchMods, type MatchState, type SkaterDef, type TeamId, type TeamState } from './types';
import { dist } from './vec';
import { GOALIE } from './constants';
import { restoreEjected, stepFight } from './fight';
import { gainSpecial, stepSpecialInputs, stepTeamFire } from './specials';

export interface TeamSetup {
  name: string;
  short: string;
  color: string;
  skaters: SkaterDef[]; // exactly 3
  goalie: SkaterDef | null;
  isHuman: boolean;
  difficulty: number; // 0..3
}

export class MatchSim {
  st: MatchState;
  rng: Rng;
  brains: [TeamBrains, TeamBrains] = [new TeamBrains(), new TeamBrains()];
  mash: [number, number] = [0, 0];
  /** goals scored without reply, per team */
  unanswered: [number, number] = [0, 0];
  private prevInputs: Map<string, Input> = new Map();

  constructor(teams: [TeamSetup, TeamSetup], mods: MatchMods = defaultMatchMods(), seed = 1) {
    this.rng = new Rng(seed);
    const skaters: MatchState['skaters'] = {};
    const order: string[] = [];
    const teamStates = teams.map((t, i): TeamState => {
      const tid = i as TeamId;
      const ids: string[] = [];
      t.skaters.slice(0, 3).forEach((def) => {
        const s = makeSkater(def.id, def.name, tid, def.stats, def.archetype, false, def.hp);
        skaters[s.id] = s;
        order.push(s.id);
        ids.push(s.id);
      });
      let goalie: string | null = null;
      if (t.goalie && !mods.noGoalies) {
        const g = makeSkater(t.goalie.id, t.goalie.name, tid, t.goalie.stats, 'goalie', true, t.goalie.hp);
        skaters[g.id] = g;
        order.push(g.id);
        goalie = g.id;
      }
      return {
        id: tid,
        name: t.name,
        short: t.short,
        color: t.color,
        score: 0,
        skaters: ids,
        goalie,
        switchLock: 0,
        controlledId: null,
        isHuman: t.isHuman,
        difficulty: t.difficulty,
        shotsOnGoal: 0,
        pulled: false,
        diveWindow: 0,
        diveReturnId: null,
        pullLatch: false,
        special: 0,
        brickWall: 0,
        teamFireCooldown: 0,
        ejected: [],
      };
    }) as [TeamState, TeamState];

    this.st = {
      t: 0,
      dt: SIM_DT,
      phase: 'intro',
      phaseTimer: 1.2,
      period: 1,
      clock: mods.periodLength,
      overtime: false,
      skaters,
      order,
      puck: makePuck(),
      teams: teamStates,
      faceoffSpot: { x: 0, y: 0 },
      faceoffTeamAdvantage: null,
      events: [],
      winner: null,
      mods,
      fight: null,
      fightsThisPeriod: 0,
      shake: 0,
      stats: { hits: [0, 0], bigHits: [0, 0], shots: [0, 0] },
    };
    // temper from traits
    teams.forEach((t) => {
      for (const def of t.skaters) {
        const sk = skaters[def.id];
        if (!sk) continue;
        if (def.traits.includes('goon')) sk.temper = 0.9;
        else if (def.traits.includes('brawler')) sk.temper = 0.75;
        else if (def.traits.includes('ironjaw')) sk.temper = 0.55;
        else if (def.archetype === 'enforcer') sk.temper = 0.6;
      }
    });
    const ev: MatchEvent[] = [];
    setupFaceoff(this.st, ev);
    this.st.phase = 'intro';
    this.st.phaseTimer = 1.2;
  }

  /** Advance one fixed tick. humanInputs keyed by team id. */
  step(humanInputs: Partial<Record<TeamId, Input>> = {}): MatchEvent[] {
    const st = this.st;
    const dt = SIM_DT;
    const events: MatchEvent[] = [];
    st.shake = Math.max(0, st.shake - dt * 2.5);
    st.t += dt;

    switch (st.phase) {
      case 'intro':
        st.phaseTimer -= dt;
        if (st.phaseTimer <= 0) {
          setupFaceoff(st, events);
          events.push({ type: 'period', period: st.period, overtime: st.overtime });
        }
        break;
      case 'faceoff': {
        st.phaseTimer -= dt;
        // mash during last 0.5s
        for (const t of st.teams) {
          const inp = humanInputs[t.id];
          if (t.isHuman && inp && (inp.check || inp.pass) && st.phaseTimer < 0.5) this.mash[t.id] += 1;
        }
        // AI mash
        for (const t of st.teams) if (!t.isHuman && st.phaseTimer < 0.5) this.mash[t.id] += this.rng.next() < 0.3 + t.difficulty * 0.15 ? 1 : 0;
        if (st.phaseTimer <= 0) {
          dropPuck(st, this.mash, this.rng, events);
          this.mash = [0, 0];
        }
        break;
      }
      case 'play':
        this.stepPlay(humanInputs, dt, events);
        break;
      case 'fight':
        stepFight(st, dt, humanInputs, this.rng, events);
        break;
      case 'goal':
        st.phaseTimer -= dt;
        // let puck & fallen skaters settle visually
        this.settle(dt);
        if (st.phaseTimer <= 0) {
          if (this.checkEndConditions(events)) break;
          for (const t of st.teams) if (t.pulled) this.togglePull(t.id, events);
          st.faceoffSpot = { x: 0, y: 0 };
          setupFaceoff(st, events);
        }
        break;
      case 'periodEnd':
        st.phaseTimer -= dt;
        if (st.phaseTimer <= 0) {
          restoreEjected(st);
          st.period++;
          if (st.period > st.mods.periods) st.overtime = true;
          st.clock = st.overtime ? RULES.otLength : st.mods.periodLength;
          st.faceoffSpot = { x: 0, y: 0 };
          this.applyBossPhases(events);
          setupFaceoff(st, events);
          events.push({ type: 'period', period: st.period, overtime: st.overtime });
          for (const t of st.teams) if (st.mods.teams[t.id].periodBrickWall > 0) t.brickWall += st.mods.teams[t.id].periodBrickWall;
        }
        break;
      case 'over':
        this.settle(dt);
        break;
    }

    st.events = events;
    return events;
  }

  private settle(dt: number): void {
    const st = this.st;
    for (const id of st.order) {
      const sk = st.skaters[id];
      sk.knockdown = Math.max(0, sk.knockdown - dt);
      sk.vel.x *= 0.9;
      sk.vel.y *= 0.9;
      sk.pos.x += sk.vel.x * dt;
      sk.pos.y += sk.vel.y * dt;
    }
  }

  private checkEndConditions(events: MatchEvent[]): boolean {
    const st = this.st;
    const [a, b] = st.teams;
    if (st.mods.suddenDeath && a.score !== b.score) return this.finish(events);
    if (st.mods.mercyRule > 0 && Math.abs(a.score - b.score) >= st.mods.mercyRule) return this.finish(events);
    if (st.overtime && a.score !== b.score) return this.finish(events);
    return false;
  }

  private finish(events: MatchEvent[]): boolean {
    const st = this.st;
    const [a, b] = st.teams;
    st.winner = a.score > b.score ? 0 : b.score > a.score ? 1 : null;
    st.phase = 'over';
    events.push({ type: 'over', winner: st.winner });
    return true;
  }

  private endPeriod(events: MatchEvent[]): void {
    const st = this.st;
    const [a, b] = st.teams;
    events.push({ type: 'periodEnd', period: st.period });
    const lastRegulation = st.period >= st.mods.periods;
    if (lastRegulation && a.score !== b.score) {
      this.finish(events);
      return;
    }
    if (st.overtime && a.score !== b.score) {
      this.finish(events);
      return;
    }
    st.phase = 'periodEnd';
    st.phaseTimer = RULES.periodBreak;
    if (st.puck.owner) {
      st.skaters[st.puck.owner].hasPuck = false;
      st.puck.owner = null;
    }
  }

  private stepPlay(humanInputs: Partial<Record<TeamId, Input>>, dt: number, events: MatchEvent[]): void {
    const st = this.st;
    st.clock -= dt;
    // gather inputs
    const inputs = new Map<string, Input>();
    for (const team of st.teams) {
      this.brains[team.id].assignRoles(st, team.id);
      team.switchLock = Math.max(0, team.switchLock - dt);
      for (const id of team.skaters) {
        const sk = st.skaters[id];
        if (team.isHuman && team.controlledId === id) {
          inputs.set(id, humanInputs[team.id] ?? EMPTY_INPUT);
        } else {
          inputs.set(id, this.brains[team.id].think(st, sk, dt, this.rng));
        }
      }
      // human: switching, goalie dive, pull goalie
      if (team.isHuman) {
        const inp = humanInputs[team.id];
        const ownerSk = st.puck.owner ? st.skaters[st.puck.owner] : null;
        const weHave = ownerSk?.team === team.id;
        team.diveWindow = Math.max(0, team.diveWindow - dt);
        const goalie = team.goalie ? st.skaters[team.goalie] : null;
        // hand control back after a dive
        if (goalie && team.controlledId === goalie.id && goalie.dive === 0 && team.diveReturnId) {
          setControlled(st, team.id, team.diveReturnId, events);
          team.diveReturnId = null;
        }
        if (inp?.pass && inp.passHoldTime < 1.0 && !weHave && team.switchLock === 0) {
          if (team.diveWindow > 0 && goalie && goalie.dive === 0) {
            // goalie dive: direction from the move input's screen-vertical axis (sim y)
            goalie.dive = GOALIE.diveTime;
            goalie.diveDir = Math.abs(inp.move.y) > 0.3 ? Math.sign(inp.move.y) : Math.sign(st.puck.pos.y - goalie.pos.y) || 1;
            team.diveReturnId = team.controlledId;
            setControlled(st, team.id, goalie.id, events);
            team.diveWindow = 0;
          } else {
            const sorted = team.skaters.map((id) => st.skaters[id]).sort((a, b) => dist(a.pos, st.puck.pos) - dist(b.pos, st.puck.pos));
            let next = sorted[0];
            if (next.id === team.controlledId && sorted.length > 1) next = sorted[1];
            if (next.id !== team.controlledId) setControlled(st, team.id, next.id, events);
          }
          team.switchLock = 0.3;
        }
        // pull goalie: hold pass ≥ 1s in the final minutes (toggle, once per hold)
        if (inp?.passHeld && inp.passHoldTime >= GOALIE.pullHold && !team.pullLatch && st.clock <= GOALIE.pullClock && !st.overtime) {
          team.pullLatch = true;
          this.togglePull(team.id, events);
        }
        if (!inp?.passHeld) team.pullLatch = false;
      }
    }

    // skaters
    for (const id of st.order) {
      const sk = st.skaters[id];
      if (sk.isGoalie) continue;
      const inp = inputs.get(id) ?? EMPTY_INPUT;
      tryStartCheck(sk, inp, st);
      trySpinDodge(sk, inp);
      stepSkater(sk, inp, st, dt, events);
      stepCarrier(st, sk, inp, dt, this.rng, events);
    }
    // goalies
    for (const team of st.teams) {
      if (team.goalie) stepGoalie(st, st.skaters[team.goalie], dt, this.rng, events);
    }
    for (const e of events) {
      if (e.type === 'shot') {
        const shooter = st.skaters[e.shooter];
        const defending = st.teams[shooter.team === 0 ? 1 : 0];
        if (defending.isHuman && defending.goalie && defending.diveWindow === 0) {
          defending.diveWindow = GOALIE.diveWindow;
          events.push({ type: 'divePrompt', team: defending.id });
        }
      }
    }
    // skater collisions
    for (let i = 0; i < st.order.length; i++) {
      for (let j = i + 1; j < st.order.length; j++) {
        collideSkaters(st.skaters[st.order[i]], st.skaters[st.order[j]]);
      }
    }
    resolveHits(st, this.rng, events);

    // puck
    const prevX = st.puck.pos.x;
    if (st.puck.owner) carryPuck(st);
    else stepPuckPhysics(st, dt, events);
    tryPickups(st, events);
    checkGoal(st, prevX, events);
    for (const e of events) {
      if (e.type === 'goal') {
        this.unanswered[e.team]++;
        this.unanswered[e.team === 0 ? 1 : 0] = 0;
        if (e.team === 0) {
          for (const ph of st.mods.bossPhases) {
            if (ph.kind !== 'goalieFire' || ph.applied) continue;
            if (st.teams[0].score >= (ph.goalsAgainst ?? 2)) {
              ph.applied = true;
              const gid = st.teams[1].goalie;
              if (gid) st.skaters[gid].onFire = 9999;
              events.push({ type: 'bossPhase', label: ph.label, desc: ph.desc });
            }
          }
        }
      }
    }
    stepOnFire(st, events);
    stepSpecialInputs(st, inputs, this.rng, events);
    const extra: MatchEvent[] = [];
    gainSpecial(st, dt, events, extra);
    stepTeamFire(st, dt, extra, this.unanswered);
    events.push(...extra);

    if (st.phase === 'play' && st.clock <= 0) {
      st.clock = 0;
      this.endPeriod(events);
    }
    this.prevInputs = inputs;
  }

  /** Boss rule changes at period starts (and goal-count triggers). */
  applyBossPhases(events: MatchEvent[]): void {
    const st = this.st;
    for (const ph of st.mods.bossPhases) {
      if (ph.applied) continue;
      if (ph.kind === 'goalieFire') continue; // goal-triggered
      if (st.period < ph.period) continue;
      ph.applied = true;
      switch (ph.kind) {
        case 'extraSkater': {
          const def = st.mods.extraSkater;
          if (!def || st.skaters[def.id]) break;
          const s = makeSkater(def.id, def.name, 1, def.stats, def.archetype, false, def.hp);
          st.skaters[s.id] = s;
          st.order.push(s.id);
          st.teams[1].skaters.push(s.id);
          break;
        }
        case 'slickIce':
          st.mods.slipperyIce = true;
          break;
        case 'bouncy':
          st.mods.boardsBouncy = true;
          break;
        case 'turboAll':
          st.mods.turboInfinite = true;
          break;
      }
      events.push({ type: 'bossPhase', label: ph.label, desc: ph.desc });
    }
  }

  /** Pull the goalie out as an extra attacker (or put them back). */
  togglePull(teamId: TeamId, events: MatchEvent[]): void {
    const st = this.st;
    const team = st.teams[teamId];
    if (!team.pulled) {
      if (!team.goalie) return;
      const g = st.skaters[team.goalie];
      team.pulledGoalieId = team.goalie;
      team.goalie = null;
      team.pulled = true;
      g.isGoalie = false;
      g.radius = 0.6;
      team.skaters.push(g.id);
      events.push({ type: 'goaliePulled', team: teamId, pulled: true });
    } else {
      const id = team.pulledGoalieId;
      if (!id) return;
      const g = st.skaters[id];
      team.skaters = team.skaters.filter((s) => s !== id);
      team.goalie = id;
      team.pulled = false;
      g.isGoalie = true;
      g.radius = GOALIE.radius;
      g.hasPuck = false;
      if (st.puck.owner === id) st.puck.owner = null;
      if (team.controlledId === id && team.skaters.length) setControlled(st, teamId, team.skaters[0], events);
      events.push({ type: 'goaliePulled', team: teamId, pulled: false });
    }
  }

  get lastInputs(): Map<string, Input> {
    return this.prevInputs;
  }
}
