import type { App } from '../../app';
import { btn, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { completeNode, draftPerks, runEffects, prepareShop } from '../../run/runState';
import { PERK_PRICE, PERK_BY_ID } from '../../run/perks';
import { ARCHETYPES } from '../../run/roster';
import { runMapScreen, topBar, rosterPanel } from './runMap';
import { perkCard } from './draft';
import { sfx } from '../../audio/sfx';

export function shopScreen(app: App, node: MapNode): void {
  const run = app.run!;
  const shop = prepareShop(run, node);
  const hire = shop.hire;
  app.saveRun();

  const render = () => {
    const eff = runEffects(run);
    const price = (base: number) => Math.round(base * (1 - Math.min(0.6, eff.shopDiscount)));
    const perks = shop.perkIds.map(id => PERK_BY_ID[id]).filter(Boolean);
    const healCost = price(45);
    const hireCost = price(85);
    const rerollCost = price(30 + shop.rerolls * 15);
    const anyHurt = run.roster.some((s) => s.hp < s.maxHp) || run.goalie.hp < 100;
    const body = h('div', { class: 'map-scroll' },
      h('h2', { class: 'screen-title' }, '🛒 PRO SHOP'),
      h('p', { class: 'screen-sub' }, `Cash: ${run.cash}${eff.shopDiscount ? ` · Haggler ${Math.round(eff.shopDiscount * 100)}% off` : ''}`),
      h('div', { class: 'cards' },
        ...perks.map((p) => {
          const c = price(PERK_PRICE[p.rarity]);
          return perkCard(p, () => { if (run.cash < c || !shop.perkIds.includes(p.id) || run.perks.includes(p.id)) return; run.cash -= c; run.perks.push(p.id); shop.perkIds = shop.perkIds.filter(id => id !== p.id); sfx.cash(); app.saveRun(); render(); }, c, run.cash < c, run.perks);
        }),
        h('div', { class: `card ${anyHurt && run.cash >= healCost ? '' : 'disabled'}`, 'data-nav': anyHurt && run.cash >= healCost ? '1' : '', onClick: () => { if (!anyHurt || run.cash < healCost) return; run.cash -= healCost; run.roster.forEach((s) => (s.hp = s.maxHp)); run.goalie.hp = 100; sfx.cash(); app.saveRun(); render(); } },
          h('div', { class: 'rarity' }, 'service'), h('div', { class: 'ico' }, '🩺'), h('div', { class: 'cname' }, 'Team Doctor'), h('div', { class: 'desc' }, 'Fully heal every skater and the goalie.'), h('div', { class: 'price' }, `${healCost} CASH`)),
        shop.hired ? null : h('div', { class: `card ${run.cash >= hireCost ? '' : 'disabled'}`, 'data-nav': run.cash >= hireCost ? '1' : '', onClick: () => { if (run.cash < hireCost || shop.hired) return; run.cash -= hireCost; run.roster.push(hire); shop.hired = true; sfx.cash(); app.saveRun(); render(); } },
          h('div', { class: 'rarity' }, 'free agent'), h('div', { class: 'ico' }, ARCHETYPES[hire.archetype as keyof typeof ARCHETYPES].icon), h('div', { class: 'cname' }, hire.name), h('div', { class: 'desc' }, `${ARCHETYPES[hire.archetype as keyof typeof ARCHETYPES].label}. ${ARCHETYPES[hire.archetype as keyof typeof ARCHETYPES].blurb}`),
          h('div', { class: 'cstats', html: Object.entries(hire.stats).map(([k, v]) => `<span>${k.slice(0, 3).toUpperCase()} <b>${v}</b></span>`).join('') }), h('div', { class: 'price' }, `${hireCost} CASH`)),
      ),
      h('div', { class: 'menu', style: 'flex-direction:row;justify-content:center' },
        btn(`Reroll perks (${rerollCost})`, () => { if (run.cash < rerollCost) return; run.cash -= rerollCost; shop.rerolls++; shop.perkIds = draftPerks(run, 3, 0.3).map(perk => perk.id); app.saveRun(); render(); }),
        btn('Leave Shop', () => { completeNode(run, node); app.saveRun(); runMapScreen(app); }, 'primary'),
      ),
    );
    // clean up nav attr for disabled cards
    body.querySelectorAll('.card.disabled').forEach((c) => c.removeAttribute('data-nav'));
    const el = h('div', { class: 'run-shell' }, topBar(app, run), h('div', { class: 'run-body' }, body, rosterPanel(run)));
    app.showScreen(el);
  };
  render();
}
