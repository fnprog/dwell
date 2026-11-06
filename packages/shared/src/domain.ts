import { addDays, addMonths, daysBetween } from './dates';

// ---------------------------------------------------------------------------
// Rent schedules
// ---------------------------------------------------------------------------

export interface ScheduleInput {
  startDate: string;
  /** Last day of the agreement. `null` = open ended: only the first period is generated. */
  endDate: string | null;
  /** Length of one rent period in months (2, 3, 6, 12 ...). */
  periodMonths: number;
  /** Rent for one full period, in pesewas. */
  amount: number;
}

export interface ScheduleEntryDraft {
  dueDate: string;
  amountDue: number;
}

/**
 * One entry per rent period, due on the first day of the period. Period starts
 * are counted from the start date (not from the previous period) so a 31 Jan
 * start never drifts to the 28th. A final period that runs past the end date
 * is charged pro rata by days, rounded to the nearest pesewa.
 */
export function generateSchedule(input: ScheduleInput): ScheduleEntryDraft[] {
  const { startDate, endDate, periodMonths, amount } = input;
  if (!Number.isInteger(periodMonths) || periodMonths < 1) throw new Error('periodMonths must be a whole number of at least 1');
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('amount must be a non-negative whole number of pesewas');
  if (endDate !== null && daysBetween(startDate, endDate) < 0) throw new Error('endDate is before startDate');

  const entries: ScheduleEntryDraft[] = [];
  for (let i = 0; i < 1200; i++) {
    const due = addMonths(startDate, i * periodMonths);
    if (endDate !== null && daysBetween(due, endDate) < 0) break;

    let amountDue = amount;
    if (endDate !== null) {
      const periodEnd = addMonths(startDate, (i + 1) * periodMonths); // first day of the next period
      const full = daysBetween(due, periodEnd);
      const covered = daysBetween(due, endDate) + 1;
      if (covered < full) amountDue = Math.round((amount * covered) / full);
    }
    entries.push({ dueDate: due, amountDue });
    if (endDate === null) break;
  }
  return entries;
}

/** End date of a tenancy that runs for `periods` whole rent periods from its start. */
export function endDateForPeriods(startDate: string, periodMonths: number, periods = 1): string {
  return addDays(addMonths(startDate, periodMonths * periods), -1);
}

export interface ExistingEntry {
  id: string;
  dueDate: string;
  amountDue: number;
  deletedAt?: unknown;
}

export interface SchedulePlan {
  create: ScheduleEntryDraft[];
  update: { id: string; amountDue: number }[];
  remove: string[];
}

/**
 * Work out the smallest set of changes that turns the existing entries into the
 * desired ones. Entries are matched by due date, so an entry that already has
 * the right date keeps its id (and, from Phase 2, its payments).
 */
export function planScheduleChange(existing: ExistingEntry[], desired: ScheduleEntryDraft[]): SchedulePlan {
  const live = existing.filter((entry) => !entry.deletedAt);
  const byDate = new Map(live.map((entry) => [entry.dueDate, entry]));
  const wanted = new Set(desired.map((entry) => entry.dueDate));

  const plan: SchedulePlan = { create: [], update: [], remove: [] };
  for (const entry of desired) {
    const current = byDate.get(entry.dueDate);
    if (!current) plan.create.push(entry);
    else if (current.amountDue !== entry.amountDue) plan.update.push({ id: current.id, amountDue: entry.amountDue });
  }
  for (const entry of live) if (!wanted.has(entry.dueDate)) plan.remove.push(entry.id);
  return plan;
}

// ---------------------------------------------------------------------------
// Cost allocation
// ---------------------------------------------------------------------------

/**
 * Split `total` pesewas across shares in proportion to `weights`. The parts are
 * whole pesewas that add up exactly to `total` (largest remainder; ties go to
 * the earlier share). Equal weights give an equal split.
 */
export function allocateByWeight(total: number, weights: number[]): number[] {
  if (!Number.isSafeInteger(total)) throw new Error('total must be a whole number of pesewas');
  if (weights.length === 0) return [];
  if (weights.some((w) => !Number.isFinite(w) || w <= 0)) throw new Error('weights must be positive');

  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  const exact = weights.map((w) => (abs * w) / sum);
  const parts = exact.map(Math.floor);
  let left = abs - parts.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    parts[index]! += 1;
    left -= 1;
  }
  return parts.map((part) => part * sign);
}

