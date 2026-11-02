import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { apiLogin, makeTestUser, sessionCookieOptions, TLS_OPTIONS } from './utils';

// Spec 011: labs on demand. Needs an API with LABS_ENABLED=true and a lab-runner
// (real, or LAB_RUNNER_DRY_RUN=1 in CI); skipped when labs are disabled.
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';

async function labsInfo(): Promise<{ enabled: boolean; idleTimeoutMinutes: number }> {
  const ctx = await request.newContext({ ...TLS_OPTIONS, baseURL: API_URL });
  try {
    const response = await ctx.get('/api/labs');
    return response.ok() ? await response.json() : { enabled: false, idleTimeoutMinutes: 0 };
  } catch {
    return { enabled: false, idleTimeoutMinutes: 0 };
  } finally {
    await ctx.dispose();
  }
}

async function apiAs(cookie: string): Promise<APIRequestContext> {
  return request.newContext({ ...TLS_OPTIONS, baseURL: API_URL, extraHTTPHeaders: { Cookie: cookie } });
}

test.describe('labs on demand', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  let info = { enabled: false, idleTimeoutMinutes: 0 };
  test.beforeAll(async () => {
    info = await labsInfo();
  });
  test.beforeEach(() => {
    test.skip(!info.enabled, 'labs on demand are disabled on this stack');
  });

  test('guests are asked to sign in', async ({ page }) => {
    await page.goto('/es/rooms/sqli-basico');
    await expect(page.getByTestId('lab-panel').getByText('Inicia sesión para arrancar el laboratorio.')).toBeVisible({
      timeout: 20_000,
    });
  });

  test('start, share and stop a lab from the room page', async ({ browser }) => {
    const ana = await apiLogin(makeTestUser());
    const bob = await apiLogin(makeTestUser());
    const context = await browser.newContext(sessionCookieOptions(ana));
    const page = await context.newPage();
    await page.goto('/es/rooms/sqli-basico');
    const panel = page.getByTestId('lab-panel');

    await panel.getByRole('button', { name: 'Iniciar lab' }).click();
    await expect(panel.getByRole('link', { name: /Abrir el lab/ })).toBeVisible({ timeout: 90_000 });
    await expect(panel).toHaveAttribute('data-lab-state', 'running');
    await expect(panel.getByText(/Se apagará a las/)).toBeVisible();

    // A second student joins the same instance.
    const bobApi = await apiAs(bob);
    const joined = await (await bobApi.post('/api/labs/sqli-basico/start', { data: {} })).json();
    expect(joined.users).toBe(2);
    await page.reload();
    await expect(panel.getByText('2 personas lo están usando')).toBeVisible({ timeout: 20_000 });

    // Ana leaves: the lab keeps running for Bob.
    await panel.getByRole('button', { name: 'Detener' }).click();
    await expect(panel.getByRole('button', { name: 'Iniciar lab' })).toBeVisible({ timeout: 20_000 });
    const forBob = await (await bobApi.get('/api/labs/sqli-basico')).json();
    expect(forBob).toMatchObject({ state: 'running', users: 1 });

    await bobApi.post('/api/labs/sqli-basico/stop');
    await bobApi.dispose();
    await context.close();
  });

  test('one lab per student: another lab offers to switch', async ({ browser }) => {
    const cookie = await apiLogin(makeTestUser());
    const api = await apiAs(cookie);
    await api.post('/api/labs/web-recon-1/start', { data: {} });

    const context = await browser.newContext(sessionCookieOptions(cookie));
    const page = await context.newPage();
    await page.goto('/en/rooms/xss-reflejado');
    const panel = page.getByTestId('lab-panel');
    await expect(panel.getByText(/You already have another lab running \(web-recon-1\)/)).toBeVisible({ timeout: 20_000 });
    await panel.getByRole('button', { name: 'Switch to this lab' }).click();
    await expect(panel.getByRole('link', { name: /Open the lab/ })).toBeVisible({ timeout: 90_000 });

    const old = await (await api.get('/api/labs/web-recon-1')).json();
    expect(old.mine).toBeNull();
    await api.post('/api/labs/xss-reflejado/stop');
    await api.dispose();
    await context.close();
  });

  test('a lab nobody uses is stopped by the reaper', async ({ browser }) => {
    test.skip(info.idleTimeoutMinutes !== 1, 'needs LAB_IDLE_TIMEOUT_MIN=1 and a short sweep');
    const cookie = await apiLogin(makeTestUser());
    const api = await apiAs(cookie);
    await api.post('/api/labs/ssrf-basico/start', { data: {} });
    // No page open → no heartbeats: the lease expires after 1 min.
    await expect
      .poll(async () => (await (await api.get('/api/labs/ssrf-basico')).json()).mine, { timeout: 100_000, intervals: [5_000] })
      .toBeNull();
    const context = await browser.newContext(sessionCookieOptions(cookie));
    const page = await context.newPage();
    await page.goto('/es/rooms/ssrf-basico');
    await expect(page.getByTestId('lab-panel').getByRole('button', { name: 'Iniciar lab' })).toBeVisible({ timeout: 20_000 });
    await api.dispose();
    await context.close();
  });
});
