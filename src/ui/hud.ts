import type { MatchState, Skater } from '../sim/types';
import { ONFIRE } from '../sim/constants';

export class Hud {
  root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private announceTimer = 0;
  private promptTimer = 0;
  private lastCountdown = -1;
  constructor(parent: HTMLElement, private humanTeam: 0 | 1 | null, perkNames: string[] = []) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="scoreboard">
        <div class="sb-team t0"><span class="badge" data-el="badge0"></span><span class="name" data-el="name0"></span><span class="score" data-el="score0">0</span></div>
        <div class="sb-mid"><span class="clock" data-el="clock">2:00</span><span class="period" data-el="period">1ST</span></div>
        <div class="sb-team t1"><span class="badge" data-el="badge1"></span><span class="name" data-el="name1"></span><span class="score" data-el="score1">0</span></div>
      </div>
      <div class="perks-mini" data-el="perks"></div>
      <div class="charge-wrap" data-el="chargeWrap"><div class="charge-fill" data-el="charge"></div></div>
      <div class="turbo-wrap"><div class="turbo-label">TURBO</div><div class="turbo" data-el="turbo"><div class="turbo-fill" data-el="turboFill"></div></div><div class="special-label" data-el="specialLabel">SPECIAL</div><div class="special" data-el="special"><div class="special-fill" data-el="specialFill"></div></div></div>
      <div class="fight" data-el="fight"><div class="fighter f0"><div class="fname" data-el="fname0"></div><div class="fhp"><div class="fhp-fill" data-el="fhp0"></div></div></div><div class="fcue" data-el="fcue"></div><div class="fighter f1"><div class="fname" data-el="fname1"></div><div class="fhp"><div class="fhp-fill" data-el="fhp1"></div></div></div></div>
      <div class="player-tag"><div class="pname" data-el="pname"></div><div class="ptype" data-el="ptype"></div><div class="hp"><div class="hp-fill" data-el="hp"></div></div></div>
      <div class="fire-streak" data-el="streak"><span></span><span></span><span></span></div>
      <div class="announce" data-el="announce"></div>
      <div class="cine-tag" data-el="tag"></div>
      <div class="prompt" data-el="prompt"></div>
      <div class="countdown" data-el="countdown"></div>
      <div class="flash" data-el="flash"></div>
      <div class="vignette-fire" data-el="vig"></div>
    `;
    this.root.querySelectorAll<HTMLElement>('[data-el]').forEach((e) => (this.els[e.dataset.el!] = e));
    parent.appendChild(this.root);
    this.els.perks.innerHTML = perkNames.map((n) => `<span>${n}</span>`).join('');
    if (humanTeam === null) {
      this.els.turbo.parentElement!.style.display = 'none';
      this.els.pname.parentElement!.style.display = 'none';
      this.els.streak.style.display = 'none';
    }
  }

  destroy(): void {
    this.root.remove();
  }

  announce(text: string, cls = '', sub = ''): void {
    const a = this.els.announce;
    a.className = 'announce';
    void a.offsetWidth; // restart animation
    a.innerHTML = `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`;
    a.className = `announce pop ${cls}`;
    this.announceTimer = 1.6;
  }

  /** Hide the clock/period block (training camp). */
  showClock(on: boolean): void {
    (this.els.clock.parentElement as HTMLElement).style.display = on ? '' : 'none';
  }

  /** Short-lived contextual prompt (dive window, pull goalie). */
  prompt(text: string, seconds = 0.6, cls = ''): void {
    this.els.prompt.textContent = text;
    this.els.prompt.className = `prompt on ${cls}`;
    this.promptTimer = seconds;
  }

  tag(text: string | null): void {
    this.els.tag.textContent = text ?? '';
    this.els.tag.classList.toggle('on', !!text);
  }

  flash(): void {
    const f = this.els.flash;
    f.classList.remove('on');
    void f.offsetWidth;
    f.classList.add('on');
  }

  /** Fight overlay. cue text empty hides the prompt. */
  fight(on: boolean, names: [string, string] = ['', ''], hp: [number, number] = [100, 100], cue = '', cueCls = ''): void {
    this.els.fight.classList.toggle('on', on);
    if (!on) return;
    this.els.fname0.textContent = names[0];
    this.els.fname1.textContent = names[1];
    this.els.fhp0.style.width = `${Math.max(0, hp[0])}%`;
    this.els.fhp1.style.width = `${Math.max(0, hp[1])}%`;
    this.els.fcue.textContent = cue;
    this.els.fcue.className = `fcue ${cueCls} ${cue ? 'on' : ''}`;
  }

  update(st: MatchState, dt: number): void {
    const [a, b] = st.teams;
    this.els.name0.textContent = a.short;
    this.els.name1.textContent = b.short;
    this.els.badge0.style.background = a.color;
    this.els.badge1.style.background = b.color;
    this.els.score0.textContent = String(a.score);
    this.els.score1.textContent = String(b.score);
    const c = Math.max(0, st.clock);
    const m = Math.floor(c / 60);
    const s = Math.floor(c % 60);
    this.els.clock.textContent = `${m}:${s.toString().padStart(2, '0')}`;
    this.els.period.textContent = st.overtime ? 'OT' : st.period === 1 ? '1ST' : st.period === 2 ? '2ND' : st.period === 3 ? '3RD' : `${st.period}TH`;
    this.announceTimer -= dt;
    if (this.promptTimer > 0) {
      this.promptTimer -= dt;
      if (this.promptTimer <= 0) this.els.prompt.classList.remove('on');
    }

    if (st.phase === 'faceoff') {
      const n = Math.ceil(st.phaseTimer);
      if (n !== this.lastCountdown) {
        this.lastCountdown = n;
        this.els.countdown.textContent = n > 0 ? String(n) : '';
        this.els.countdown.classList.remove('show');
        void this.els.countdown.offsetWidth;
        this.els.countdown.classList.add('show');
      }
    } else if (this.lastCountdown !== -1) {
      this.lastCountdown = -1;
      this.els.countdown.classList.remove('show');
      this.els.countdown.textContent = '';
    }

    if (this.humanTeam === null) return;
    const team = st.teams[this.humanTeam];
    const sk: Skater | undefined = team.controlledId ? st.skaters[team.controlledId] : undefined;
    if (!sk) return;
    const infinite = st.mods.turboInfinite || sk.onFire > 0;
    this.els.turboFill.style.width = `${Math.round(sk.turbo * 100)}%`;
    this.els.turbo.classList.toggle('active', sk.turboActive);
    this.els.turbo.classList.toggle('infinite', infinite);
    this.els.chargeWrap.classList.toggle('on', sk.charging);
    this.els.charge.style.width = `${Math.round(sk.shotCharge * 100)}%`;
    this.els.pname.textContent = sk.name;
    this.els.ptype.textContent = sk.archetype.toUpperCase() + (sk.onFire > 0 ? ' · ON FIRE' : '');
    this.els.hp.style.width = `${Math.round(sk.hp)}%`;
    this.els.hp.style.background = sk.hp > 50 ? '#3f3' : sk.hp > 25 ? '#fc3' : '#f33';
    this.els.specialFill.style.width = `${Math.round(team.special * 100)}%`;
    this.els.special.classList.toggle('ready', team.special >= 1);
    this.els.specialLabel.textContent = team.special >= 1 ? `${sk.specialKind.toUpperCase()} READY · SPACE / Y` : `SPECIAL · ${sk.specialKind.toUpperCase()}`;
    const lit = sk.onFire > 0 ? ONFIRE.streakNeeded : Math.min(ONFIRE.streakNeeded, Math.floor(sk.streak));
    this.els.streak.querySelectorAll('span').forEach((e, i) => e.classList.toggle('lit', i < lit));
    // fire vignette if any human skater on fire
    const anyFire = team.skaters.some((id) => st.skaters[id].onFire > 0);
    this.els.vig.classList.toggle('on', anyFire);
  }
}
