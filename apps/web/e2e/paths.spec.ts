import { expect, test } from '@playwright/test';

test.describe('paths pages (guest)', () => {
  test('/es/paths lists Cyber Security 101 with rooms', async ({ page }) => {
    await page.goto('/es/paths');
    await expect(page.getByText('Cyber Security 101').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Introducción a la ciberseguridad ofensiva/ }).first()).toBeVisible();
  });

  test('path detail shows guest teaser and room structure', async ({ page }) => {
    await page.goto('/es/paths/cyber-security-101');
    await expect(page.getByText('Empieza tu viaje en ciberseguridad')).toBeVisible();
    await expect(page.getByText(/Inicia sesión para guardar tu progreso/)).toBeVisible();
    // module percent is hidden for guests — no % bars on room rows
    await expect(page.getByText(/Linux Fundamentos I/).first()).toBeVisible();
  });

  test('english locale renders translated teaser', async ({ page }) => {
    await page.goto('/en/paths/cyber-security-101');
    await expect(page.getByText(/Sign in to save your progress/)).toBeVisible();
  });
});
