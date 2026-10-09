import { expect, test } from '@playwright/test';

// Temporary diagnostic (branch only): after Play on the Sheet, what the audio clock does in each browser.
test.describe.configure({ timeout: 180_000 });

test('audio clock after Play', async ({ page }) => {
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}] ${m.text()}`);
  });
  await page.addInitScript(() => {
    type Diag = { ctxs: AudioContext[]; log: string[]; errors: string[]; starts: number };
    const d: Diag = { ctxs: [], log: [], errors: [], starts: 0 };
    (window as unknown as { __diag: Diag }).__diag = d;
    const log = (m: string) => d.log.push(`${(performance.now() / 1000).toFixed(2)}s ${m}`);
    window.addEventListener('error', (e) => d.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => d.errors.push(`rejection ${String(e.reason)}`));
    const Orig = window.AudioContext;
    window.AudioContext = class extends Orig {
      constructor(...a: ConstructorParameters<typeof AudioContext>) {
        super(...a);
        d.ctxs.push(this);
        log(`new AudioContext state=${this.state} sr=${this.sampleRate}`);
      }
    };
    for (const m of ['resume', 'suspend', 'close'] as const) {
      const f = Orig.prototype[m];
      Orig.prototype[m] = function (this: AudioContext) {
        log(`${m}() state=${this.state}`);
        return f.apply(this).then(
          (v) => {
            log(`${m} resolved state=${this.state} now=${this.currentTime.toFixed(3)}`);
            return v;
          },
          (e) => {
            log(`${m} rejected ${String(e)}`);
            throw e;
          },
        );
      };
    }
    const dec = Orig.prototype.decodeAudioData;
    Orig.prototype.decodeAudioData = function (this: AudioContext, ...a: Parameters<AudioContext['decodeAudioData']>) {
      log(`decodeAudioData() state=${this.state}`);
      const p = dec.apply(this, a);
      p.then(
        (b) => log(`decoded ${b.duration.toFixed(2)}s`),
        (e) => log(`decode failed ${String(e)}`),
      );
      return p;
    };
    const st = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...a: Parameters<AudioBufferSourceNode['start']>) {
      d.starts++;
      return st.apply(this, a);
    };
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'or try a sample clip' }).click();
  await expect(page).toHaveURL(/\/sheet$/, { timeout: 90_000 });
  await expect(page.getByText('Your sheet', { exact: true })).toBeVisible();

  // The same steps as the flow test before Play.
  const first = page.getByRole('button', { name: /^Bar 1: / });
  await first.click();
  const picker = page.locator('[popover]:popover-open');
  const choices = picker.locator('[role="group"] button');
  await expect(choices.first()).toBeVisible();
  await choices.nth(1).click();
  await page.getByRole('button', { name: 'Customize' }).click();
  const customize = page.getByRole('dialog', { name: 'Customize' });
  await customize.getByRole('radiogroup', { name: 'Level' }).getByText('Moderate', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(customize).toBeHidden();

  const snapshot = () =>
    page.evaluate(() => {
      const d = (window as unknown as { __diag: { ctxs: AudioContext[]; log: string[]; errors: string[]; starts: number } }).__diag;
      return {
        t: Math.round(performance.now()) / 1000,
        ctxs: d.ctxs.map((c) => ({
          state: c.state,
          now: Math.round(c.currentTime * 1000) / 1000,
          ts: typeof c.getOutputTimestamp === 'function' ? c.getOutputTimestamp() : null,
          base: c.baseLatency,
          out: c.outputLatency,
        })),
        starts: d.starts,
        playhead: document.querySelectorAll('[data-playhead]').length,
        play: document.querySelector('[aria-label="Player"] button')?.getAttribute('aria-label'),
        errors: d.errors.splice(0),
        log: d.log.splice(0),
      };
    });
  console.log('before Play ' + JSON.stringify(await snapshot()));
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  for (let i = 0; i < 12; i++) {
    console.log(`+${i}s ` + JSON.stringify(await snapshot()));
    await page.waitForTimeout(1000);
  }
});
