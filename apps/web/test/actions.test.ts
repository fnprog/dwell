import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { LocalDb, SyncEngine } from '@subrent/sync-client';
import { startServer, type TestServer } from '../../api/test/harness';
import { createActions, UserError } from '../src/data/actions';
import type { Lease, ScheduleEntry, Tenancy, Unit } from '../src/data/types';

const TODAY = '2026-10-21';

function offlineDevice() {
  const db = new LocalDb(`actions-${randomUUID()}`);
  const engine = new SyncEngine(db, {
    baseUrl: '',
    fetchImpl: async () => {
      throw new TypeError('offline');
    },
  });
  return { db, engine, actions: createActions(engine, () => TODAY) };
}

type Device = ReturnType<typeof offlineDevice>;

async function seed(d: Device) {
  const site = await d.actions.saveSite({ name: 'Spintex house', type: 'house' });
  const landlord = await d.actions.saveLandlord({ name: 'Mrs Owusu' });
  const lease = await d.actions.saveLease({
    siteId: site.id,
    landlordId: landlord.id,
    rentAmount: 1_200_000,
    periodMonths: 6,
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    advancePaid: 2_400_000,
    depositPaid: 0,
  });
  const unit = await d.actions.saveUnit(lease.id, { name: 'Room 2', targetPrice: 150_000, unfurnishedBaseline: 110_000, allocationWeight: 100 });
  const tenant = await d.actions.saveTenant({ name: 'Efua', phone: '024 000 0000' });
  return { site, landlord, lease, unit, tenant };
}

const entriesOf = async (d: Device, field: 'leaseId' | 'tenancyId', id: string) =>
  ((await d.db.entity('scheduleEntries').where(field).equals(id).toArray()) as unknown as ScheduleEntry[])
    .filter((e) => !e.deletedAt)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

describe('leases', () => {
  it('generates the landlord rent schedule, and keeps ids for periods that do not change', async () => {
    const d = offlineDevice();
    const { lease, site, landlord } = await seed(d);

    const first = await entriesOf(d, 'leaseId', lease.id);
    expect(first.map((e) => [e.dueDate, e.amountDue, e.kind])).toEqual([
      ['2026-11-01', 1_200_000, 'landlord_rent'],
      ['2027-05-01', 1_200_000, 'landlord_rent'],
    ]);

    // Raise the rent: same dates, so the same two rows are updated, not replaced.
    await d.actions.saveLease(
      { siteId: site.id, landlordId: landlord.id, rentAmount: 1_300_000, periodMonths: 6, startDate: '2026-11-01', endDate: '2027-10-31', advancePaid: 2_400_000, depositPaid: 0 },
      lease.id,
    );
    const second = await entriesOf(d, 'leaseId', lease.id);
    expect(second.map((e) => e.id)).toEqual(first.map((e) => e.id));
    expect(second.map((e) => e.amountDue)).toEqual([1_300_000, 1_300_000]);

    // Switch to 3-month periods: two rows survive, two are added.
    await d.actions.saveLease(
      { siteId: site.id, landlordId: landlord.id, rentAmount: 650_000, periodMonths: 3, startDate: '2026-11-01', endDate: '2027-10-31', advancePaid: 2_400_000, depositPaid: 0 },
      lease.id,
    );
    const third = await entriesOf(d, 'leaseId', lease.id);
    expect(third.map((e) => e.dueDate)).toEqual(['2026-11-01', '2027-02-01', '2027-05-01', '2027-08-01']);
    expect(third.every((e) => e.amountDue === 650_000)).toBe(true);
  });

  it('sends only the fields that changed', async () => {
    const d = offlineDevice();
    const { lease, site, landlord } = await seed(d);
    await d.db.outbox.clear();
    await d.actions.saveLease(
      { siteId: site.id, landlordId: landlord.id, rentAmount: lease.rentAmount, periodMonths: 6, startDate: '2026-11-01', endDate: '2027-10-31', advancePaid: 2_400_000, depositPaid: 50_000 },
      lease.id,
    );
    const sent = (await d.db.outbox.toArray()).filter((e) => e.table === 'leases');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.patch).toEqual({ depositPaid: 50_000 });
  });

  it('refuses nonsense with a message a person can act on', async () => {
    const d = offlineDevice();
    const { site, landlord, lease } = await seed(d);
    const base = { siteId: site.id, landlordId: landlord.id, rentAmount: 1000, periodMonths: 6, startDate: '2026-11-01', endDate: '2027-10-31', advancePaid: 0, depositPaid: 0 };
    await expect(d.actions.saveLease({ ...base, endDate: '2026-10-31' })).rejects.toThrow('cannot end before it starts');
    await expect(d.actions.saveLease({ ...base, startDate: '2026-02-30' })).rejects.toThrow('not a valid date');
    await expect(d.actions.saveLease({ ...base, rentAmount: 0 })).rejects.toThrow('Rent must be more than zero');
    await expect(d.actions.saveLease({ ...base, periodMonths: 0 })).rejects.toThrow('Rent period');
    await expect(d.actions.saveLease({ ...base, siteId: randomUUID() })).rejects.toBeInstanceOf(UserError);
    expect(await d.db.entity('leases').count()).toBe(1); // only the seeded one: nothing half-saved
    expect(lease.id).toBeTruthy();
  });
});

