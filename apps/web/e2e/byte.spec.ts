import { expect, test } from '@playwright/test';
import { apiLogin, makeTestUser, sessionCookieOptions, TLS_OPTIONS } from './utils';

// Spec 010: Byte reacts to answers, respects reduced motion and can be hidden.
test.describe('Byte companion', () => {
  test('guests are asked to sign in instead of getting a wrong answer', async ({ page }) => {
    await page.goto('/es/rooms/linux-fundamentos-1');
    const question = page.locator('li', { hasText: 'nombre de usuario actual' }).first();
    await question.getByPlaceholder('Tu respuesta').fill('whoami');
    await question.getByRole('button', { name: 'Enviar' }).click();
    await expect(
      question.getByText('Necesitas iniciar sesión para enviar respuestas.'),
    ).toBeVisible();
    await expect(question.getByText(/Incorrecta/)).toHaveCount(0);
    await expect(page.getByTestId('byte-companion')).toHaveAttribute('data-mood', 'point');
  });

  test('animations are disabled under prefers-reduced-motion', async ({ browser }) => {
    // The shadow ellipse floats with Byte by default: a good probe for both cases.
    const animationOf = async (reducedMotion: 'reduce' | 'no-preference') => {
      const context = await browser.newContext({ ...TLS_OPTIONS, reducedMotion });
      const page = await context.newPage();
      await page.goto('/es');
      const name = await page
        .locator('[data-byte] ellipse')
        .first()
        .evaluate((element) => getComputedStyle(element).animationName);
      await context.close();
      return name;
    };
    expect(await animationOf('no-preference')).not.toBe('none');
    expect(await animationOf('reduce')).toBe('none');
  });

  test('hiding Byte persists across reloads and the footer brings it back', async ({ page }) => {
    await page.goto('/es');
    const companion = page.getByTestId('byte-companion');
    await expect(companion).toBeVisible();
    await page.getByRole('button', { name: 'Ocultar a Byte' }).first().click();
    await expect(companion).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('byte-companion')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mostrar a Byte' }).click();
    await expect(page.getByTestId('byte-companion')).toBeVisible();
  });

  test.describe('signed in', () => {
    test.skip(() => process.env.E2E_SKIP_SIGNED_IN === '1', 'Signed-in flows disabled for this run');

    const user = makeTestUser();
    let cookie = '';

    test.beforeAll(async () => {
      cookie = await apiLogin(user);
    });

    test('Byte cheers a correct answer and nudges the hint after repeated misses', async ({
      browser,
    }) => {
      const context = await browser.newContext(sessionCookieOptions(cookie));
      const page = await context.newPage();
      await page.goto('/es/rooms/linux-fundamentos-1');
      const companion = page.getByTestId('byte-companion');

      const first = page.locator('li', { hasText: 'nombre de usuario actual' }).first();
      await first.getByPlaceholder('Tu respuesta').fill('whoami');
      await first.getByRole('button', { name: 'Enviar' }).click();
      await expect(first.getByText('✓ Correcta')).toBeVisible({ timeout: 10_000 });
      await expect(companion).toHaveAttribute('data-mood', 'happy');

      const second = page.locator('li', { hasText: 'directorio de trabajo actual' }).first();
      for (const attempt of [1, 2, 3]) {
        await second.getByPlaceholder('Tu respuesta').fill(`mal-${attempt}`);
        await second.getByRole('button', { name: 'Enviar' }).click();
        await expect(second.getByText(/Incorrecta/)).toBeVisible();
      }
      await expect(companion).toHaveAttribute('data-mood', 'hint');
      await context.close();
    });
  });
});
