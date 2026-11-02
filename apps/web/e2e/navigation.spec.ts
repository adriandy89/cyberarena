import { expect, test } from '@playwright/test';

// Spec 010: shared shell, breadcrumbs, room context and roadmap order.
test.describe('navigation shell (ES)', () => {
  test('every page shares the header and highlights the current section', async ({ page }) => {
    await page.goto('/es/rooms/linux-fundamentos-1');
    const mainNav = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(mainNav).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Rutas' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('room breadcrumbs lead to its path', async ({ page }) => {
    await page.goto('/es/rooms/linux-fundamentos-1');
    const crumbs = page.getByRole('navigation', { name: 'Ruta de navegación' });
    await crumbs.getByRole('link', { name: 'Cyber Security 101' }).click();
    await expect(page).toHaveURL(/\/es\/paths\/cyber-security-101$/);
  });

  test('room pager links the next room of the path', async ({ page }) => {
    await page.goto('/es/rooms/linux-fundamentos-1');
    const pager = page.getByRole('navigation', { name: 'Navegación entre rooms' });
    await pager.getByRole('link', { name: /Linux Fundamentos II/ }).click();
    await expect(page).toHaveURL(/\/es\/rooms\/linux-fundamentos-2$/);
    await expect(page.getByText(/Room \d+ de \d+/)).toBeVisible();
  });

  test('tasks are deep-linkable with ?task=N', async ({ page }) => {
    await page.goto('/es/rooms/linux-fundamentos-1?task=2');
    await expect(page.getByText('Tarea 2 de 4').first()).toBeVisible();
  });

  test('paths are listed in roadmap order (CS101 first)', async ({ page }) => {
    await page.goto('/es/paths');
    await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Cyber Security 101');
  });

  test('unknown pages show the Byte 404 with a way out', async ({ page }) => {
    await page.goto('/es/rooms/no-existe-este-room');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver las rutas' })).toBeVisible();
  });
});

test.describe('mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('drawer opens, navigates and closes', async ({ page }) => {
    await page.goto('/es');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menú' });
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Hacktivities' }).click();
    await expect(page).toHaveURL(/\/es\/hacktivities$/);
    await expect(drawer).toBeHidden();
  });
});