describe('tenancies', () => {
  it('starts a tenancy with a one-period default and a matching schedule', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    const t = await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 450_000, periodMonths: 3, startDate: '2026-11-05', depositHeld: 150_000 });
    expect(t.endDate).toBe('2027-02-04');
    expect(t.status).toBe('upcoming');
    expect((await entriesOf(d, 'tenancyId', t.id)).map((e) => [e.dueDate, e.amountDue, e.kind])).toEqual([['2026-11-05', 450_000, 'tenant_rent']]);
  });

  it('supports longer terms of several periods', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    const t = await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 300_000, periodMonths: 2, startDate: '2026-11-01', endDate: '2027-04-30', depositHeld: 0 });
    expect((await entriesOf(d, 'tenancyId', t.id)).map((e) => e.dueDate)).toEqual(['2026-11-01', '2027-01-01', '2027-03-01']);
  });

  it('refuses overlapping tenancies in one room but allows back-to-back ones', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    const other = await d.actions.saveTenant({ name: 'Kojo' });
    await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 100, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 }); // to 2027-01-31

    await expect(
      d.actions.startTenancy({ unitId: unit.id, tenantId: other.id, rentAmount: 100, periodMonths: 3, startDate: '2027-01-31', depositHeld: 0 }),
    ).rejects.toThrow('Dates cannot overlap');
    await expect(
      d.actions.startTenancy({ unitId: unit.id, tenantId: other.id, rentAmount: 100, periodMonths: 1, startDate: '2026-10-15', endDate: '2026-11-01', depositHeld: 0 }),
    ).rejects.toThrow('Dates cannot overlap');

    const next = await d.actions.startTenancy({ unitId: unit.id, tenantId: other.id, rentAmount: 100, periodMonths: 3, startDate: '2027-02-01', depositHeld: 0 });
    expect(next.startDate).toBe('2027-02-01');
  });

  it('will not put a tenant into a room that is off the market', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    await d.actions.setOffMarket(unit.id, true);
    await expect(
      d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 100, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 }),
    ).rejects.toThrow('off the market');
    await d.actions.setOffMarket(unit.id, false);
    await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 100, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 });
  });

  it('ending early drops later periods but keeps the amount of the period already started', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    const t = await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 300_000, periodMonths: 2, startDate: '2026-09-01', endDate: '2027-02-28', depositHeld: 0 });
    expect((await entriesOf(d, 'tenancyId', t.id)).map((e) => e.dueDate)).toEqual(['2026-09-01', '2026-11-01', '2027-01-01']);

    const ended = await d.actions.endTenancy(t.id, '2026-11-20');
    expect(ended.endDate).toBe('2026-11-20');
    expect(ended.status).toBe('active'); // leaving date is still in the future on TODAY=2026-10-21
    const left = await entriesOf(d, 'tenancyId', t.id);
    expect(left.map((e) => [e.dueDate, e.amountDue])).toEqual([['2026-09-01', 300_000], ['2026-11-01', 300_000]]);

    const past = await d.actions.endTenancy(t.id, '2026-10-10');
    expect(past.status).toBe('ended');
    expect((await entriesOf(d, 'tenancyId', t.id)).map((e) => e.dueDate)).toEqual(['2026-09-01']);
  });

  it('cannot end a tenancy before it started or extend it through the end action', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    const t = await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 100, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 });
    await expect(d.actions.endTenancy(t.id, '2026-10-31')).rejects.toThrow('before the tenancy started');
    await expect(d.actions.endTenancy(t.id, '2027-06-01')).rejects.toThrow('Use Edit to extend');
  });

  it('editing rebuilds the schedule and still blocks overlaps (but not with itself)', async () => {
    const d = offlineDevice();
    const { unit, tenant } = await seed(d);
    const t = await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 100_000, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 });
    const edited = await d.actions.updateTenancy(t.id, { unitId: unit.id, tenantId: tenant.id, rentAmount: 120_000, periodMonths: 3, startDate: '2026-11-01', endDate: '2027-04-30', depositHeld: 0 });
    expect(edited.endDate).toBe('2027-04-30');
    expect((await entriesOf(d, 'tenancyId', t.id)).map((e) => [e.dueDate, e.amountDue])).toEqual([['2026-11-01', 120_000], ['2027-02-01', 120_000]]);
    await expect(d.actions.updateTenancy(t.id, { unitId: randomUUID(), tenantId: tenant.id, rentAmount: 1, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 })).rejects.toThrow('cannot be moved');
  });
});

