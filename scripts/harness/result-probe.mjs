import { join } from 'node:path';
import assert from 'node:assert/strict';

export async function resultProbe(page, out, prefix) {
  const findings = [];
  for (const [width, height, scale] of [[1280,720,1], [390,844,1], [390,844,1.5]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => { const app = window.__hokyz; app.meta.textScale = scale; app.applyAccessPrefs(); document.querySelector('.screen').scrollTop = 0; const stats = document.querySelector('.match-stats'); if (stats) stats.scrollLeft = 0; }, scale);
    await page.screenshot({ path: join(out, `${prefix}-${width}-${scale}.png`) });
    const clipped = [];
    for (const el of await page.locator('.result [data-nav], .result h2, .result td, .result th').all()) {
      await el.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const r = await el.boundingBox();
      if (!r || r.x < -1 || r.y < -1 || r.x+r.width > width+1 || r.y+r.height > height+1) clipped.push(await el.textContent());
    }
    const overflow = await page.locator('.screen').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    const stats = page.locator('.match-stats');
    if (await stats.count() && await stats.evaluate(el => el.scrollWidth > el.clientWidth)) {
      await stats.evaluate(el => { el.scrollLeft = 0; });
      await stats.focus(); await stats.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.match-stats').scrollLeft > 0);
      for (const heading of await stats.locator('th').all()) assert.equal(await heading.evaluate(el => getComputedStyle(el).whiteSpace), 'nowrap');
    }
    findings.push({ width, height, scale, clipped, overflow });
    if (process.argv.includes('--assert-layout')) assert.ok(!clipped.length && !overflow, JSON.stringify(findings.at(-1)));
  }
  await page.setViewportSize({ width:1280, height:720 });
  await page.evaluate(() => { const app = window.__hokyz; app.meta.textScale = 1; app.applyAccessPrefs(); });
  return findings;
}
