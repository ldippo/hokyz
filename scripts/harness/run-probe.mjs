import { join } from 'node:path';
import assert from 'node:assert/strict';

export async function runProbe(page, out, prefix) {
  const findings = [];
  for (const [width, height, scale] of [[1280,720,1], [390,844,1], [390,844,1.5]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => {
      const app = window.__hokyz; app.meta.textScale = scale; app.applyAccessPrefs();
      document.querySelectorAll('.run-shell, .map-scroll, .side').forEach(el => { el.scrollTop = 0; el.scrollLeft = 0; });
    }, scale);
    await page.screenshot({ path: join(out, `${prefix}-${width}-${scale}.png`) });
    const clipped = [];
    for (const el of await page.locator('.run-shell [data-nav], .run-shell button, .run-shell .screen-title, .run-shell .cname, .run-shell .desc').all()) {
      await el.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const r = await el.boundingBox();
      if (!r || r.x < -1 || r.y < -1 || r.x+r.width > width+1 || r.y+r.height > height+1) clipped.push((await el.textContent())?.slice(0,100));
    }
    const overflow = await page.locator('.run-shell').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    findings.push({ width, height, scale, clipped, overflow });
    if (!process.argv.includes('--baseline')) assert.ok(!clipped.length && !overflow, JSON.stringify(findings.at(-1)));
  }
  await page.setViewportSize({ width:1280,height:900 });
  await page.evaluate(() => { const app=window.__hokyz; app.meta.textScale=1; app.applyAccessPrefs(); });
  return findings;
}
