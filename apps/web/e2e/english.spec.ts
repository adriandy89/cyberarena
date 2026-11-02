import { expect, test } from '@playwright/test';
import { apiLogin, makeTestUser, sessionCookieOptions } from './utils';

// Spec 107: /en shows the theory in English and accepts English answers.
test.describe('English content (/en)', () => {
  test('room theory, prompts and options are in English', async ({ page }) => {
    await page.goto('/en/rooms/intro-ciberseguridad-ofensiva');
    await expect(page.getByText('Task 1 of 3').first()).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'The phases of a penetration test' }),
    ).toBeVisible();
    await expect(page.getByText(/best defines a pentester's job/)).toBeVisible();
  });

  test.describe('signed in', () => {
    test.skip(() => process.env.E2E_SKIP_SIGNED_IN === '1', 'Signed-in flows disabled for this run');

    const user = makeTestUser();
    let cookie = '';

    test.beforeAll(async () => {
      cookie = await apiLogin(user);
    });

    test('an English alternative answer is accepted', async ({ browser }) => {
      const context = await browser.newContext(sessionCookieOptions(cookie));
      const page = await context.newPage();
      await page.goto('/en/rooms/intro-ciberseguridad-ofensiva?task=2');
      // Canonical answer is "regla de compromiso"; "rules of engagement" is an accepted alternative.
      const question = page
        .locator('li', { hasText: 'What document defines WHAT can be tested' })
        .first();
      await question.getByPlaceholder('Your answer').fill('Rules of Engagement');
      await question.getByRole('button', { name: 'Submit' }).click();
      await expect(question.getByText('✓ Correct')).toBeVisible({ timeout: 10_000 });
      await context.close();
    });
  });
});
