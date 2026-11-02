import { expect, test } from '@playwright/test';
import { makeTestUser } from './utils';

// Signed-in flows run in CI too since phase 012 (BETTER_AUTH_SECRET set, longer
// timeouts, one retry). E2E_SKIP_SIGNED_IN=1 is the escape hatch for a slow run.
test.describe('auth flow (ES)', () => {
  test.skip(() => process.env.E2E_SKIP_SIGNED_IN === '1', 'Signed-in flows disabled for this run');

  const user = makeTestUser();

  test('register via UI, see dashboard, sign out', async ({ page }) => {
    await page.goto('/es');
    await page.waitForLoadState('networkidle');

    // Go to login (wait for hydration and session check)
    await expect(page.getByRole('link', { name: 'Entrar' }).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole('link', { name: 'Entrar' }).first().click();
    await expect(page).toHaveURL(/\/es\/login/);

    // Switch to sign-up
    await page.getByRole('button', { name: /No tienes cuenta/ }).click();

    await page.getByLabel('Nombre', { exact: false }).fill(user.name);
    await page.getByLabel('Email', { exact: false }).fill(user.email);
    await page.getByLabel(/Contraseña/).fill(user.password);
    await page.getByRole('button', { name: /Reg.strate|Registrarme/ }).click();

    // Dashboard greets the new user (generous timeout for CI)
    await expect(page).toHaveURL(/dashboard/, { timeout: 30_000 });

    // Sign out from the shared header (any page has it since spec 010)
    await page.goto('/es');
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible({ timeout: 15_000 });
  });

  test('wrong password shows translated error', async ({ page }) => {
    await page.goto('/es/login');
    await page.getByLabel('Email', { exact: false }).fill(user.email);
    await page.getByLabel(/Contraseña/).fill('wrong-password');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText(/Email o contraseña incorrectos/)).toBeVisible();
  });
});
