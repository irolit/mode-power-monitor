// MODE Power Monitor - stage P0: "can the official DTEK Kyiv-region schedule page be opened from GitHub at all?"
// Rules: a normal browser, default settings, 3 polite requests, no stealth, no CAPTCHA handling, no login, no address data.
// If the site answers with a protection page we record that fact and stop; we do not try to get around it.
import { chromium } from 'playwright';
import { writeFileSync, appendFileSync } from 'node:fs';
import { classify } from './classify.mjs';

const URL_ = 'https://www.dtek-krem.com.ua/ua/shutdowns';
const tries = [], t0 = Date.now();
const browser = await chromium.launch({ channel: process.env.PROBE_CHANNEL || 'chrome', headless: true });
const ctx = await browser.newContext({ locale: 'uk-UA', timezoneId: 'Europe/Kyiv' });
for (let i = 1; i <= 3; i++) {
  const page = await ctx.newPage(); const started = Date.now(); let status = 0, html = '', title = '', error = null;
  try {
    const resp = await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 45000 }); status = resp ? resp.status() : 0;
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    html = await page.content(); title = await page.title();
    if (i === 1) await page.screenshot({ path: 'probe-screenshot.png', fullPage: false }).catch(() => {});
  } catch (e) { error = String(e.message || e).split('\n')[0].slice(0, 200); }
  tries.push({ n: i, ms: Date.now() - started, status, error, ...classify({ status, html, title }) });
  await page.close();
  if (i < 3) await new Promise(r => setTimeout(r, 60000));      // one request a minute: gentle
}
await browser.close();
const verdict = tries.every(t => t.result === 'schedule_data_present') ? 'OK_all_3' : tries.some(t => t.result === 'schedule_data_present') ? 'PARTIAL' : 'NOT_AVAILABLE';
const out = { when: new Date().toISOString(), verdict, tries, totalMs: Date.now() - t0 };
writeFileSync('probe-result.json', JSON.stringify(out, null, 2));
const md = `## DTEK probe: **${verdict}**\n\n| try | HTTP | result | markers | page size | ms |\n|---|---|---|---|---|---|\n` +
  tries.map(t => `| ${t.n} | ${t.status || t.error} | ${t.result} | ${t.markers.join(', ') || '-'} | ${t.size} | ${t.ms} |`).join('\n') + '\n';
console.log(md); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