describe('deleting things others depend on', () => {
  it('is refused until the dependents are gone, then removes schedules with their parent', async () => {
    const d = offlineDevice();
    const { site, landlord, lease, unit, tenant } = await seed(d);
    const t = await d.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 100, periodMonths: 3, startDate: '2026-11-01', depositHeld: 0 });

    await expect(d.actions.removeSite(site.id)).rejects.toThrow('still has leases');
    await expect(d.actions.removeLandlord(landlord.id)).rejects.toThrow('still has leases');
    await expect(d.actions.removeLease(lease.id)).rejects.toThrow('still has rooms');
    await expect(d.actions.removeUnit(unit.id)).rejects.toThrow('tenancies on record');
    await expect(d.actions.removeTenant(tenant.id)).rejects.toThrow('tenancies on record');

    await d.actions.removeTenancy(t.id);
    expect(await entriesOf(d, 'tenancyId', t.id)).toEqual([]);
    await d.actions.removeTenant(tenant.id);
    await d.actions.removeUnit(unit.id);
    await d.actions.removeLease(lease.id);
    expect(await entriesOf(d, 'leaseId', lease.id)).toEqual([]);
    await d.actions.removeSite(site.id);
    await d.actions.removeLandlord(landlord.id);
  });
});

describe('Phase 1 data against the real server', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startServer();
    await server.addUser('Fantasy', 'fantasy@example.com', 'correct horse battery');
    await server.addUser('Brother', 'brother@example.com', 'another long password');
  });
  afterAll(async () => {
    await server.close();
  });

  async function signedInDevice(email: string, password: string) {
    const db = new LocalDb(`phase1-${randomUUID()}`);
    const engine = new SyncEngine(db, { baseUrl: '', fetchImpl: async (input, init) => server.app.request(String(input), init) });
    await engine.login(email, password);
    return { db, engine, actions: createActions(engine, () => TODAY) };
  }

  it('accepts a whole business graph built offline, in order, and the partner sees all of it', async () => {
    const a = await signedInDevice('fantasy@example.com', 'correct horse battery');
    const b = await signedInDevice('brother@example.com', 'another long password');

    // Everything below is written on A's phone with no connection.
    const site = await a.actions.saveSite({ name: 'Osu hostel', type: 'hostel', address: 'Osu, Accra' });
    const landlord = await a.actions.saveLandlord({ name: 'Mr Mensah', phone: '020 111 2222' });
    const lease = await a.actions.saveLease({ siteId: site.id, landlordId: landlord.id, rentAmount: 900_000, periodMonths: 6, startDate: '2026-11-01', endDate: '2027-10-31', advancePaid: 1_800_000, depositPaid: 100_000 });
    const unit = await a.actions.saveUnit(lease.id, { name: 'Room 4', targetPrice: 120_000, unfurnishedBaseline: null, allocationWeight: 100 });
    const tenant = await a.actions.saveTenant({ name: 'Efua', phone: '024 000 0000', guarantor: 'Ama (sister)' });
    const tenancy = await a.actions.startTenancy({ unitId: unit.id, tenantId: tenant.id, rentAmount: 360_000, periodMonths: 3, startDate: '2026-11-05', endDate: '2027-05-04', depositHeld: 120_000 });
    await a.actions.endTenancy(tenancy.id, '2027-02-10');
    await a.actions.setOffMarket(unit.id, true);

    const queued = await a.db.outbox.count();
    expect(queued).toBeGreaterThan(8);

    await a.engine.syncOnce();
    expect(a.engine.getStatus()).toMatchObject({ phase: 'idle', pending: 0, rejected: 0 });
    expect(await a.db.rejected.count()).toBe(0);

    await b.engine.syncOnce();
    const pulledLease = (await b.db.entity('leases').get(lease.id)) as unknown as Lease;
    expect(pulledLease).toMatchObject({ rentAmount: 900_000, periodMonths: 6, status: 'upcoming' });
    expect(((await b.db.entity('units').get(unit.id)) as unknown as Unit).status).toBe('off_market');
    const pulledTenancy = (await b.db.entity('tenancies').get(tenancy.id)) as unknown as Tenancy;
    expect(pulledTenancy).toMatchObject({ endDate: '2027-02-10', depositHeld: 120_000 });

    const bEntries = ((await b.db.entity('scheduleEntries').toArray()) as unknown as ScheduleEntry[]).filter((e) => !e.deletedAt);
    expect(bEntries.filter((e) => e.kind === 'landlord_rent').map((e) => e.dueDate).sort()).toEqual(['2026-11-01', '2027-05-01']);
    // The tenant's third period (from 2027-05-05) was dropped when the tenancy ended early.
    expect(bEntries.filter((e) => e.kind === 'tenant_rent').map((e) => e.dueDate).sort()).toEqual(['2026-11-05', '2027-02-05']);
  });
});
