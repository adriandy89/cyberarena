import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  getLevelForXp,
  xpForQuestion,
  xpForRoomCompletion,
  isStreakDay,
  STREAK_MIN_QUESTIONS_PER_DAY,
} from './gamification';

describe('LEVELS', () => {
  it('has 21 levels with strictly increasing thresholds starting at 0', () => {
    expect(LEVELS).toHaveLength(21);
    expect(LEVELS[0]!.threshold).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.threshold).toBeGreaterThan(LEVELS[i - 1]!.threshold);
    }
  });
});

describe('getLevelForXp', () => {
  it('starts at NEOPHYTE with 0 XP', () => {
    const p = getLevelForXp(0);
    expect(p.level.name).toBe('NEOPHYTE');
    expect(p.progressRatio).toBe(0);
  });

  it('hits APPRENTICE exactly at 200 XP', () => {
    expect(getLevelForXp(199).level.name).toBe('NEOPHYTE');
    expect(getLevelForXp(200).level.name).toBe('APPRENTICE');
    expect(getLevelForXp(200).progressRatio).toBe(0);
  });

  it('computes progress ratio inside a level span', () => {
    // APPRENTICE: 200..500 -> 350 is exactly halfway
    const p = getLevelForXp(350);
    expect(p.level.name).toBe('APPRENTICE');
    expect(p.progressRatio).toBeCloseTo(0.5);
    expect(p.xpToNextLevel).toBe(150);
  });

  it('clamps to GRANDMASTER with ratio 1 and no next level', () => {
    const p = getLevelForXp(10_000_000);
    expect(p.level.name).toBe('GRANDMASTER');
    expect(p.progressRatio).toBe(1);
    expect(p.xpToNextLevel).toBe(0);
  });

  it('clamps negative XP to 0', () => {
    expect(getLevelForXp(-50).currentXp).toBe(0);
  });
});

describe('XP per question / room completion', () => {
  it('rewards challenge and capstone rooms more than walkthroughs', () => {
    expect(xpForQuestion('walkthrough')).toBe(10);
    expect(xpForQuestion('challenge')).toBe(30);
    expect(xpForQuestion('capstone')).toBe(40);
    expect(xpForRoomCompletion('capstone')).toBeGreaterThan(xpForRoomCompletion('challenge'));
    expect(xpForRoomCompletion('challenge')).toBeGreaterThan(xpForRoomCompletion('walkthrough'));
  });
});

describe('streaks', () => {
  it('requires the configured minimum answers per day', () => {
    expect(STREAK_MIN_QUESTIONS_PER_DAY).toBe(3);
    expect(isStreakDay(0)).toBe(false);
    expect(isStreakDay(2)).toBe(false);
    expect(isStreakDay(3)).toBe(true);
    expect(isStreakDay(10)).toBe(true);
  });
});
