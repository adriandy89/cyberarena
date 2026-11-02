/**
 * Operator CLI for the runner, run inside its container:
 *   docker compose exec lab-runner node dist/cli.js <command> [slug]
 *
 *   health | ls | up <slug> [--wait] | down <slug> | down-all
 *
 * It talks to the local HTTP API with the same token, so it obeys the same
 * rules (manifest, capacity, deadlines) as the API.
 */
import { readFileSync } from 'node:fs';

const port = Number(process.env.LAB_RUNNER_PORT ?? 4100);
const tokenFile = process.env.LAB_RUNNER_TOKEN_FILE;
const token = (tokenFile ? readFileSync(tokenFile, 'utf8') : (process.env.LAB_RUNNER_TOKEN ?? '')).trim();

async function call(method: 'GET' | 'POST', path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function waitFor(slug: string): Promise<number> {
  for (let i = 0; i < 120; i++) {
    const { body } = await call('GET', '/labs');
    const lab = (body.labs as Array<{ slug: string; state: string; lastError: string | null }>).find(
      (candidate) => candidate.slug === slug,
    );
    if (lab?.state === 'running') return 0;
    if (lab && ['error', 'exited', 'unavailable', 'stopped'].includes(lab.state)) {
      console.error(`${slug}: ${lab.state}${lab.lastError ? ` (${lab.lastError})` : ''}`);
      return 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error(`${slug}: still starting after 120 s`);
  return 1;
}

async function main(): Promise<number> {
  const [command, slug] = process.argv.slice(2);
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));
  switch (command) {
    case 'health': {
      const { status, body } = await call('GET', '/healthz');
      print(body);
      return status === 200 ? 0 : 1;
    }
    case 'ls': {
      const { body } = await call('GET', '/labs');
      for (const lab of body.labs as Array<{ slug: string; state: string; deadline: number | null }>) {
        if (lab.state === 'stopped' || lab.state === 'unavailable') continue;
        const left = lab.deadline ? `${Math.round((lab.deadline - Date.now()) / 1000)}s left` : '';
        console.log(`${lab.slug.padEnd(24)} ${lab.state.padEnd(10)} ${left}`);
      }
      return 0;
    }
    case 'up':
    case 'down': {
      if (!slug) break;
      const { status, body } = await call('POST', `/labs/${encodeURIComponent(slug)}/${command}`);
      print(body);
      if (status >= 400) return 1;
      return command === 'up' && process.argv.includes('--wait') ? waitFor(slug) : 0;
    }
    case 'down-all': {
      const { body } = await call('POST', '/down-all');
      print(body);
      return 0;
    }
  }
  console.error('usage: cli.js health | ls | up <slug> [--wait] | down <slug> | down-all');
  return 2;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