// ---------------------------------------------------------------------------
// Occupancy, vacancy and lease health
// ---------------------------------------------------------------------------

interface Deletable {
  deletedAt?: unknown;
}

export interface LeaseLike extends Deletable {
  id: string;
  siteId: string;
  startDate: string;
  endDate: string;
}

export interface UnitLike extends Deletable {
  id: string;
  leaseId: string;
  name?: string;
  status?: string;
}

export interface TenancyLike extends Deletable {
  id: string;
  unitId: string;
  startDate: string;
  endDate: string | null;
}

/** A tenancy is current on `asOf` when asOf is within its dates, end date included. */
export function isTenancyCurrent(tenancy: TenancyLike, asOf: string): boolean {
  if (tenancy.deletedAt) return false;
  if (daysBetween(tenancy.startDate, asOf) < 0) return false;
  return tenancy.endDate === null || daysBetween(asOf, tenancy.endDate) >= 0;
}

export type UnitState = 'occupied' | 'vacant' | 'off_market' | 'not_started';

export interface UnitSummary {
  unitId: string;
  state: UnitState;
  currentTenancyId: string | null;
  /** Next tenancy that has not started yet, if any. */
  upcomingTenancyId: string | null;
  /** First day of the current vacancy, when vacant. */
  vacantSince: string | null;
  vacantDays: number;
}

/**
 * Where a unit stands on `asOf`, worked out from dates only, so the answer does
 * not depend on a stored status having been kept up to date offline.
 * A vacancy starts the day after the last tenancy ended, or on the lease start
 * if the room was never let.
 */
export function summarizeUnit(unit: UnitLike, lease: LeaseLike, tenancies: TenancyLike[], asOf: string): UnitSummary {
  const base = { unitId: unit.id, currentTenancyId: null, upcomingTenancyId: null, vacantSince: null, vacantDays: 0 };
  const mine = tenancies.filter((t) => t.unitId === unit.id && !t.deletedAt);

  const current = mine.find((t) => isTenancyCurrent(t, asOf));
  const upcoming =
    mine
      .filter((t) => daysBetween(asOf, t.startDate) > 0)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;

  if (unit.status === 'off_market') return { ...base, state: 'off_market', upcomingTenancyId: upcoming?.id ?? null };
  if (current) return { ...base, state: 'occupied', currentTenancyId: current.id, upcomingTenancyId: upcoming?.id ?? null };
  if (daysBetween(lease.startDate, asOf) < 0) return { ...base, state: 'not_started', upcomingTenancyId: upcoming?.id ?? null };

  let vacantSince = lease.startDate;
  for (const t of mine) {
    if (t.endDate === null) continue;
    const free = addDays(t.endDate, 1);
    if (daysBetween(free, asOf) >= 0 && daysBetween(vacantSince, free) > 0) vacantSince = free;
  }
  return {
    ...base,
    state: 'vacant',
    upcomingTenancyId: upcoming?.id ?? null,
    vacantSince,
    vacantDays: Math.max(0, daysBetween(vacantSince, asOf)),
  };
}

export type LeaseFlagKind =
  /** A tenancy runs past the end of the landlord lease: you would be sublet a room you no longer hold. */
  | 'tenancy_outlasts_lease'
  /** The room has been empty and the lease still has a long way to run. */
  | 'vacant_until_lease_end';

export interface LeaseFlag {
  kind: LeaseFlagKind;
  leaseId: string;
  unitId: string;
  tenancyId?: string;
  /** Days past the lease end (tenancy_outlasts_lease) or days of lease left (vacant_until_lease_end). */
  days: number;
}

/**
 * A vacant room is flagged when its lease still has at least this many days to
 * run. (Any tenancy that outlasts its lease is flagged, however small the overrun,
 * and so is an open-ended tenancy on a lease that has an end date.)
 */
export const VACANT_LEASE_LEFT_DAYS = 30;

