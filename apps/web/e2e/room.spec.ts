import { expect, test } from '@playwright/test';
import { apiLogin, makeTestUser, sessionCookieOptions } from './utils';

test.describe('room player (linux-fundamentos-1)', () => {
  const user = makeTestUser();
  let cookie = '';

  test.beforeAll(async () => {
    cookie = await apiLogin(user);
  });

  test('solve a question via UI: feedback, XP badge and progress', async ({ browser }) => {
    const context = await browser.newContext(sessionCookieOptions(cookie));
    const page = await context.newPage();

    await page.goto('/es/rooms/linux-fundamentos-1');

    // Room header
    await expect(page.getByRole('heading', { name: /Linux Fundamentos I/ })).toBeVisible();
    // First question of task 1 (whoami)
    const firstQuestion = page.locator('li', { hasText: 'nombre de usuario actual' }).first();
    await firstQuestion.getByPlaceholder('Tu respuesta').fill('whoami');
    await firstQuestion.getByRole('button', { name: 'Enviar' }).click();

    // Correct feedback appears with the solved mark
    await expect(firstQuestion.getByText('✓ Correcta')).toBeVisible({ timeout: 10_000 });

    // Progress header advances (1/10 for this room)
    await expect(page.getByText(/1\/10 preguntas/)).toBeVisible();

    // Wrong answer on the next question shows the error message
    const secondQuestion = page.locator('li', { hasText: 'directorio de trabajo actual' }).first();
    await secondQuestion.getByPlaceholder('Tu respuesta').fill('respuesta-mala');
    await secondQuestion.getByRole('button', { name: 'Enviar' }).click();
    await expect(secondQuestion.getByText(/Incorrecta/)).toBeVisible({ timeout: 10_000 });

    // Hint toggle works
    await secondQuestion.getByRole('button', { name: 'Mostrar pista' }).click();
    await expect(secondQuestion.getByText(/Print Working Directory/i)).toBeVisible();

    await context.close();
  });

  test('task navigation moves between tasks', async ({ browser }) => {
    const context = await browser.newContext(sessionCookieOptions(cookie));
    const page = await context.newPage();
    await page.goto('/es/rooms/linux-fundamentos-1');

    await expect(page.getByText('Tarea 1 de 3')).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.getByText('Tarea 2 de 3')).toBeVisible();
    await context.close();
  });
});
