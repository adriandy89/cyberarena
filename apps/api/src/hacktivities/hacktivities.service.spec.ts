import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { HacktivitiesService } from './hacktivities.service';

const ROOMS = [
  {
    slug: 'nmap-basics',
    title: 'Nmap Basics',
    description: 'Escaneos de puertos desde cero.',
    difficulty: 'easy',
    type: 'walkthrough',
    estimatedMinutes: 45,
    tags: ['nmap', 'recon'],
    lab: null,
    createdAt: new Date('2026-11-01T10:00:00Z'),
    catalogModule: { catalogPath: { slug: 'jrpt', title: 'Jr Pentester' } },
    tasks: [{ questions: [{ id: 'n1' }, { id: 'n2' }] }],
  },
  {
    slug: 'sql-injection',
    title: 'SQL Injection',
    description: 'Inyección SQL práctica contra un lab.',
    difficulty: 'medium',
    type: 'challenge',
    estimatedMinutes: 60,
    tags: ['web', 'sqli'],
    lab: 'sqli-lab',
    createdAt: new Date('2026-11-01T12:00:00Z'),
    catalogModule: { catalogPath: { slug: 'cs101', title: 'Cyber Security 101' } },
    tasks: [{ questions: [{ id: 's1' }] }],
  },
];

function makeService(solved: Array<{ userId: string; questionId: string }> = []) {
  const prisma = {
    room: {
      findMany: vi.fn().mockResolvedValue(ROOMS),
    },
    questionSolved: {
      findMany: vi.fn().mockResolvedValue(solved),
    },
  } as unknown as PrismaService;
  return new HacktivitiesService(prisma);
}

describe('HacktivitiesService.list', () => {
  it('returns all rooms with facets by default', async () => {
    const result = await makeService().list({ sort: 'popular', take: 24, skip: 0 });
    expect(result.total).toBe(2);
    expect(result.rooms).toHaveLength(2);
    expect(result.facets.tags).toContain('nmap');
    expect(result.facets.difficulties).toEqual(['easy', 'medium']);
    expect(result.facets.types).toEqual(['walkthrough', 'challenge']);
  });

  it('searches case-insensitively across title, description and tags', async () => {
    const service = makeService();
    expect((await service.list({ q: 'NMAP', sort: 'popular', take: 24, skip: 0 })).total).toBe(1);
    expect((await service.list({ q: 'inyección', sort: 'popular', take: 24, skip: 0 })).total).toBe(1);
    expect((await service.list({ q: 'sqli', sort: 'popular', take: 24, skip: 0 })).total).toBe(1);
    expect((await service.list({ q: 'zzz', sort: 'popular', take: 24, skip: 0 })).total).toBe(0);
  });

  it('filters by difficulty, type and tag', async () => {
    const service = makeService();
    expect((await service.list({ difficulty: 'insane', sort: 'popular', take: 24, skip: 0 })).total).toBe(0);
    expect((await service.list({ difficulty: 'easy', sort: 'popular', take: 24, skip: 0 })).total).toBe(1);
    expect((await service.list({ type: 'challenge', sort: 'popular', take: 24, skip: 0 })).total).toBe(1);
    expect((await service.list({ tag: 'web', sort: 'popular', take: 24, skip: 0 })).total).toBe(1);
  });

  it('sorts by popular using full-room completions', async () => {
    // user A completed sqli (1/1) and only 1/2 of nmap -> sqli has 1 completion
    const service = makeService([
      { userId: 'A', questionId: 's1' },
      { userId: 'A', questionId: 'n1' },
    ]);
    const result = await service.list({ sort: 'popular', take: 24, skip: 0 });
    expect(result.rooms[0]!.slug).toBe('sql-injection');
    expect(result.rooms[0]!.completions).toBe(1);
    expect(result.rooms[1]!.completions).toBe(0);
  });

  it('sorts by az, za, time and newest', async () => {
    const service = makeService();
    expect((await service.list({ sort: 'az', take: 24, skip: 0 })).rooms[0]!.slug).toBe('nmap-basics');
    expect((await service.list({ sort: 'za', take: 24, skip: 0 })).rooms[0]!.slug).toBe('sql-injection');
    expect((await service.list({ sort: 'time', take: 24, skip: 0 })).rooms[0]!.slug).toBe('nmap-basics');
    expect((await service.list({ sort: 'newest', take: 24, skip: 0 })).rooms[0]!.slug).toBe('sql-injection');
  });

  it('paginates with skip/take over the filtered set', async () => {
    const service = makeService();
    const page = await service.list({ sort: 'az', take: 1, skip: 1 });
    expect(page.total).toBe(2);
    expect(page.rooms).toHaveLength(1);
    expect(page.rooms[0]!.slug).toBe('sql-injection');
  });
});
