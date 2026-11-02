import { describe, expect, it } from 'vitest';
import { KeyedMutex, Semaphore } from './mutex';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

describe('KeyedMutex', () => {
  it('runs tasks for the same key one after another, other keys in parallel', async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`start ${name}`);
      await tick();
      log.push(`end ${name}`);
    };
    await Promise.all([mutex.run('a', task('a1')), mutex.run('a', task('a2')), mutex.run('b', task('b1'))]);
    expect(log.indexOf('end a1')).toBeLessThan(log.indexOf('start a2'));
    expect(log.indexOf('start b1')).toBeLessThan(log.indexOf('end a1'));
  });

  it('keeps going after a failed task', async () => {
    const mutex = new KeyedMutex();
    await expect(mutex.run('a', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(mutex.run('a', async () => 'ok')).resolves.toBe('ok');
  });
});

describe('Semaphore', () => {
  it('never runs more than its size at once', async () => {
    const semaphore = new Semaphore(2);
    let active = 0;
    let peak = 0;
    await Promise.all(
      Array.from({ length: 6 }, () =>
        semaphore.run(async () => {
          active++;
          peak = Math.max(peak, active);
          await tick();
          active--;
        }),
      ),
    );
    expect(peak).toBe(2);
  });
});
