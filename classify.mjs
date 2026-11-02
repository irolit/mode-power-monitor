// Decides what a page we loaded from the DTEK site actually is. Pure function: easy to test, no network.
// It never tries to get past a protection page; it only RECOGNISES one so MODE can say "source unavailable".
export const CHALLENGE_MARKERS = [
  ['incapsula', /_incapsula_resource|incapsula incident id|request unsuccessful\. incapsula/i],
  ['imperva', /imperva|x-iinfo/i],
  ['cloudflare', /just a moment\.\.\.|cf-chl|challenge-platform|attention required! \| cloudflare/i],
  ['captcha', /captcha|g-recaptcha|hcaptcha|turnstile/i],
  ['access_denied', /access denied|доступ заборонено|доступ запрещ[её]н/i],
];
export function classify({ status, html, title }) {
  const markers = CHALLENGE_MARKERS.filter(([, re]) => re.test(html) || re.test(title || '')).map(([name]) => name);
  const hasSchedule = /DisconSchedule/.test(html);
  let scheduleParsed = null;
  if (hasSchedule) {
    const m = /DisconSchedule\.fact\s*=\s*(\{[\s\S]*?\})\s*(?:;|<\/script>|\n)/.exec(html);
    if (m) { try { const o = JSON.parse(m[1]); scheduleParsed = { keys: Object.keys(o).slice(0, 8), hasData: !!o.data }; } catch { scheduleParsed = 'unparsed'; } }
  }
  let result;
  if (status >= 400) result = markers.length ? 'blocked_with_protection_page' : 'blocked_http_' + status;
  else if (hasSchedule) result = 'schedule_data_present';
  else if (markers.length) result = 'protection_challenge';
  else if (html.length < 2000) result = 'empty_or_tiny_page';
  else result = 'unknown_page';
  return { result, markers, hasSchedule, scheduleParsed, size: html.length };
}
