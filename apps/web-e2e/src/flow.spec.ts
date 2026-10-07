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

async function toSheet(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'or try a sample clip' }).click();
  await expect(page).toHaveURL(/\/listen$/);
  await expect(page.getByRole('heading', { name: 'Listening to your song' })).toBeVisible();
  await expect(page).toHaveURL(/\/sheet$/, { timeout: 90_000 });
}

test('a clip goes from upload to a playable sheet', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Turn any song into a right-hand sheet.');
  await expectNoAxeViolations(page);

  await toSheet(page);
  await expect(page.getByText('Your sheet', { exact: true })).toBeVisible();

  // Change the first bar's chord right on the sheet: our second guess.
  const first = page.getByRole('button', { name: /^Bar 1: / });
  await first.click();
  const picker = page.locator('[popover]:popover-open');
  const choices = picker.locator('[role="group"] button');
  await expect(choices.first()).toBeVisible();
  const second = String(await choices.nth(1).locator('b').textContent());
  await choices.nth(1).click();
  await expect(first).toHaveAttribute('aria-label', `Bar 1: ${second}, your choice. Change chord`);

  await expect(page.getByRole('heading', { level: 1, name: 'Sample clip (G Em C D)' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Chord shapes' }).first()).toBeVisible();
  await expect(page.getByRole('region', { name: 'Arpeggio tab' })).toBeVisible();
  await expectNoAxeViolations(page);

  // Style and level live in the Customize panel. Click the visible segment, as a person would
  // (the radio input itself is transparent).
  await page.getByRole('button', { name: 'Customize' }).click();
  const customize = page.getByRole('dialog', { name: 'Customize' });
  await customize.getByRole('radiogroup', { name: 'Level' }).getByText('Moderate', { exact: true }).click();
  await expect(customize.getByRole('radio', { name: 'Moderate' })).toBeChecked();
  await expect(customize.getByText('Pinch and roll', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(customize).toBeHidden();

  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 30_000 });
  // The first note can take a while when several browsers analyse and set up audio at once.
  await expect(page.locator('[data-playhead]')).toHaveCount(1, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

  // Click a later bar on the tab: it plays from there, and Pause keeps the place.
  // How many bars a row holds depends on the window and the grid (the tune uses 16ths), so
  // click the last row and check the place moved forward, not a fixed bar number.
  const position = page.getByRole('slider', { name: 'Position in song' });
  const barOf = async () => Number(/^Bar (\d+) of/.exec(String(await position.getAttribute('aria-valuetext')))?.[1]);
  const before = await barOf();
  await page.locator('[data-system]').last().click({ position: { x: 120, y: 90 } });
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect.poll(barOf).toBeGreaterThan(before + 1);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const here = await position.getAttribute('aria-valuetext');
  await page.getByRole('button', { name: 'Back one bar' }).click();
  await expect(position).not.toHaveAttribute('aria-valuetext', String(here));

  // Flamenco: rumba by default; strums and golpes play.
  await page.getByRole('button', { name: 'Customize' }).click();
  await customize.getByRole('radiogroup', { name: 'Style' }).getByText('Flamenco', { exact: true }).click();
  // Rumba is the default palo; which rumba pattern opens depends on the song's mood (M10).
  await expect(customize.getByRole('radio', { name: 'Rumba' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Flamenco tab' })).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expectNoAxeViolations(page);
});

test('the song survives a reload', async ({ page }) => {
  await toSheet(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Sample clip (G Em C D)' })).toBeVisible();
});

test('an unsupported file is explained in the drop zone', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  // Next's route announcer is also an alert; match ours by its text.
  await expect(page.getByRole('alert').filter({ hasText: 'MP3, WAV or M4A' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try another file' })).toBeVisible();
});
