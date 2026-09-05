import type { MetaProfile } from './meta';
import type { MatchOutcome, RunState } from './runState';
import { activeSets } from './perks';
import type { MapNode } from './mapGen';

export interface Feat {
  id: string;
  name: string;
  icon: string;
  desc: string;
  reward: { cash?: number; unlock?: string };
  /** when: 'match' gets the outcome, 'run' the finished run, 'life' lifetime meta */
  check: (ctx: { meta: MetaProfile; outcome?: MatchOutcome; run?: RunState; node?: MapNode; runOver?: boolean }) => boolean;
}

export const FEATS: Feat[] = [
  { id: 'first_blood', name: 'First Blood', icon: '🩸', desc: 'Score your first goal.', reward: { cash: 25 }, check: ({ meta }) => meta.totalGoals >= 1 },
  { id: 'hat_trick', name: 'Hat Trick', icon: '🎩', desc: 'Three goals by one skater in a match.', reward: { cash: 60 }, check: ({ outcome }) => !!outcome?.boxScore.some((b) => b.team === 0 && b.goals >= 3) },
  { id: 'shutout', name: 'Shutout', icon: '🧱', desc: 'Win a match without conceding.', reward: { cash: 60 }, check: ({ outcome }) => !!outcome && outcome.won && outcome.scoreAgainst === 0 },
  { id: 'big_hitter', name: 'Wrecking Ball', icon: '🔨', desc: 'Five big hits in one match.', reward: { cash: 50 }, check: ({ outcome }) => (outcome?.bigHits ?? 0) >= 5 },
  { id: 'brawler', name: 'Gloves Off', icon: '🥊', desc: 'Win a fight.', reward: { cash: 40 }, check: ({ outcome }) => (outcome?.fightsWon ?? 0) >= 1 },
  { id: 'ankle_breaker', name: 'Ankle Collector', icon: '🦶', desc: 'Three ankle breakers in one match.', reward: { cash: 50 }, check: ({ outcome }) => (outcome?.ankleBreakers ?? 0) >= 3 },
  { id: 'meat_shield', name: 'Meat Shield', icon: '🛡️', desc: 'Block five shots in one match.', reward: { cash: 50 }, check: ({ outcome }) => (outcome?.blocks ?? 0) >= 5 },
  { id: 'wall', name: 'The Wall', icon: '🧤', desc: 'Make a BIG SAVE with a goalie dive.', reward: { cash: 40 }, check: ({ outcome }) => (outcome?.bigSaves ?? 0) >= 1 },
  { id: 'showtime', name: 'Showtime', icon: '🎇', desc: 'Fire three specials in one match.', reward: { cash: 40 }, check: ({ outcome }) => (outcome?.specialsUsed ?? 0) >= 3 },
  { id: 'top_shelf', name: 'Top Shelf', icon: '🥫', desc: 'Score three top-corner goals in one match.', reward: { cash: 50 }, check: ({ outcome }) => (outcome?.topCornerGoals ?? 0) >= 3 },
  { id: 'shootout_king', name: 'Shootout King', icon: '🥅', desc: 'Win a shootout.', reward: { cash: 60 }, check: ({ outcome }) => !!outcome?.shootoutWon },
  { id: 'grudge_settled', name: 'Grudge Settled', icon: '🤝', desc: 'Beat a rival who came back for revenge.', reward: { cash: 50 }, check: ({ outcome, run, node }) => !!outcome?.won && !!run && !!node?.rivalId && (run.grudges?.[node.rivalId]?.beaten ?? 0) >= 2 },
  { id: 'act1', name: 'Out of the Basement', icon: '🚪', desc: 'Clear Act 1.', reward: { cash: 80 }, check: ({ run }) => !!run && run.act >= 2 },
  { id: 'act2', name: 'Contender', icon: '🏒', desc: 'Clear Act 2.', reward: { cash: 120 }, check: ({ run }) => !!run && run.act >= 3 },
  { id: 'champion', name: 'Champion', icon: '🏆', desc: 'Win a run.', reward: { cash: 300, unlock: 'perk_deadeye' }, check: ({ run, runOver }) => !!runOver && !!run?.won },
  { id: 'set_piece', name: 'Set Piece', icon: '🧩', desc: 'Complete a perk set.', reward: { cash: 60, unlock: 'perk_zamboni' }, check: ({ run }) => !!run && activeSets(run.perks).length > 0 },
  { id: 'cursed', name: 'Deal With It', icon: '🍷', desc: 'Win a match while holding a cursed perk.', reward: { cash: 50 }, check: ({ outcome, run }) => !!outcome?.won && !!run && run.perks.some((p) => ['glass_jaw', 'blood_money', 'loose_cannon', 'overclock'].includes(p)) },
  { id: 'firestarter', name: 'Firestarter', icon: '🔥', desc: 'Get your whole team on fire.', reward: { cash: 60, unlock: 'perk_gasoline' }, check: ({ outcome }) => !!(outcome as { teamFire?: boolean } | undefined)?.teamFire },
  { id: 'century', name: 'Century', icon: '💯', desc: '100 career goals.', reward: { cash: 100 }, check: ({ meta }) => meta.totalGoals >= 100 },
  { id: 'hitman', name: 'Hitman', icon: '💀', desc: '200 career big hits.', reward: { cash: 100 }, check: ({ meta }) => meta.totalBigHits >= 200 },
  { id: 'overtime', name: 'Overtime League', icon: '⏱️', desc: 'Clear Act 4 in the Overtime League.', reward: { cash: 200 }, check: ({ run }) => !!run && run.act >= 5 },
  { id: 'asc_champ', name: 'Cursed Crown', icon: '👑', desc: 'Win a run at Ascension 3 or higher.', reward: { cash: 250 }, check: ({ run, runOver }) => !!runOver && !!run?.won && run.ascension >= 3 },
  { id: 'weekly', name: 'Regular', icon: '📅', desc: 'Finish a weekly run.', reward: { cash: 40 }, check: ({ run, runOver }) => !!runOver && !!run?.weekly },
];
export const FEAT_BY_ID: Record<string, Feat> = Object.fromEntries(FEATS.map((f) => [f.id, f]));

/** Evaluate feats; returns newly earned ones (already applied to meta). */
export function awardFeats(meta: MetaProfile, ctx: { outcome?: MatchOutcome; run?: RunState; node?: MapNode; runOver?: boolean }): Feat[] {
  const earned: Feat[] = [];
  meta.feats ??= [];
  for (const f of FEATS) {
    if (meta.feats.includes(f.id)) continue;
    let ok = false;
    try {
      ok = f.check({ meta, ...ctx });
    } catch {
      ok = false;
    }
    if (!ok) continue;
    meta.feats.push(f.id);
    if (f.reward.cash) meta.cash += f.reward.cash;
    if (f.reward.unlock && !meta.unlocked.includes(f.reward.unlock)) meta.unlocked.push(f.reward.unlock);
    earned.push(f);
  }
  return earned;
}
