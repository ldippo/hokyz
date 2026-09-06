import type { MatchEvent, MatchState, TeamId } from '../../src/sim/types';

/** Read-only, end-of-tick diagnostics. Never advances the sim or consumes RNG. */
export class PossessionMetrics {
  passes = { attempts: 0, completed: 0, recovered: 0, intercepted: 0, unresolved: 0 };
  possessionSeconds = [0, 0];
  looseSeconds = 0;
  playSeconds = 0;
  private pending: { from: string; to: string | null; team: TeamId } | null = null;

  private receive(id: string, st: MatchState): void {
    const p = this.pending;
    if (!p) return;
    if (st.skaters[id].team !== p.team) this.passes.intercepted++;
    else if (id === p.to && id !== p.from) this.passes.completed++;
    else this.passes.recovered++;
    this.pending = null;
  }

  sample(st: MatchState, events: MatchEvent[]): void {
    for (const event of events) {
      if (event.type === 'pass') {
        // An immediate re-pass can occur before ownership is sampled.
        this.receive(event.from, st);
        this.passes.attempts++;
        this.pending = { from: event.from, to: event.to, team: st.skaters[event.from].team };
      } else if (event.type === 'shot') {
        this.receive(event.shooter, st);
      }
    }
    // Do not credit a faceoff winner with receiving a pass from before a whistle.
    if (st.phase !== 'play' || events.some(e => ['faceoff', 'goal', 'freeze', 'periodEnd', 'over'].includes(e.type))) {
      this.finish();
      return;
    }
    this.playSeconds += st.dt;
    if (st.puck.owner) {
      this.receive(st.puck.owner, st);
      this.possessionSeconds[st.skaters[st.puck.owner].team] += st.dt;
    } else this.looseSeconds += st.dt;
  }

  finish(): void {
    if (this.pending) this.passes.unresolved++;
    this.pending = null;
  }

  report() {
    return { passes: { ...this.passes },
      completionRate: this.passes.attempts ? this.passes.completed / this.passes.attempts : null,
      possessionSeconds: [...this.possessionSeconds], looseSeconds: this.looseSeconds,
      playSeconds: this.playSeconds,
      note: 'Diagnostic end-of-tick ownership, not a game-feel gate. Completed means intended receiver; recovered means another teammate or passer. Unresolved means play stopped or capture ended before observed reception.' };
  }
}
