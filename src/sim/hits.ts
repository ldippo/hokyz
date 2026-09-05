import { HIT, ONFIRE, SKATER } from './constants';
import { releasePuck } from './puck';
import type { Input, MatchEvent, MatchState, Skater } from './types';
import { angleDiff, angleOf, fromAngle, len, norm, sub } from './vec';
import type { Rng } from '../core/rng';

/** Start a body-check lunge if requested and able. */
export function tryStartCheck(sk: Skater, input: Input, st: MatchState): void {
  if (!input.check || sk.hasPuck || sk.isGoalie) return;
  if (sk.checkCooldown > 0 || sk.knockdown > 0 || sk.lunge > 0 || sk.stumble > 0) return;
  const dir = len(input.move) > 0.2 ? norm(input.move) : fromAngle(sk.facing);
  const m = st.mods.teams[sk.team];
  let sp = HIT.lungeSpeed * (0.85 + sk.stats.hit / 60) * Math.sqrt(m.hitPowerMul);
  if (sk.turboActive) sp *= 1.12;
  sk.vel.x = dir.x * sp;
  sk.vel.y = dir.y * sp;
  sk.facing = angleOf(dir);
  sk.lunge = HIT.lungeTime;
  sk.checkCooldown = HIT.cooldown;
}

/** Deke without puck = spin dodge. */
export function trySpinDodge(sk: Skater, input: Input): void {
  if (!input.deke || sk.hasPuck || sk.deke > 0 || sk.knockdown > 0) return;
  sk.deke = 0.35;
  sk.invuln = Math.max(sk.invuln, 0.3);
}

/** Resolve contact for lunging skaters. */
export function resolveHits(st: MatchState, rng: Rng, events: MatchEvent[]): void {
  for (const id of st.order) {
    const h = st.skaters[id];
    if (h.lunge <= 0 || h.knockdown > 0) continue;
    const oppTeam = st.teams[h.team === 0 ? 1 : 0];
    for (const vid of oppTeam.skaters) {
      const vic = st.skaters[vid];
      if (vic.knockdown > 0) continue;
      const to = sub(vic.pos, h.pos);
      const d = len(to);
      if (d > h.radius + vic.radius + HIT.reach) continue;
      const ang = angleOf(to);
      if (Math.abs(angleDiff(h.facing, ang)) > HIT.coneHalfAngle) continue;
      applyHit(st, h, vic, rng, events);
      h.lunge = 0;
      break;
    }
  }
}

export function applyHit(st: MatchState, h: Skater, vic: Skater, rng: Rng, events: MatchEvent[]): void {
  const hm = st.mods.teams[h.team];
  const vm = st.mods.teams[vic.team];
  const dirV = norm(sub(vic.pos, h.pos));
  const hSpeed = len(h.vel);
  if (vic.invuln > 0 || vic.deke > 0) {
    // dodged — hitter whiffs and stumbles
    h.stumble = SKATER.stumbleTime * 0.7;
    h.vel.x *= 0.3;
    h.vel.y *= 0.3;
    return;
  }
  let power = SKATER.statScale(h.stats.hit) * hm.hitPowerMul * (0.55 + hSpeed / 18);
  if (h.onFire > 0) power *= ONFIRE.hitMul;
  if (h.turboActive) power *= 1.1;
  let resist = SKATER.statScale(vic.stats.balance) * vm.hitResistMul;
  if (vic.hasPuck) resist *= 0.9;
  if (vic.isGoalie) resist *= 1.6;
  if (st.mods.slipperyIce) resist *= 0.7;
  // side/behind hits stronger
  const facingDiff = Math.abs(angleDiff(vic.facing, angleOf(dirV)));
  if (facingDiff < Math.PI / 3) power *= 1.2; // from behind
  const score = (power / resist) * (0.85 + rng.next() * 0.3);

  const big = score > HIT.bigHitThreshold;
  const knock = big || score > HIT.knockThreshold;
  const impulse = big ? HIT.bigHitImpulse : knock ? HIT.knockdownImpulse : HIT.pushImpulse;
  vic.vel.x += dirV.x * impulse * (1 / vic.mass);
  vic.vel.y += dirV.y * impulse * (1 / vic.mass);
  h.vel.x *= 0.45;
  h.vel.y *= 0.45;

  if (knock) {
    vic.knockdown = SKATER.knockdownTime * (big ? 1.3 : 1);
    vic.turboActive = false;
    events.push({ type: 'knockdown', skater: vic.id });
    const dmg = (big ? HIT.injuryPerBigHit : HIT.injuryPerHit) * vm.injuryMul;
    vic.hp = Math.max(1, vic.hp - dmg);
    vic.injuryTaken += dmg;
    if (dmg > 0) events.push({ type: 'injury', skater: vic.id, amount: dmg });
  } else {
    vic.stumble = SKATER.stumbleTime;
  }

  if (vic.hasPuck) {
    // puck pops loose in hit direction + randomness
    const pop = fromAngle(angleOf(dirV) + (rng.next() - 0.5) * 1.2, HIT.puckPopSpeed * (knock ? 1.3 : 0.8));
    releasePuck(st, vic, pop);
    st.puck.lastTouch = h.id;
    st.puck.lastTouchTeam = h.team;
    vic.pickupCooldown = 0.5;
  }

  h.hits++;
  st.stats.hits[h.team]++;
  if (big) {
    h.bigHits++;
    st.stats.bigHits[h.team]++;
    h.turbo = Math.min(1, h.turbo + HIT.turboRefillOnBigHit + hm.bigHitTurboRefill);
    if (hm.hpOnBigHit > 0) h.hp = Math.min(100, h.hp + hm.hpOnBigHit);
    st.shake = Math.max(st.shake, 1);
  } else if (knock) {
    st.shake = Math.max(st.shake, 0.5);
  }
  events.push({ type: 'hit', hitter: h.id, victim: vic.id, big, pos: { x: vic.pos.x, y: vic.pos.y } });
}
