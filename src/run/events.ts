import type { Rng } from '../core/rng';
import type { RunState } from './runState';
import { generateSkater, randomArchetype, TRAITS } from './roster';
import { PERKS } from './perks';
import type { Stats } from '../sim/types';

export interface EventChoice {
  label: string;
  detail: string;
  /** returns result text */
  effect: (run: RunState, rng: Rng) => string;
  disabled?: (run: RunState) => boolean;
}
export interface RunEvent {
  id: string;
  title: string;
  icon: string;
  text: string;
  choices: EventChoice[];
}

const healAll = (run: RunState, n: number) => run.roster.forEach((s) => (s.hp = Math.min(s.maxHp, s.hp + n)));
const bump = (run: RunState, key: keyof Stats, n: number, who?: number) => {
  const list = who === undefined ? run.roster : [run.roster[who]];
  list.forEach((s) => (s.stats[key] = Math.max(1, Math.min(10, s.stats[key] + n))));
};

export const EVENTS: RunEvent[] = [
  {
    id: 'fan_favorite',
    title: 'Fan Favorite',
    icon: '📣',
    text: 'A section of the crowd has adopted one of your skaters. They chant the name. They have a banner. It is a little much.',
    choices: [
      { label: 'Feed the hype', detail: 'A random skater gains +1 hands and +1 shot.', effect: (r, rng) => { const s = rng.pick(r.roster); bump(r, 'hands', 1, r.roster.indexOf(s)); bump(r, 'shot', 1, r.roster.indexOf(s)); return `${s.name} plays to the crowd. +1 hands, +1 shot.`; } },
      { label: 'Sell the banner', detail: '+45 cash.', effect: (r) => { r.cash += 45; return 'Somebody paid 45 cash for a bedsheet with a face on it.'; } },
    ],
  },
  {
    id: 'gear_sale',
    title: 'Equipment Sale',
    icon: '🛍️',
    text: 'The pro shop is dumping last season\'s shoulder pads. "Slightly used. Mostly by professionals."',
    choices: [
      { label: 'Buy the lot (35)', detail: '+1 balance for every skater.', effect: (r) => { r.cash -= 35; bump(r, 'balance', 1); return 'Everyone looks 10% wider. +1 balance across the board.'; }, disabled: (r) => r.cash < 35 },
      { label: 'Pass', detail: 'Nothing happens.', effect: () => 'You keep your cash and your current shoulders.' },
    ],
  },
  {
    id: 'super_fan',
    title: 'Super Fan',
    icon: '🎰',
    text: 'A fan in a full body suit wants to bet on you. "Double or nothing on your next win. I believe."',
    choices: [
      { label: 'Take the bet', detail: 'Next match win pays double cash. A loss costs 40.', effect: (r) => { r.flags.betNext = true; return 'The suit nods solemnly. Next win pays double.'; } },
      { label: 'Decline', detail: 'Nothing happens.', effect: () => 'The suit deflates a little.' },
    ],
  },
  {
    id: 'ice_time',
    title: 'Extra Ice Time',
    icon: '⏱️',
    text: 'The rink is empty for an hour. Someone on the bench could use the reps.',
    choices: [
      { label: 'Run the bench', detail: 'Every non-starter gains 120 XP.', effect: (r) => { const bench = r.roster.slice(3); bench.forEach((s) => (s.xp = (s.xp ?? 0) + 120)); return bench.length ? `${bench.map((s) => s.name).join(', ')} put in the work.` : 'Nobody on the bench. The ice stays empty.'; } },
      { label: 'Rest instead', detail: 'Everyone heals 20 HP.', effect: (r) => { healAll(r, 20); return 'Naps for everyone. +20 HP.'; } },
    ],
  },
  {
    id: 'scout',
    title: 'The Scout',
    icon: '🔭',
    text: 'A scout with a clipboard offers intel on the next boss for a price. "Or I sell it to them. Your call."',
    choices: [
      { label: 'Buy the intel (30)', detail: 'Next boss fight: opponents start 10% slower.', effect: (r) => { r.cash -= 30; r.flags.scoutedBoss = true; return 'You know where they like to skate. Next boss: -10% speed.'; }, disabled: (r) => r.cash < 30 },
      { label: 'No thanks', detail: 'Nothing happens.', effect: () => 'The scout shrugs and walks toward the visitors\' bus.' },
    ],
  },
  {
    id: 'old_grudge',
    title: 'Old Grudge',
    icon: '🥊',
    text: 'An enforcer from a team you beat is waiting in the parking lot. He is holding his own teeth. "One round. If I win, I take your cash. If you win, I know a guy."',
    choices: [
      { label: 'Fight him', detail: '65%: gain a random rare perk. 35%: lose 50 cash and your captain takes 20 damage.', effect: (r, rng) => { if (rng.chance(0.65)) { const pool = PERKS.filter((p) => p.rarity === 'rare' && !r.perks.includes(p.id) && !p.unlock); const p = rng.pick(pool); if (p) { r.perks.push(p.id); return `He goes down. His guy delivers ${p.name}.`; } return 'He goes down. His guy never shows.'; } r.cash = Math.max(0, r.cash - 50); r.roster[0].hp = Math.max(1, r.roster[0].hp - 20); return 'He was not holding all of his teeth. -50 cash, captain -20 HP.'; } },
      { label: 'Get on the bus', detail: 'Nothing happens.', effect: () => 'The bus pulls away. He waves with the teeth.' },
    ],
  },
  {
    id: 'underground',
    title: 'Underground Game',
    icon: '🎲',
    text: 'A guy in a trench coat runs a card game behind the Zamboni bay. "Sixty cash. Win, and I know a guy with a rare perk. Lose, and my cousin takes it out on one of yours."',
    choices: [
      { label: 'Ante up (60)', detail: '50%: gain a random rare perk. 50%: lose the cash and a skater takes 30 damage.', effect: (r, rng) => { r.cash -= 60; if (rng.chance(0.5)) { const pool = PERKS.filter((p) => p.rarity === 'rare' && !r.perks.includes(p.id) && !p.unlock); const p = rng.pick(pool); if (p) { r.perks.push(p.id); return `Royal flush. You walk out with ${p.name}.`; } return 'You won, but the guy had nothing left to give.'; } const v = rng.pick(r.roster); v.hp = Math.max(1, v.hp - 30); return `Busted. ${v.name} learns what a cousin is (-30 HP).`; }, disabled: (r) => r.cash < 60 },
      { label: 'Walk past', detail: 'Nothing happens.', effect: () => 'You keep walking. The Zamboni hums.' },
    ],
  },
  {
    id: 'blackmarket_doc',
    title: 'Black Market Doc',
    icon: '💉',
    text: 'A "doctor" with a cooler offers an experimental treatment. "Guaranteed results. Side effects include... results."',
    choices: [
      { label: 'Take the shot', detail: 'Guaranteed random EPIC perk. A random skater loses 40 HP.', effect: (r, rng) => { const pool = PERKS.filter((p) => p.rarity === 'epic' && !r.perks.includes(p.id) && !p.unlock); const p = rng.pick(pool); const v = rng.pick(r.roster); v.hp = Math.max(1, v.hp - 40); if (p) { r.perks.push(p.id); return `${v.name} goes pale (-40 HP). You gain ${p.name}.`; } return `${v.name} goes pale for nothing.`; } },
      { label: 'Report him', detail: '+20 cash reward.', effect: (r) => { r.cash += 20; return 'The league sends a thank-you note and 20 cash.'; } },
    ],
  },
  {
    id: 'bribe_ref',
    title: 'The Ref Wants a Word',
    icon: '🦓',
    text: 'A referee with a suspicious tan corners you in the tunnel. "Nice team. Be a shame if the next game had... interesting calls." He rubs his fingers together.',
    choices: [
      { label: 'Pay him 40', detail: 'Next match: opponents start with less turbo (easier).', effect: (r) => { r.cash -= 40; r.flags.easyNext = true; return 'He winks. "Pleasure doing business."'; }, disabled: (r) => r.cash < 40 },
      { label: 'Tell him to get lost', detail: 'Gain 25 cash. He remembers your face.', effect: (r) => { r.cash += 25; r.flags.hardNext = true; return 'He storms off. Somehow you found 25 cash on the floor. Next match will be tough.'; } },
    ],
  },
  {
    id: 'rookie',
    title: 'Walk-On Tryout',
    icon: '🥅',
    text: 'A kid in mismatched gear has been waiting by the bus for six hours. "I can play. Just give me a shot."',
    choices: [
      { label: 'Sign the kid', detail: 'Add a random rookie to the bench.', effect: (r, rng) => { const s = generateSkater(rng, randomArchetype(rng), 0); r.roster.push(s); return `${s.name} makes the team! (${s.archetype})`; } },
      { label: 'Take their lunch money', detail: '+30 cash. You monster.', effect: (r) => { r.cash += 30; return 'The kid cries. You count the bills.'; } },
    ],
  },
  {
    id: 'hazing',
    title: 'Rookie Hazing',
    icon: '🧊',
    text: 'The veterans want to haze the newest player. Ice bath, shaved eyebrows, the works. Team morale would soar. Or someone gets hurt.',
    choices: [
      { label: 'Let them cook', detail: '+1 balance for everyone. One skater loses 25 HP.', effect: (r, rng) => { bump(r, 'balance', 1); const v = rng.pick(r.roster); v.hp = Math.max(5, v.hp - 25); return `Team bonded. ${v.name} got a little too bonded (-25 HP).`; } },
      { label: 'Shut it down', detail: 'Nothing happens.', effect: () => 'The vets grumble. The rookie thanks you with a firm handshake.' },
    ],
  },
  {
    id: 'sponsor',
    title: 'Energy Drink Sponsor',
    icon: '🥤',
    text: '"RAGE FUEL" wants your team to chug their product on the bench. It tastes like battery acid and regret.',
    choices: [
      { label: 'Drink up', detail: '+1 stamina for everyone. -1 hands for everyone.', effect: (r) => { bump(r, 'stamina', 1); bump(r, 'hands', -1); return 'Everyone is vibrating. Nobody can feel their fingertips.'; } },
      { label: 'Take the check only', detail: '+60 cash.', effect: (r) => { r.cash += 60; return 'You pour it down the drain. The drain hisses.'; } },
    ],
  },
  {
    id: 'old_pro',
    title: 'The Old Pro',
    icon: '🧓',
    text: 'A grizzled ex-pro runs a clinic in the parking lot. "I can teach one of you something. Costs 50."',
    choices: [
      { label: 'Train your captain', detail: '+2 to the captain\'s best stat. Costs 50.', effect: (r) => { r.cash -= 50; const c = r.roster[0]; const best = (Object.keys(c.stats) as (keyof Stats)[]).reduce((a, b) => (c.stats[b] > c.stats[a] ? b : a)); bump(r, best, 2, 0); return `${c.name} +2 ${best}!`; }, disabled: (r) => r.cash < 50 },
      { label: 'Train your goalie', detail: '+2 goalie hands. Costs 50.', effect: (r) => { r.cash -= 50; r.goalie.stats.hands = Math.min(10, r.goalie.stats.hands + 2); return `${r.goalie.name} learns the butterfly.`; }, disabled: (r) => r.cash < 50 },
      { label: 'Walk away', detail: 'Nothing happens.', effect: () => '"Your loss, kid."' },
    ],
  },
  {
    id: 'zamboni',
    title: 'Zamboni Joyride',
    icon: '🚜',
    text: 'The Zamboni keys are just... sitting there.',
    choices: [
      { label: 'Take it for a spin', detail: '50/50: full heal for everyone, or 40 cash in damages.', effect: (r, rng) => { if (rng.chance(0.5)) { healAll(r, 100); return 'Fresh ice therapy. Everyone feels amazing. Full heal!'; } r.cash = Math.max(0, r.cash - 40); return 'You hit the glass. Twice. -40 cash.'; } },
      { label: 'Leave it', detail: 'Nothing happens.', effect: () => 'Responsible. Boring, but responsible.' },
    ],
  },
  {
    id: 'trade',
    title: 'Trade Deadline',
    icon: '📞',
    text: 'A rival GM calls. "I\'ll swap you a proven veteran for your weakest skater. No questions."',
    choices: [
      { label: 'Make the trade', detail: 'Swap lowest-rated bench/roster skater for a tier-1 skater.', effect: (r, rng) => { const rated = r.roster.map((s, i) => ({ i, v: Object.values(s.stats).reduce((a, b) => a + b, 0) })).sort((a, b) => a.v - b.v); const idx = rated[0].i; const old = r.roster[idx]; const nu = generateSkater(rng, randomArchetype(rng), 1); r.roster[idx] = nu; return `${old.name} out, ${nu.name} (${nu.archetype}) in.`; }, disabled: (r) => r.roster.length < 2 },
      { label: 'Hang up', detail: 'Nothing happens.', effect: () => 'Click.' },
    ],
  },
  {
    id: 'mystery_trait',
    title: 'Locker Room Ritual',
    icon: '🔮',
    text: 'The equipment manager has a "lucky" ritual involving a rubber chicken and tape. One skater volunteers.',
    choices: [
      { label: 'Do the ritual', detail: 'A random skater gains a random trait.', effect: (r, rng) => { const s = rng.pick(r.roster); const t = rng.pick(TRAITS.filter((x) => !s.traits.includes(x.id))); if (!t) return 'Nothing happened. The chicken squeaked.'; s.traits.push(t.id); if (t.stats) for (const k of Object.keys(t.stats) as (keyof Stats)[]) s.stats[k] = Math.max(1, Math.min(10, s.stats[k] + (t.stats[k] ?? 0))); return `${s.name} gains ${t.name}: ${t.desc}`; } },
      { label: 'Nope', detail: 'Nothing happens.', effect: () => 'The chicken stares at you. Forever.' },
    ],
  },
];
