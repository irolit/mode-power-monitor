
import { chromium } from 'playwright';
import { writeFileSync, appendFileSync } from 'node:fs';
import { classify } from './classify.mjs';

const URL_ = 'https://www.dtek-krem.com.ua/ua/shutdowns';
const tries = [], t0 = Date.now();

const browser = await chromium.launch({
  channel: process.env.PROBE_CHANNEL || 'chrome',
  headless: true
});
const ctx = await browser.newContext({
  locale: 'uk-UA',
  timezoneId: 'Europe/Kyiv'
});

for (let i = 1; i <= 3; i++) {
  const page = await ctx.newPage();
  const started = Date.now();
  let status = 0, html = '', title = '', error = null;
  let popupClose = 'not_attempted';

  try {
    const resp = await page.goto(URL_, {
      waitUntil: 'domcontentloaded',
      timeout: 45000
    });
    status = resp ? resp.status() : 0;

    await page.waitForLoadState('networkidle', {
      timeout: 20000
    }).catch(() => {});

    // Обычная попытка закрыть информационное окно крестиком.
    const closeSelectors = [
      'button[aria-label="Close"]',
      'button[aria-label="Закрити"]',
      'button[aria-label="Закрыть"]',
      '[role="button"][aria-label="Close"]',
      '[role="button"][aria-label="Закрити"]',
      '[role="button"][aria-label="Закрыть"]',
      'button.close',
      '.modal button.close',
      '.popup button.close',
      '[class*="close"] button',
      'button[class*="close"]'
    ];

    for (const selector of closeSelectors) {
      const candidate = page.locator(selector).first();
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(1000);
        popupClose = 'clicked: ' + selector;
        break;
      }
    }

    if (popupClose === 'not_attempted') {
      popupClose = 'close_button_not_found';
    }

    html = await page.content();
    title = await page.title();

    if (i === 1) {
      await page.screenshot({
        path: 'probe-screenshot.png',
        fullPage: false
      }).catch(() => {});
    }
  } catch (e) {
    error = String(e.message || e).split('\n')[0].slice(0, 200);
  }

  tries.push({
    n: i,
    ms: Date.now() - started,
    status,
    error,
    popupClose,
    ...classify({ status, html, title })
  });

  await page.close();
  if (i < 3) {
    await new Promise(r => setTimeout(r, 60000));
  }
}

await browser.close();

const verdict = tries.every(t => t.result === 'schedule_data_present')
  ? 'OK_all_3'
  : tries.some(t => t.result === 'schedule_data_present')
    ? 'PARTIAL'
    : 'NOT_AVAILABLE';

const out = {
  when: new Date().toISOString(),
  verdict,
  tries,
  totalMs: Date.now() - t0
};

writeFileSync('probe-result.json', JSON.stringify(out, null, 2));

const md =
  `## DTEK probe: **${verdict}**\n\n` +
  '| try | HTTP | result | popup | markers | page size | ms |\n' +
  '|---|---|---|---|---|---|---|\n' +
  tries.map(t =>
    `| ${t.n} | ${t.status || t.error} | ${t.result} | ${t.popupClose} | ${t.markers.join(', ') || '-'} | ${t.size} | ${t.ms} |`
  ).join('\n') + '\n';

console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}
