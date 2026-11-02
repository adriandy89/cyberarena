import { cp, mkdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';

/**
 * Copies labs/<slug>/ into the assets volume (seen by the runner at
 * `assetsMount`) so lab containers can mount it by subpath. The copy is
 * replaced on every start; env files never leave the runner.
 */
export async function syncAssets(labsDir: string, assetsMount: string, slug: string): Promise<void> {
  const target = join(assetsMount, slug);
  await rm(target, { recursive: true, force: true });
  await mkdir(assetsMount, { recursive: true });
  await cp(join(labsDir, slug), target, {
    recursive: true,
    filter: (source) => !basename(source).endsWith('.env') && !basename(source).startsWith('flags.env'),
  });
}
