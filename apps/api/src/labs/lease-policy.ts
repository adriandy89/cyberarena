/**
 * Lease rules for labs on demand (phase 011), as pure functions.
 *
 * A lease keeps a lab alive for one user. It ends when the room page stops
 * sending heartbeats for `idleTimeout`, or at `maxUntil` (2 h, extendable in
 * the last 30 min up to the 4 h cap). A lab instance lives while it has at
 * least one lease; at most `maxRunning` labs have leases at once.
 */

export interface LabPolicy {
  idleTimeoutMs: number;
  sessionMaxMs: number;
  sessionCapMs: number;
  extendMs: number;
  /** Extending is offered only this close to `maxUntil`. */
  extendWindowMs: number;
  maxRunning: number;
}

export interface LeaseTimes {
  startedAt: Date;
  lastSeenAt: Date;
  maxUntil: Date;
}

export interface LeaseLike extends LeaseTimes {
  labSlug: string;
}

export type ExpiryReason = 'idle' | 'max';

export function newLeaseTimes(now: Date, policy: LabPolicy): LeaseTimes {
  return { startedAt: now, lastSeenAt: now, maxUntil: new Date(now.getTime() + policy.sessionMaxMs) };
}

export function idleDeadline(lease: LeaseTimes, policy: LabPolicy): Date {
  return new Date(lease.lastSeenAt.getTime() + policy.idleTimeoutMs);
}

/** When the lease ends if nothing else happens: idle or max, whichever first. */
export function leaseEnd(lease: LeaseTimes, policy: LabPolicy): Date {
  return new Date(Math.min(lease.maxUntil.getTime(), idleDeadline(lease, policy).getTime()));
}

export function expiryReason(lease: LeaseTimes, now: Date, policy: LabPolicy): ExpiryReason | null {
  if (now.getTime() >= lease.maxUntil.getTime()) return 'max';
  if (now.getTime() >= idleDeadline(lease, policy).getTime()) return 'idle';
  return null;
}

export function capUntil(lease: LeaseTimes, policy: LabPolicy): Date {
  return new Date(lease.startedAt.getTime() + policy.sessionCapMs);
}

export function canExtend(lease: LeaseTimes, now: Date, policy: LabPolicy): boolean {
  const remaining = lease.maxUntil.getTime() - now.getTime();
  return remaining > 0 && remaining <= policy.extendWindowMs && lease.maxUntil.getTime() < capUntil(lease, policy).getTime();
}

export function extendedUntil(lease: LeaseTimes, policy: LabPolicy): Date {
  return new Date(Math.min(lease.maxUntil.getTime() + policy.extendMs, capUntil(lease, policy).getTime()));
}

/** A lab can get a new lease if it already has one or there is room for one more lab. */
export function hasCapacity(leasedSlugs: ReadonlySet<string>, slug: string, policy: LabPolicy): boolean {
  return leasedSlugs.has(slug) || leasedSlugs.size < policy.maxRunning;
}

/** Earliest moment a lab slot frees up (when the first leased lab loses its last lease). */
export function earliestFreeSlot(leases: readonly LeaseLike[], policy: LabPolicy): Date | null {
  const lastEndBySlug = new Map<string, number>();
  for (const lease of leases) {
    const end = leaseEnd(lease, policy).getTime();
    lastEndBySlug.set(lease.labSlug, Math.max(lastEndBySlug.get(lease.labSlug) ?? 0, end));
  }
  if (lastEndBySlug.size === 0) return null;
  return new Date(Math.min(...lastEndBySlug.values()));
}
