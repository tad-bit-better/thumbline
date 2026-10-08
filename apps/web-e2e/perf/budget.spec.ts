import { type CDPSession, type Page, expect, test } from '@playwright/test';

/**
 * The budgets (PLAN.md M8): first-load JavaScript, compressed, as the browser
 * downloads it; and Largest Contentful Paint with the CPU slowed 4× (a
 * mid-range phone). First-load JavaScript is what the page's HTML asks for to
 * render (as Next.js counts it): chunks loaded later on purpose (motion's
 * features after first paint, the analysis worker when analysis starts, the
 * animation player on first interaction) don't count, and are listed apart.
 */
const JS_BUDGET_KB = 200;
const LCP_BUDGET_MS = 2500;
const CPU_SLOWDOWN = 4;

type Script = { url: string; kb: number };
type Measure = { jsKb: number; lcpMs: number; scripts: Script[]; later: Script[] };

async function freshLoad(page: Page, cdp: CDPSession, path: string): Promise<Measure> {
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  const response = await page.goto(path, { waitUntil: 'load' });
  // The chunks the HTML itself names: scripts and preloads.
  const html = (await response?.text()) ?? '';
  const initial = new Set([...html.matchAll(/\/_next\/static\/[^"'\s)]+?\.js/g)].map((m) => m[0]));
  // Let a late LCP candidate (a web font swap, say) land.
  await page.waitForTimeout(1000);
  const m = await page.evaluate(async () => {
    const lcp = await new Promise<number>((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1]?.startTime ?? 0);
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(0), 2000);
    });
    const scripts = (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
      .filter((r) => r.initiatorType === 'script' || /\.m?js(\?|$)/.test(r.name))
      .map((r) => ({ url: new URL(r.name).pathname, kb: Math.round((r.encodedBodySize / 1024) * 10) / 10 }));
    return { lcpMs: Math.round(lcp), all: scripts };
  });
  const scripts = m.all.filter((s) => initial.has(s.url));
  const later = m.all.filter((s) => !initial.has(s.url));
  const jsKb = Math.round(scripts.reduce((s, x) => s + x.kb, 0) * 10) / 10;
  return { jsKb, lcpMs: m.lcpMs, scripts, later };
}

function report(name: string, m: Measure) {
  const top = [...m.scripts].sort((a, b) => b.kb - a.kb).slice(0, 5);
  console.log(`${name}: first-load JS ${m.jsKb} KB (budget ${JS_BUDGET_KB}), LCP ${m.lcpMs} ms at ${CPU_SLOWDOWN}× CPU (budget ${LCP_BUDGET_MS})`);
  for (const s of top) console.log(`  ${s.kb} KB  ${s.url}`);
  const later = Math.round(m.later.reduce((s, x) => s + x.kb, 0) * 10) / 10;
  if (later) console.log(`  (+ ${later} KB loaded after first render, not counted)`);
}

test('the landing page fits the budget', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const m = await freshLoad(page, cdp, '/');
  report('Upload (/)', m);
  expect(m.jsKb).toBeLessThanOrEqual(JS_BUDGET_KB);
  expect(m.lcpMs).toBeGreaterThan(0);
  expect(m.lcpMs).toBeLessThanOrEqual(LCP_BUDGET_MS);
});

test('a returning song\'s sheet fits the budget', async ({ browser }) => {
  test.setTimeout(150_000);
  // Analyse the sample clip once, so the song is saved on the device.
  const context = await browser.newContext();
  const setup = await context.newPage();
  await setup.goto('/');
  await setup.getByRole('button', { name: 'or try a sample clip' }).click();
  await setup.waitForURL(/\/sheet$/, { timeout: 120_000 });
  await setup.close();
  // Come back to it fresh: nothing cached but the song itself.
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  const m = await freshLoad(page, cdp, '/sheet');
  report('Sheet (/sheet)', m);
  await expect(page.getByRole('region', { name: /tab$/ })).toBeVisible();
  expect(m.jsKb).toBeLessThanOrEqual(JS_BUDGET_KB);
  expect(m.lcpMs).toBeGreaterThan(0);
  expect(m.lcpMs).toBeLessThanOrEqual(LCP_BUDGET_MS);
  await context.close();
});
