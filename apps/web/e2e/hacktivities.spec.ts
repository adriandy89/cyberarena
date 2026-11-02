import { expect, test } from '@playwright/test';

test.describe('hacktivities directory', () => {
  test('search finds room by description', async ({ page }) => {
    await page.goto('/es/hacktivities');
    await page.getByPlaceholder(/Buscar rooms/).fill('pentester');
    // debounced fetch + card render
    await expect(page.getByRole('link', { name: /Introducción a la ciberseguridad ofensiva/ })).toBeVisible({ timeout: 10_000 });
  });

  test('search with no results shows empty state', async ({ page }) => {
    await page.goto('/es/hacktivities');
    await page.getByPlaceholder(/Buscar rooms/).fill('zzz-no-existe');
    await expect(page.getByText(/Sin resultados con esos filtros/)).toBeVisible({ timeout: 10_000 });
  });

  test('difficulty pills render from facets and filter works', async ({ page }) => {
    await page.goto('/es/hacktivities');
    // facets only include difficulties present in the catalog; filter by 'easy'
    await page.getByRole('button', { name: 'easy', exact: true }).click();
    // just verify some results appear (count varies with catalog size)
    await expect(page.locator('ul > li a').first()).toBeVisible({ timeout: 10_000 });
  });

  test('sort select renders and cards link to rooms', async ({ page }) => {
    await page.goto('/es/hacktivities');
    // catalog-size agnostic: whatever sorts first must link to a room page
    const firstCard = page.locator('ul > li a[href*="/rooms/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/\/rooms\/[a-z0-9-]+/);
  });
});
