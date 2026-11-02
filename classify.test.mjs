import test from 'node:test'; import assert from 'node:assert/strict'; import { classify } from './classify.mjs';
const big = x => x + ' '.repeat(3000);
test('page with the schedule script is recognised and its structure is parsed (not its content)', () => {
  const html = big('<html><script>DisconSchedule.fact = {"data":{"1":{}},"update":"01.11.2026 10:00","today":1};</script></html>');
  const r = classify({ status: 200, html, title: 'Графіки' }); assert.equal(r.result, 'schedule_data_present'); assert.equal(r.scheduleParsed.hasData, true);
});
test('unparsable schedule is reported as unparsed, not as success of parsing', () => {
  const r = classify({ status: 200, html: big('DisconSchedule.fact = {broken};'), title: '' }); assert.equal(r.result, 'schedule_data_present'); assert.equal(r.scheduleParsed, 'unparsed');
});
test('protection pages are RECOGNISED as such (Incapsula / Cloudflare / CAPTCHA / access denied)', () => {
  assert.equal(classify({ status: 200, html: big('<iframe src="/_Incapsula_Resource?x"></iframe>'), title: '' }).result, 'protection_challenge');
  assert.equal(classify({ status: 403, html: big('Request unsuccessful. Incapsula incident ID: 1-2'), title: '' }).result, 'blocked_with_protection_page');
  assert.ok(classify({ status: 200, html: big('<title>Just a moment...</title> cf-chl'), title: 'Just a moment...' }).markers.includes('cloudflare'));
  assert.ok(classify({ status: 200, html: big('<div class="g-recaptcha"></div>'), title: '' }).markers.includes('captcha'));
});
test('plain HTTP errors, tiny pages and unknown pages are told apart', () => {
  assert.equal(classify({ status: 503, html: 'x', title: '' }).result, 'blocked_http_503'); assert.equal(classify({ status: 200, html: '<html></html>', title: '' }).result, 'empty_or_tiny_page');
  assert.equal(classify({ status: 200, html: big('<html>hello</html>'), title: 'x' }).result, 'unknown_page');
});
test('a schedule page that merely mentions the word captcha elsewhere is still a schedule page', () => {
  assert.equal(classify({ status: 200, html: big('DisconSchedule.fact = {"data":{}}; // captcha lib not used'), title: '' }).result, 'schedule_data_present');
});
