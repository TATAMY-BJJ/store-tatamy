import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('inventory works on mobile and desktop; closed history retains original text', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/admin');
  await page.locator('input[type=password]').fill('preview-local');
  await page.getByRole('button', { name: /Přihlásit/ }).click();
  await page.waitForURL('**/admin/dashboard');
  await page.getByRole('link', { name: 'Inventury', exact: true }).click();
  await page.getByRole('button', { name: 'Zahájit inventuru' }).click();
  await expect(page.getByRole('heading', { name: 'Stoly', exact: true })).toBeVisible();
  await expect(page.getByText(/Invalid Date/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await mkdir('.local/qa', { recursive: true });
  await page.screenshot({ path: '.local/qa/inventory-mobile.png', fullPage: true });
  for (const [name, count] of [
    ['Stoly', '97'],
    ['Trička', '4'],
  ]) {
    const card = page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name, exact: true }) });
    await card.getByLabel('Napočítáno ve skladu').fill(count);
    await card.getByRole('button', { name: 'Potvrdit přepočítání' }).click();
    await expect(card.getByRole('button', { name: 'Opravit přepočítání' })).toBeVisible();
  }
  await expect(page.getByText('Všechny evidované kusy dohledány.', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByText(/Invalid Date/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/inventory-desktop.png', fullPage: true });
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Uzavřít inventuru', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Opravit přepočítání' })).toHaveCount(0);
  await expect(page.getByText(/Původní text množství.*3x M, 1x XL/)).toBeVisible();
  await page.goto('/admin/alerts');
  await expect(page.getByText(/Majetek je dohledaný, není potřeba dokupovat/)).toBeVisible();
});