export function findLeaseFlags(
  leases: LeaseLike[],
  units: UnitLike[],
  tenancies: TenancyLike[],
  asOf: string,
): LeaseFlag[] {
  const flags: LeaseFlag[] = [];
  const liveLeases = leases.filter((l) => !l.deletedAt);

  for (const lease of liveLeases) {
    for (const unit of units.filter((u) => u.leaseId === lease.id && !u.deletedAt)) {
      const mine = tenancies.filter((t) => t.unitId === unit.id && !t.deletedAt);

      for (const t of mine) {
        // Only agreements still in force or yet to start matter; past ones are history.
        if (t.endDate !== null && daysBetween(asOf, t.endDate) < 0) continue;
        const over = t.endDate === null ? Number.POSITIVE_INFINITY : daysBetween(lease.endDate, t.endDate);
        if (over > 0) {
          flags.push({
            kind: 'tenancy_outlasts_lease',
            leaseId: lease.id,
            unitId: unit.id,
            tenancyId: t.id,
            days: Number.isFinite(over) ? over : 0,
          });
        }
      }

      const summary = summarizeUnit(unit, lease, tenancies, asOf);
      if (summary.state === 'vacant' && !summary.upcomingTenancyId) {
        const left = daysBetween(asOf, lease.endDate);
        if (left >= VACANT_LEASE_LEFT_DAYS) {
          flags.push({ kind: 'vacant_until_lease_end', leaseId: lease.id, unitId: unit.id, days: left });
        }
      }
    }
  }
  return flags;
}

export interface Expiring {
  id: string;
  endDate: string;
  daysLeft: number;
}

/** Agreements ending within `withinDays` of `asOf` (already-ended ones are excluded), soonest first. */
export function expiringWithin<T extends Deletable & { id: string; endDate: string | null }>(
  rows: T[],
  asOf: string,
  withinDays: number,
): Expiring[] {
  const out: Expiring[] = [];
  for (const row of rows) {
    if (row.deletedAt || row.endDate === null) continue;
    const daysLeft = daysBetween(asOf, row.endDate);
    if (daysLeft >= 0 && daysLeft <= withinDays) out.push({ id: row.id, endDate: row.endDate, daysLeft });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft || a.id.localeCompare(b.id));
}

export interface DashboardSummary {
  asOf: string;
  occupancy: { occupied: number; vacant: number; offMarket: number; total: number; rate: number | null };
  /** Longest-vacant first. */
  vacantUnits: { unitId: string; leaseId: string; vacantDays: number; vacantSince: string }[];
  expiringLeases: Expiring[];
  expiringTenancies: Expiring[];
  flags: LeaseFlag[];
}

/**
 * Everything Dashboard v1 shows. Only units of leases that have started count
 * toward occupancy; off-market units are counted separately and left out of the rate.
 */
export function summarizeDashboard(
  data: { leases: LeaseLike[]; units: UnitLike[]; tenancies: TenancyLike[] },
  asOf: string,
  expiryWindowDays = 90,
): DashboardSummary {
  const leases = data.leases.filter((l) => !l.deletedAt);
  const leaseById = new Map(leases.map((l) => [l.id, l]));
  const units = data.units.filter((u) => !u.deletedAt && leaseById.has(u.leaseId));

  let occupied = 0;
  let vacant = 0;
  let offMarket = 0;
  const vacantUnits: DashboardSummary['vacantUnits'] = [];

  for (const unit of units) {
    const lease = leaseById.get(unit.leaseId)!;
    const s = summarizeUnit(unit, lease, data.tenancies, asOf);
    if (s.state === 'occupied') occupied++;
    else if (s.state === 'off_market') offMarket++;
    else if (s.state === 'vacant') {
      vacant++;
      vacantUnits.push({ unitId: unit.id, leaseId: lease.id, vacantDays: s.vacantDays, vacantSince: s.vacantSince! });
    }
  }
  vacantUnits.sort((a, b) => b.vacantDays - a.vacantDays || a.unitId.localeCompare(b.unitId));

  const rated = occupied + vacant;
  const liveTenancies = data.tenancies.filter(
    (t) => !t.deletedAt && units.some((u) => u.id === t.unitId),
  );

  return {
    asOf,
    occupancy: { occupied, vacant, offMarket, total: units.length, rate: rated === 0 ? null : occupied / rated },
    vacantUnits,
    expiringLeases: expiringWithin(leases, asOf, expiryWindowDays),
    expiringTenancies: expiringWithin(liveTenancies, asOf, expiryWindowDays),
    flags: findLeaseFlags(leases, units, liveTenancies, asOf),
  };
}
