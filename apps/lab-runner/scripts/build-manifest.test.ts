import { describe, expect, it } from 'vitest';
import { loadLabs } from './build-manifest';

// Every real lab in the repo passes the security lint (phase 011, ADR-015).
describe('labs/*/compose.yaml', () => {
  const { entries, issues } = loadLabs();

  it('pass the lint', () => {
    expect(issues.map((issue) => `${issue.slug}${issue.service ? `/${issue.service}` : ''} [${issue.rule}] ${issue.message}`)).toEqual([]);
  });

  it('are all in the manifest, with a unique project each', () => {
    expect(entries.length).toBeGreaterThanOrEqual(39);
    expect(new Set(entries.map((entry) => entry.project)).size).toBe(entries.length);
    expect(entries.some((entry) => entry.slug.startsWith('_'))).toBe(false);
  });

  it('expose a way in: a URL for http labs, a service for exec labs', () => {
    for (const entry of entries) {
      if (entry.access === 'http') expect(entry.url, entry.slug).toMatch(/^http:\/\/127\.0\.0\.1:\d+/);
      else expect(entry.execService, entry.slug).toBeTruthy();
    }
  });
});
