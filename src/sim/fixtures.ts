import type { SkaterDef, Stats } from './types';

export const stats = (speed: number, shot: number, hands: number, hit: number, balance: number, stamina: number): Stats => ({ speed, shot, hands, hit, balance, stamina });

export function quickSkater(id: string, name: string, archetype: SkaterDef['archetype'] = 'playmaker', s: Stats = stats(6, 6, 6, 6, 6, 6)): SkaterDef {
  return { id, name, archetype, stats: s, traits: [], hp: 100, maxHp: 100 };
}

export function quickTeam(prefix: string, withGoalie = true) {
  return {
    skaters: [
      quickSkater(`${prefix}1`, `${prefix} Sniper`, 'sniper', stats(6, 8, 7, 4, 5, 6)),
      quickSkater(`${prefix}2`, `${prefix} Enforcer`, 'enforcer', stats(5, 5, 4, 9, 8, 6)),
      quickSkater(`${prefix}3`, `${prefix} Speedster`, 'speedster', stats(9, 5, 6, 4, 5, 8)),
    ],
    goalie: withGoalie ? quickSkater(`${prefix}G`, `${prefix} Goalie`, 'goalie', stats(5, 3, 6, 4, 8, 6)) : null,
  };
}
