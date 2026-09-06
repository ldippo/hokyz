import type { Input, MatchState, Skater, TeamId } from '../types';
import { dist } from '../vec';
import { defendGoal } from '../rink';
import { makeBrain, thinkSkater, type Brain, type Role } from './skaterAI';
import type { Rng } from '../../core/rng';

export class TeamBrains {
  brains = new Map<string, Brain>();
  brain(id: string): Brain {
    let b = this.brains.get(id);
    if (!b) {
      b = makeBrain();
      this.brains.set(id, b);
    }
    return b;
  }

  /** Assign roles for a team based on situation. */
  assignRoles(st: MatchState, teamId: TeamId): void {
    const team = st.teams[teamId];
    if (team.scripted) return;
    const p = st.puck;
    const ownerSk = p.owner ? st.skaters[p.owner] : null;
    const skaters = team.skaters.map((id) => st.skaters[id]);
    const own = defendGoal(teamId);
    const byDistTo = (pt: { x: number; y: number }) => [...skaters].sort((a, b) => dist(a.pos, pt) - dist(b.pos, pt));

    const set = (s: Skater, r: Role) => {
      const b = this.brain(s.id);
      if (b.role !== r) {
        b.role = r;
        b.timer = 0; // re-decide immediately on role change
      }
    };

    if (ownerSk && ownerSk.team === teamId) {
      const others = skaters.filter((s) => s.id !== ownerSk.id);
      // higher (closer to attack goal) = supportHigh
      const attackX = own.lineX * -1;
      others.sort((a, b) => Math.abs(a.pos.x - attackX) - Math.abs(b.pos.x - attackX));
      if (!ownerSk.isGoalie) set(ownerSk, 'carrier');
      others.forEach((s, i) => set(s, i === 0 ? 'supportHigh' : 'supportLow'));
    } else if (ownerSk) {
      const sorted = byDistTo(ownerSk.pos);
      sorted.forEach((s, i) => set(s, i === 0 ? 'pressure' : i === 1 ? 'mark' : 'back'));
    } else {
      const receiver = p.passTarget ? st.skaters[p.passTarget] : null;
      if (receiver && receiver.team === teamId && !receiver.isGoalie &&
          receiver.knockdown <= 0 && p.lastTouchTeam === teamId && !p.isShot && p.freeTime < 1.5) {
        // A deliberate pass is not a loose-puck scramble. Let the recipient
        // meet it while the passer and third skater retain supporting positions.
        set(receiver, 'receive');
        byDistTo(p.pos).filter(s => s.id !== receiver.id)
          .forEach((s, i) => set(s, i === 0 ? 'back' : 'supportHigh'));
        return;
      }
      const sorted = byDistTo(p.pos);
      sorted.forEach((s, i) => set(s, i === 0 ? 'chase' : i === 1 ? 'supportHigh' : 'back'));
    }
  }

  think(st: MatchState, sk: Skater, dt: number, rng: Rng): Input {
    return thinkSkater(st, sk, this.brain(sk.id), dt, rng);
  }
}
