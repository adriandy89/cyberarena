import { describe, expect, it } from 'vitest';
import {
  canExtend,
  earliestFreeSlot,
  expiryReason,
  extendedUntil,
  hasCapacity,
  leaseEnd,
  newLeaseTimes,
  type LabPolicy,
} from './lease-policy';

const MIN = 60_000;
const policy: LabPolicy = {
  idleTimeoutMs: 10 * MIN,
  sessionMaxMs: 120 * MIN,
  sessionCapMs: 240 * MIN,
  extendMs: 60 * MIN,
  extendWindowMs: 30 * MIN,
  maxRunning: 3,
};
const t0 = new Date('2026-11-02T10:00:00Z');
const at = (minutes: number) => new Date(t0.getTime() + minutes * MIN);

describe('lease policy', () => {
  it('starts a 2 h lease', () => {
    expect(newLeaseTimes(t0, policy)).toEqual({ startedAt: t0, lastSeenAt: t0, maxUntil: at(120) });
  });

  it('expires after 10 min without heartbeat, or at maxUntil', () => {
    const lease = newLeaseTimes(t0, policy);
    expect(expiryReason(lease, at(9), policy)).toBeNull();
    expect(expiryReason(lease, at(10), policy)).toBe('idle');
    const active = { ...lease, lastSeenAt: at(119) };
    expect(expiryReason(active, at(119), policy)).toBeNull();
    expect(expiryReason(active, at(120), policy)).toBe('max');
    expect(leaseEnd(active, policy)).toEqual(at(120));
  });

  it('can extend only in the last 30 min, by 1 h, up to 4 h in total', () => {
    let lease = { ...newLeaseTimes(t0, policy), lastSeenAt: at(89) };
    expect(canExtend(lease, at(89), policy)).toBe(false); // 31 min left
    expect(canExtend(lease, at(90), policy)).toBe(true);
    lease = { ...lease, maxUntil: extendedUntil(lease, policy) };
    expect(lease.maxUntil).toEqual(at(180));
    lease = { ...lease, maxUntil: extendedUntil(lease, policy) };
    expect(lease.maxUntil).toEqual(at(240));
    expect(canExtend(lease, at(230), policy)).toBe(false); // already at the cap
    expect(extendedUntil(lease, policy)).toEqual(at(240));
    expect(canExtend(lease, at(241), policy)).toBe(false); // expired
  });

  it('allows a lease on a leased lab or while fewer than 3 labs are leased', () => {
    expect(hasCapacity(new Set(['a', 'b']), 'c', policy)).toBe(true);
    expect(hasCapacity(new Set(['a', 'b', 'c']), 'd', policy)).toBe(false);
    expect(hasCapacity(new Set(['a', 'b', 'c']), 'b', policy)).toBe(true);
  });

  it('reports when the first lab slot frees up', () => {
    const leases = [
      { labSlug: 'a', ...newLeaseTimes(t0, policy), lastSeenAt: at(30) }, // a ends at 40 (idle)
      { labSlug: 'a', ...newLeaseTimes(t0, policy), lastSeenAt: at(50) }, // ...but this one keeps a until 60
      { labSlug: 'b', ...newLeaseTimes(t0, policy), lastSeenAt: at(45) }, // b ends at 55
    ];
    expect(earliestFreeSlot(leases, policy)).toEqual(at(55));
    expect(earliestFreeSlot([], policy)).toBeNull();
  });
});
