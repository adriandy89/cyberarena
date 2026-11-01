import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';

const NOW = new Date('2026-11-01T20:00:00.000Z');
const day = (offsetFromToday: number, hour = 10) =>
  new Date(NOW.getTime() + offsetFromToday * 86_400_000 + (hour - 20) * 3_600_000);

describe('computeStreak', () => {
  it('returns zeros when there is no activity', () => {
    const info = computeStreak([], NOW);
    expect(info).toMatchObject({ current: 0, best: 0, solvedToday: 0, qualifiedToday: false });
    expect(info.required).toBe(3);
  });

  it('counts a day only when it has >= 3 correct answers', () => {
    const info = computeStreak([day(0), day(0), day(0)], NOW); // 3 today
    expect(info.current).toBe(1);
    expect(info.qualifiedToday).toBe(true);

    const twoToday = computeStreak([day(0), day(0)], NOW);
    expect(twoToday.current).toBe(0);
    expect(twoToday.qualifiedToday).toBe(false);
  });

  it('keeps the current streak alive when today is still in progress (ends yesterday)', () => {
    const dates = [
      day(-2), day(-2), day(-2), // 3 the day before yesterday
      day(-1), day(-1), day(-1), // 3 yesterday
    ];
    const info = computeStreak(dates, NOW);
    expect(info.current).toBe(2);
    expect(info.qualifiedToday).toBe(false);
    expect(info.solvedToday).toBe(0);
  });

  it('counts consecutive qualifying days including today', () => {
    const dates = [
      day(-1), day(-1), day(-1),
      day(0), day(0), day(0),
    ];
    expect(computeStreak(dates, NOW).current).toBe(2);
  });

  it('breaks streaks on gaps', () => {
    const dates = [
      day(-5), day(-5), day(-5),
      day(-3), day(-3), day(-3), // gap at -4
      day(-2), day(-2), day(-2),
      day(-1), day(-1), day(-1),
    ];
    const info = computeStreak(dates, NOW);
    expect(info.current).toBe(3);
    expect(info.best).toBe(3);
  });

  it('best keeps the historical maximum even when the current streak is shorter', () => {
    const dates = [
      day(-9), day(-9), day(-9),
      day(-8), day(-8), day(-8),
      day(-7), day(-7), day(-7), // best: 3
      day(-1), day(-1), day(-1), // current: 1
    ];
    const info = computeStreak(dates, NOW);
    expect(info.current).toBe(1);
    expect(info.best).toBe(3);
  });

  it('accepts ISO strings as input', () => {
    const info = computeStreak(['2026-11-01T08:00:00Z', '2026-11-01T09:00:00Z', '2026-11-01T10:00:00Z'], NOW);
    expect(info.current).toBe(1);
  });
});
