import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  allocateByWeight,
  daysBetween,
  endDateForPeriods,
  expiringWithin,
  findLeaseFlags,
  generateSchedule,
  isTenancyCurrent,
  planScheduleChange,
  summarizeDashboard,
  summarizeUnit,
  todayLocal,
  type LeaseLike,
  type TenancyLike,
  type UnitLike,
} from '../src';

describe('dates', () => {
  it('adds months, clamping to the end of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-12-31', 12)).toBe('2027-12-31');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('counts days across month and leap-year boundaries', () => {
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-10-21', '2026-10-16')).toBe(-5);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('rejects impossible dates', () => {
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow();
    expect(() => addMonths('not-a-date', 1)).toThrow();
  });

  it('reads today from the local calendar', () => {
    expect(todayLocal(new Date(2026, 9, 21, 23, 59))).toBe('2026-10-21');
  });
});

describe('generateSchedule', () => {
  it('creates one entry per period from the start date', () => {
    const entries = generateSchedule({ startDate: '2026-11-01', endDate: '2027-10-31', periodMonths: 6, amount: 1_200_000 });
    expect(entries).toEqual([
      { dueDate: '2026-11-01', amountDue: 1_200_000 },
      { dueDate: '2027-05-01', amountDue: 1_200_000 },
    ]);
  });

  it('works for any period length, including 2 and 3 months', () => {
    expect(generateSchedule({ startDate: '2026-01-10', endDate: '2026-06-09', periodMonths: 2, amount: 100 }).map((e) => e.dueDate)).toEqual([
      '2026-01-10',
      '2026-03-10',
      '2026-05-10',
    ]);
    expect(generateSchedule({ startDate: '2026-01-10', endDate: '2026-04-09', periodMonths: 3, amount: 100 })).toHaveLength(1);
  });

  it('counts periods from the start date so clamping never drifts', () => {
    const dates = generateSchedule({ startDate: '2026-01-31', endDate: '2026-12-31', periodMonths: 1, amount: 100 }).map((e) => e.dueDate);
    expect(dates.slice(0, 4)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('charges a short final period pro rata, in whole pesewas', () => {
    // 6-month period but the agreement stops after about 3 months.
    const entries = generateSchedule({ startDate: '2026-11-01', endDate: '2027-01-31', periodMonths: 6, amount: 1_200_000 });
    expect(entries).toHaveLength(1);
    // 92 of 181 days.
    expect(entries[0]!.amountDue).toBe(Math.round((1_200_000 * 92) / 181));
    expect(Number.isInteger(entries[0]!.amountDue)).toBe(true);
  });

  it('charges exactly one full period when the end date closes the period', () => {
    const end = endDateForPeriods('2026-11-05', 3);
    expect(end).toBe('2027-02-04');
    const entries = generateSchedule({ startDate: '2026-11-05', endDate: end, periodMonths: 3, amount: 450_000 });
    expect(entries).toEqual([{ dueDate: '2026-11-05', amountDue: 450_000 }]);
  });

  it('generates only the first period when there is no end date', () => {
    expect(generateSchedule({ startDate: '2026-11-05', endDate: null, periodMonths: 3, amount: 450_000 })).toHaveLength(1);
  });

  it('rejects bad input', () => {
    expect(() => generateSchedule({ startDate: '2026-11-05', endDate: '2026-11-01', periodMonths: 3, amount: 1 })).toThrow();
    expect(() => generateSchedule({ startDate: '2026-11-05', endDate: null, periodMonths: 0, amount: 1 })).toThrow();
    expect(() => generateSchedule({ startDate: '2026-11-05', endDate: null, periodMonths: 3, amount: 1.5 })).toThrow();
  });
});

describe('planScheduleChange', () => {
  const desired = [
    { dueDate: '2026-11-01', amountDue: 100 },
    { dueDate: '2027-05-01', amountDue: 100 },
  ];

  it('creates everything when nothing exists', () => {
    expect(planScheduleChange([], desired)).toEqual({ create: desired, update: [], remove: [] });
  });

  it('keeps matching entries untouched, so their ids survive', () => {
    const existing = desired.map((d, i) => ({ id: `e${i}`, ...d }));
    expect(planScheduleChange(existing, desired)).toEqual({ create: [], update: [], remove: [] });
  });

  it('updates amounts, adds new periods and removes dropped ones', () => {
    const existing = [
      { id: 'a', dueDate: '2026-11-01', amountDue: 90 },
      { id: 'b', dueDate: '2027-05-01', amountDue: 100 },
      { id: 'c', dueDate: '2027-11-01', amountDue: 100 },
    ];
    const plan = planScheduleChange(existing, [...desired, { dueDate: '2027-02-01', amountDue: 100 }]);
    expect(plan.update).toEqual([{ id: 'a', amountDue: 100 }]);
    expect(plan.create).toEqual([{ dueDate: '2027-02-01', amountDue: 100 }]);
    expect(plan.remove).toEqual(['c']);
  });

  it('ignores entries that are already deleted', () => {
    const existing = [{ id: 'gone', dueDate: '2026-11-01', amountDue: 100, deletedAt: '2026-10-01T00:00:00Z' }];
    expect(planScheduleChange(existing, desired).create).toHaveLength(2);
  });
});

describe('allocateByWeight', () => {
  it('splits equally and always adds up exactly', () => {
    expect(allocateByWeight(1_000_000, [100, 100, 100])).toEqual([333_334, 333_333, 333_333]);
    expect(allocateByWeight(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateByWeight(0, [100, 100])).toEqual([0, 0]);
  });

  it('honours weights', () => {
    expect(allocateByWeight(1_200_000, [200, 100, 100])).toEqual([600_000, 300_000, 300_000]);
  });

  it('keeps the total for any mix, including negatives', () => {
    for (const total of [1, 7, 99_999, 1_234_567, -1_000_001]) {
      for (const weights of [[1], [1, 1], [100, 100, 100, 100, 100, 100, 100], [3, 5, 7, 11]]) {
        const parts = allocateByWeight(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every(Number.isInteger)).toBe(true);
      }
    }
  });

  it('rejects empty-sum and non-positive weights', () => {
    expect(allocateByWeight(100, [])).toEqual([]);
    expect(() => allocateByWeight(100, [0, 1])).toThrow();
    expect(() => allocateByWeight(100, [-1, 1])).toThrow();
  });
});

describe('occupancy and vacancy', () => {
  const lease: LeaseLike = { id: 'L1', siteId: 'S1', startDate: '2026-01-01', endDate: '2026-12-31' };
  const unit: UnitLike = { id: 'U1', leaseId: 'L1' };
  const tenancy = (over: Partial<TenancyLike>): TenancyLike => ({ id: 'T', unitId: 'U1', startDate: '2026-02-01', endDate: '2026-03-31', ...over });

  it('treats a tenancy as current through its end date', () => {
    const t = tenancy({});
    expect(isTenancyCurrent(t, '2026-01-31')).toBe(false);
    expect(isTenancyCurrent(t, '2026-02-01')).toBe(true);
    expect(isTenancyCurrent(t, '2026-03-31')).toBe(true);
    expect(isTenancyCurrent(t, '2026-04-01')).toBe(false);
    expect(isTenancyCurrent(tenancy({ endDate: null }), '2030-01-01')).toBe(true);
    expect(isTenancyCurrent(tenancy({ deletedAt: 'x' }), '2026-02-15')).toBe(false);
  });

  it('counts vacancy from the lease start when the room was never let', () => {
    const s = summarizeUnit(unit, lease, [], '2026-01-11');
    expect(s).toMatchObject({ state: 'vacant', vacantSince: '2026-01-01', vacantDays: 10 });
  });

  it('counts vacancy from the day after the last tenancy ended', () => {
    const t = [tenancy({ id: 'T1' }), tenancy({ id: 'T2', startDate: '2026-04-15', endDate: '2026-05-31' })];
    expect(summarizeUnit(unit, lease, t, '2026-06-10')).toMatchObject({ state: 'vacant', vacantSince: '2026-06-01', vacantDays: 9 });
    // Between the two tenancies the gap is measured from the first one.
    expect(summarizeUnit(unit, lease, [t[0]!], '2026-04-10')).toMatchObject({ vacantSince: '2026-04-01', vacantDays: 9 });
  });

  it('is occupied (zero vacancy) during a tenancy, and a leaving day still counts as occupied', () => {
    expect(summarizeUnit(unit, lease, [tenancy({})], '2026-03-31')).toMatchObject({ state: 'occupied', vacantDays: 0, currentTenancyId: 'T' });
    expect(summarizeUnit(unit, lease, [tenancy({})], '2026-04-01')).toMatchObject({ state: 'vacant', vacantDays: 0 });
  });

  it('reports an upcoming tenancy while the room is still vacant', () => {
    const s = summarizeUnit(unit, lease, [tenancy({ id: 'NEXT', startDate: '2026-08-01', endDate: '2026-09-30' })], '2026-07-20');
    expect(s).toMatchObject({ state: 'vacant', upcomingTenancyId: 'NEXT' });
  });

  it('does not call a room vacant before its lease starts, and leaves off-market rooms out', () => {
    expect(summarizeUnit(unit, lease, [], '2025-12-20').state).toBe('not_started');
    expect(summarizeUnit({ ...unit, status: 'off_market' }, lease, [], '2026-05-01').state).toBe('off_market');
  });
});

describe('lease flags', () => {
  const lease: LeaseLike = { id: 'L1', siteId: 'S1', startDate: '2026-01-01', endDate: '2026-12-31' };
  const unit: UnitLike = { id: 'U1', leaseId: 'L1' };

  it('flags a tenancy that runs past the landlord lease', () => {
    const flags = findLeaseFlags([lease], [unit], [{ id: 'T', unitId: 'U1', startDate: '2026-06-01', endDate: '2027-02-28' }], '2026-07-01');
    expect(flags).toEqual([{ kind: 'tenancy_outlasts_lease', leaseId: 'L1', unitId: 'U1', tenancyId: 'T', days: 59 }]);
  });

  it('does not flag tenancies that finish inside the lease, or ones that already ended', () => {
    const inside = findLeaseFlags([lease], [unit], [{ id: 'T', unitId: 'U1', startDate: '2026-06-01', endDate: '2026-12-31' }], '2026-07-01');
    expect(inside).toEqual([]);
    const past = findLeaseFlags([lease], [unit], [{ id: 'T', unitId: 'U1', startDate: '2024-01-01', endDate: '2027-01-31' }], '2027-06-01');
    expect(past.filter((f) => f.kind === 'tenancy_outlasts_lease')).toEqual([]);
  });

  it('flags an open-ended tenancy on a lease that has an end date', () => {
    const flags = findLeaseFlags([lease], [unit], [{ id: 'T', unitId: 'U1', startDate: '2026-06-01', endDate: null }], '2026-07-01');
    expect(flags.map((f) => f.kind)).toEqual(['tenancy_outlasts_lease']);
  });

  it('flags a room that is vacant with a long lease still to run, unless a tenant is booked', () => {
    expect(findLeaseFlags([lease], [unit], [], '2026-06-01')).toEqual([{ kind: 'vacant_until_lease_end', leaseId: 'L1', unitId: 'U1', days: 213 }]);
    const booked: TenancyLike[] = [{ id: 'T', unitId: 'U1', startDate: '2026-06-15', endDate: '2026-12-31' }];
    expect(findLeaseFlags([lease], [unit], booked, '2026-06-01')).toEqual([]);
    expect(findLeaseFlags([lease], [unit], [], '2026-12-15')).toEqual([]);
  });
});

describe('expiringWithin', () => {
  it('lists agreements ending in the window, soonest first, skipping ended, open and deleted ones', () => {
    const rows = [
      { id: 'late', endDate: '2027-03-01' },
      { id: 'soon', endDate: '2026-11-01' },
      { id: 'today', endDate: '2026-10-21' },
      { id: 'ended', endDate: '2026-10-20' },
      { id: 'open', endDate: null },
      { id: 'gone', endDate: '2026-11-05', deletedAt: 'x' },
      { id: 'edge', endDate: '2027-01-19' },
    ];
    expect(expiringWithin(rows, '2026-10-21', 90).map((r) => [r.id, r.daysLeft])).toEqual([
      ['today', 0],
      ['soon', 11],
      ['edge', 90],
    ]);
  });
});

describe('summarizeDashboard', () => {
  const leases: LeaseLike[] = [
    { id: 'L1', siteId: 'S1', startDate: '2026-01-01', endDate: '2026-12-31' },
    { id: 'L2', siteId: 'S1', startDate: '2026-02-01', endDate: '2027-01-31' },
    { id: 'LX', siteId: 'S1', startDate: '2026-01-01', endDate: '2026-12-31', deletedAt: 'x' },
  ];
  const units: UnitLike[] = [
    { id: 'A', leaseId: 'L1' },
    { id: 'B', leaseId: 'L1' },
    { id: 'C', leaseId: 'L2', status: 'off_market' },
    { id: 'D', leaseId: 'L2' },
    { id: 'orphan', leaseId: 'LX' },
  ];
  const tenancies: TenancyLike[] = [
    { id: 't1', unitId: 'A', startDate: '2026-03-01', endDate: '2026-11-30' },
    { id: 't2', unitId: 'D', startDate: '2026-02-01', endDate: '2026-09-30' },
  ];

  it('counts occupancy, ranks vacancies and surfaces what needs attention', () => {
    const s = summarizeDashboard({ leases, units, tenancies }, '2026-10-21');
    expect(s.occupancy).toEqual({ occupied: 1, vacant: 2, offMarket: 1, total: 4, rate: 1 / 3 });
    expect(s.vacantUnits.map((v) => [v.unitId, v.vacantDays])).toEqual([
      ['B', 293],
      ['D', 20], // free from 1 Oct, so 20 days by 21 Oct
    ]);
    expect(s.expiringLeases.map((l) => l.id)).toEqual(['L1']); // L2 ends in 102 days
    expect(s.expiringTenancies.map((t) => t.id)).toEqual(['t1']);
    expect(summarizeDashboard({ leases, units, tenancies }, '2026-10-21', 120).expiringLeases.map((l) => l.id)).toEqual(['L1', 'L2']);
  });

  it('has no rate when there is nothing to rate', () => {
    expect(summarizeDashboard({ leases: [], units: [], tenancies: [] }, '2026-10-21').occupancy).toEqual({
      occupied: 0,
      vacant: 0,
      offMarket: 0,
      total: 0,
      rate: null,
    });
  });
});
