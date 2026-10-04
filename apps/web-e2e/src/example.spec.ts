import { test, expect } from '@playwright/test';

test('home page shows the app name', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Thumbline');
});
