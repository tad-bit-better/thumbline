import { type Page, expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Analysis runs in a Web Worker with WASM; give slower engines room.
test.describe.configure({ timeout: 120_000 });

// This project compiles to CommonJS, so require.resolve is available.
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

async function expectNoAxeViolations(page: Page) {
  await page.addScriptTag({ content: AXE });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: Element) => Promise<{ violations: Array<{ id: string; nodes: unknown[] }> }> } }).axe;
    const r = await axe.run(document.body);
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
  expect(violations).toEqual([]);
}

async function toReview(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'or try a sample clip' }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(page.getByRole('heading', { name: 'Listening to your song' })).toBeVisible();
  await expect(page).toHaveURL(/\/review$/, { timeout: 90_000 });
}

test('a clip goes from upload to a playable sheet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Turn any song into a right-hand sheet.');
  await expectNoAxeViolations(page);

  await toReview(page);
  await expect(page.getByRole('heading', { name: 'Check the chords' })).toBeVisible();
  await expect(page.getByText(/chords? to check|All chords checked/)).toBeVisible();
  await expectNoAxeViolations(page);

  // Pick an alternative for the first bar.
  // The block's name carries its section and time: "Section A starts. Bar 1 at 0:00: G".
  const first = page.getByRole('button', { name: /\bBar 1 at \d+:\d\d: / });
  await first.click();
  const options = page.locator('[popover]:popover-open button');
  await expect(options.first()).toBeVisible();
  const alternative = String(await options.nth(1).getAttribute('aria-label'));
  await options.nth(1).click();
  await expect(first).toHaveAttribute('aria-label', new RegExp(`Bar 1 at \\d+:\\d\\d: ${alternative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, confirmed$`));

  await page.getByRole('button', { name: 'Looks good, write my sheets' }).click();
  await expect(page).toHaveURL(/\/sheet$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Your sheet' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Chord shapes' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Arpeggio tab' })).toBeVisible();
  await expectNoAxeViolations(page);

  // Click the visible segment, as a person would (the radio input itself is transparent).
  await page.getByRole('radiogroup', { name: 'Level' }).getByText('Moderate', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Moderate' })).toBeChecked();
  await expect(page.getByText('Pinch and roll')).toBeVisible();

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
  // The first note can take a while when several browsers analyse and set up audio at once.
  await expect(page.locator('[data-playhead]')).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

  // Click a later bar on the tab: it plays from there, and Pause keeps the place.
  // How many bars a row holds depends on the window and the grid (the tune uses 16ths), so
  // click the last row and check the place moved forward, not a fixed bar number.
  const position = page.getByRole('slider', { name: 'Position in song' });
  const barOf = async () => Number(/^Bar (\d+) of/.exec(String(await position.getAttribute('aria-valuetext')))?.[1]);
  const before = await barOf();
  await page.locator('[data-system]').last().click({ position: { x: 120, y: 90 } });
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
  await expect.poll(barOf).toBeGreaterThan(before + 1);
  await page.getByRole('button', { name: 'Pause' }).click();
  const here = await position.getAttribute('aria-valuetext');
  await page.getByRole('button', { name: 'Back one bar' }).click();
  await expect(position).not.toHaveAttribute('aria-valuetext', String(here));

  // Flamenco: rumba by default; strums and golpes play.
  // The whole card is the radio's hit area.
  await page.getByRole('radio', { name: 'Flamenco' }).click();
  // Rumba is the default palo; which rumba pattern opens depends on the song's mood (M10).
  await expect(page.getByRole('radio', { name: 'Rumba' })).toBeChecked();
  await expect(page.getByRole('region', { name: 'Flamenco tab' })).toBeVisible();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Pause' }).click();
  await expectNoAxeViolations(page);
});

test('the song survives a reload', async ({ page }) => {
  await toReview(page);
  await page.getByRole('button', { name: 'Looks good, write my sheets' }).click();
  await expect(page).toHaveURL(/\/sheet$/);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Your sheet' })).toBeVisible();
  await expect(page.getByText('Sample clip (G Em C D).wav')).toBeVisible();
});

test('an unsupported file is explained in the drop zone', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  // Next's route announcer is also an alert; match ours by its text.
  await expect(page.getByRole('alert').filter({ hasText: 'MP3, WAV or M4A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try another file' })).toBeVisible();
});
