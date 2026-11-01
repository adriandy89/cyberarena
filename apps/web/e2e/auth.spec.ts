import { expect, test } from '@playwright/test';
import { makeTestUser } from './utils';

test.describe('auth flow (ES)', () => {
  const user = makeTestUser();

  test('register via UI, see dashboard, sign out', async ({ page }) => {
    await page.goto('/es');

    // Go to login
    await page.getByRole('link', { name: 'Entrar' }).first().click();
    await expect(page).toHaveURL(/\/es\/login/);

    // Switch to sign-up
    await page.getByRole('button', { name: /No tienes cuenta/ }).click();

    await page.getByLabel('Nombre', { exact: false }).fill(user.name);
    await page.getByLabel('Email', { exact: false }).fill(user.email);
    await page.getByLabel(/Contraseña/).fill(user.password);
    await page.getByRole('button', { name: /Reg.strate|Registrarme/ }).click();

    // Dashboard greets the new user
    await expect(page).toHaveURL(/\/es\/dashboard/, { timeout: 15_000 });
    await expect(page.getByText(user.name).first()).toBeVisible({ timeout: 15_000 });

    // Sign out from the home page (dashboard has no header menu)
    await page.goto('/es');
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible({ timeout: 10_000 });
  });

  test('wrong password shows translated error', async ({ page }) => {
    await page.goto('/es/login');
    await page.getByLabel('Email', { exact: false }).fill(user.email);
    await page.getByLabel(/Contraseña/).fill('wrong-password');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByText(/Email o contraseña incorrectos/)).toBeVisible();
  });
});
