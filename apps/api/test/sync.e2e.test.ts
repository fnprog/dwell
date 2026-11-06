import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { newDevice, startServer, type TestServer } from './harness';

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
  await server.addUser('Fantasy', 'fantasy@example.com', 'correct horse battery');
  await server.addUser('Brother', 'brother@example.com', 'another long password');
  await server.addUser('Caretaker', 'staff@example.com', 'staff long password', 'staff');
});

afterAll(async () => {
  await server.close();
});

async function signedIn(email: string, password: string) {
  const device = newDevice(server);
  await device.engine.login(email, password);
  return device;
}

describe('auth', () => {
  it('rejects a wrong password and accepts the right one', async () => {
    const device = newDevice(server);
    await expect(device.engine.login('fantasy@example.com', 'wrong password')).rejects.toThrow(/wrong email or password/);
    const session = await device.engine.login('FANTASY@example.com', 'correct horse battery');
    expect(session.user.role).toBe('owner');
    expect(await device.engine.getSession()).not.toBeNull();
  });

  it('blocks sync routes without a token', async () => {
    expect((await server.app.request('/api/sync/pull')).status).toBe(401);
    expect((await server.app.request('/api/sync/push', { method: 'POST' })).status).toBe(401);
  });

  it('keeps staff out of sync until the staff role is built', async () => {
    const staff = await signedIn('staff@example.com', 'staff long password');
    await staff.engine.create('sites', { name: 'Nope', type: 'house' });
    await staff.engine.syncOnce();
    // 403 is surfaced as an error, and the change stays queued rather than being lost.
    expect(staff.engine.getStatus().phase).toBe('error');
    expect(staff.engine.getStatus().pending).toBe(1);
  });

  it('rate-limits repeated failed logins', async () => {
    const device = newDevice(server);
    for (let i = 0; i < 10; i++) {
      await expect(device.engine.login('limit@example.com', 'nope')).rejects.toThrow();
    }
    await expect(device.engine.login('limit@example.com', 'nope')).rejects.toThrow(/too many attempts/);
  });
});

describe('two devices syncing offline-first', () => {
  it('writes offline, syncs when back online, and the other partner sees it', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const b = await signedIn('brother@example.com', 'another long password');

    a.setOnline(false);
    const site = await a.engine.create('sites', { name: 'Osu hostel', type: 'hostel', address: 'Osu, Accra' });
    expect((await a.db.entity('sites').get(site.id))?.['name']).toBe('Osu hostel');
    expect(a.engine.getStatus().pending).toBe(1);

    await a.engine.syncOnce();
    expect(a.engine.getStatus().phase).toBe('offline');
    expect(a.engine.getStatus().pending).toBe(1);

    a.setOnline(true);
    await a.engine.syncOnce();
    expect(a.engine.getStatus().phase).toBe('idle');
    expect(a.engine.getStatus().pending).toBe(0);

    await b.engine.syncOnce();
    const seen = await b.db.entity('sites').get(site.id);
    expect(seen?.['name']).toBe('Osu hostel');
    expect(seen?.['createdBy']).toBe((await a.engine.getSession())?.user.id);
    expect(typeof seen?.['seq']).toBe('number');
  });

  it('merges concurrent offline edits to different fields, last write wins on the same field', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const b = await signedIn('brother@example.com', 'another long password');

    const tenant = await a.engine.create('tenants', { name: 'Kofi', phone: '024 000 0000' });
    await a.engine.syncOnce();
    await b.engine.syncOnce();

    a.setOnline(false);
    b.setOnline(false);
    await a.engine.update('tenants', tenant.id, { phone: '024 111 1111', notes: 'prefers MoMo' });
    await b.engine.update('tenants', tenant.id, { phone: '020 222 2222', guarantor: 'Ama (sister)' });

    a.setOnline(true);
    await a.engine.syncOnce();
    b.setOnline(true);
    await b.engine.syncOnce(); // B pushed later, so B's phone wins
    await a.engine.syncOnce();

    for (const device of [a, b]) {
      const row = await device.db.entity('tenants').get(tenant.id);
      expect(row?.['phone']).toBe('020 222 2222');
      expect(row?.['notes']).toBe('prefers MoMo');
      expect(row?.['guarantor']).toBe('Ama (sister)');
    }
  });

  it('syncs a deletion as a soft delete', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const b = await signedIn('brother@example.com', 'another long password');
    const landlord = await a.engine.create('landlords', { name: 'Mr Mensah' });
    await a.engine.syncOnce();
    await a.engine.remove('landlords', landlord.id);
    await a.engine.syncOnce();
    await b.engine.syncOnce();
    const row = await b.db.entity('landlords').get(landlord.id);
    expect(row?.['deletedAt']).toBeTruthy();
  });

  it('keeps an unsent local edit on top of a pulled server version', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const b = await signedIn('brother@example.com', 'another long password');
    const site = await a.engine.create('sites', { name: 'Madina house', type: 'house' });
    await a.engine.syncOnce();
    await b.engine.syncOnce();

    await a.engine.update('sites', site.id, { name: 'Madina house (renamed)' });
    await a.engine.syncOnce();

    // B edits while its sync is already running: the edit lands after the push
    // step finished but before the pull's response is applied, so it is still unsent.
    let raced = false;
    const racing = new (await import('@subrent/sync-client')).SyncEngine(b.db, {
      baseUrl: '',
      fetchImpl: async (input, init) => {
        if (String(input).includes('/api/sync/pull') && !raced) {
          raced = true;
          await racing.update('sites', site.id, { name: 'B typed this mid-sync', notes: 'gate code 1234' });
        }
        return server.app.request(String(input), init);
      },
    });
    await racing.syncOnce();
    expect(raced).toBe(true);

    // The pulled server version (renamed by A) must not wipe B's unsent edit...
    const row = await b.db.entity('sites').get(site.id);
    expect(row?.['name']).toBe('B typed this mid-sync');
    expect(row?.['notes']).toBe('gate code 1234');
    expect(racing.getStatus().pending).toBe(1);

    // ...and once B's edit is sent, both devices agree on it.
    await racing.syncOnce();
    await a.engine.syncOnce();
    expect(racing.getStatus().pending).toBe(0);
    expect((await a.db.entity('sites').get(site.id))?.['name']).toBe('B typed this mid-sync');
  });

  it('pushes a whole business graph in order and every row arrives on the other device', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const b = await signedIn('brother@example.com', 'another long password');

    a.setOnline(false);
    const site = await a.engine.create('sites', { name: 'Spintex house', type: 'house' });
    const landlord = await a.engine.create('landlords', { name: 'Mrs Owusu' });
    const lease = await a.engine.create('leases', {
      siteId: site.id,
      landlordId: landlord.id,
      rentAmount: 1_200_000,
      periodMonths: 6,
      startDate: '2026-11-01',
      endDate: '2027-10-31',
      advancePaid: 2_400_000,
    });
    const unit = await a.engine.create('units', { leaseId: lease.id, name: 'Room 2', targetPrice: 150_000 });
    const tenant = await a.engine.create('tenants', { name: 'Efua' });
    await a.engine.create('tenancies', {
      unitId: unit.id,
      tenantId: tenant.id,
      rentAmount: 150_000,
      periodMonths: 3,
      startDate: '2026-11-05',
    });
    a.setOnline(true);

    await a.engine.syncOnce();
    expect(a.engine.getStatus()).toMatchObject({ phase: 'idle', pending: 0, rejected: 0 });

    await b.engine.syncOnce();
    for (const table of ['sites', 'landlords', 'leases', 'units', 'tenants', 'tenancies'] as const) {
      expect(await b.db.entity(table).count()).toBeGreaterThan(0);
    }
    const pulledLease = await b.db.entity('leases').get(lease.id);
    expect(pulledLease?.['rentAmount']).toBe(1_200_000);
    expect(pulledLease?.['periodMonths']).toBe(6);
  });

  it('pushing the same change twice is harmless', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const session = await a.engine.getSession();
    const id = randomUUID();
    const body = JSON.stringify({
      changes: [{ table: 'sites', id, op: 'upsert', patch: { name: 'Retry house', type: 'house' } }],
    });
    const call = () =>
      server.app.request('/api/sync/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${session!.token}` },
        body,
      });
    const first = await (await call()).json();
    const second = await (await call()).json();
    expect(first.results[0].status).toBe('ok');
    expect(second.results[0].status).toBe('ok');
    const pull = await a.engine.syncOnce();
    expect(pull.phase).toBe('idle');
    const matches = (await a.db.entity('sites').toArray()).filter((s) => s['name'] === 'Retry house');
    expect(matches).toHaveLength(1);
  });
});

describe('server-side rules', () => {
  async function pushRaw(token: string, changes: unknown[]) {
    const response = await server.app.request('/api/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ changes }),
    });
    return (await response.json()) as { results: { status: string; reason?: string }[] };
  }

  it('rejects bad values without losing the good changes in the same batch', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const { token } = (await a.engine.getSession())!;
    const good = randomUUID();
    const { results } = await pushRaw(token, [
      { table: 'sites', id: randomUUID(), op: 'upsert', patch: { name: 'Bad type', type: 'castle' } },
      { table: 'sites', id: good, op: 'upsert', patch: { name: 'Fine', type: 'house' } },
      { table: 'sites', id: randomUUID(), op: 'upsert', patch: { type: 'house' } },
      { table: 'nonsense', id: randomUUID(), op: 'upsert', patch: {} },
      { table: 'sites', id: randomUUID(), op: 'upsert', patch: { name: 'X', bogusField: 1 } },
    ]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'ok', 'rejected', 'rejected', 'rejected']);
    expect(results[0]?.reason).toMatch(/one of/);
  });

  it('refuses to let a device write users, server fields, or float money', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const { token } = (await a.engine.getSession())!;
    const { results } = await pushRaw(token, [
      { table: 'users', id: randomUUID(), op: 'upsert', patch: { name: 'Hacker', email: 'h@x.com', passwordHash: 'x' } },
      {
        table: 'landlords',
        id: randomUUID(),
        op: 'upsert',
        patch: { name: 'Float', seq: 1, updatedAt: '2000-01-01T00:00:00Z' },
      },
      {
        table: 'leases',
        id: randomUUID(),
        op: 'upsert',
        patch: { rentAmount: 1500.5 },
      },
    ]);
    expect(results[0]?.status).toBe('rejected');
    expect(results[1]?.status).toBe('ok'); // server fields are ignored, not trusted
    expect(results[2]?.status).toBe('rejected');
  });

  it('never sends password hashes to devices', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    await a.engine.syncOnce();
    const localUsers = await a.db.entity('users').toArray();
    expect(localUsers.length).toBeGreaterThanOrEqual(2);
    for (const user of localUsers) expect(user).not.toHaveProperty('passwordHash');
  });

  it('keeps payments append-only: no edits, no deletes, reversals instead', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const { token } = (await a.engine.getSession())!;
    const paymentId = randomUUID();
    const base = { direction: 'in', amount: 150_000, paidOn: '2026-11-05', method: 'momo' };

    const first = await pushRaw(token, [{ table: 'payments', id: paymentId, op: 'upsert', patch: base }]);
    expect(first.results[0]?.status).toBe('ok');

    const edit = await pushRaw(token, [
      { table: 'payments', id: paymentId, op: 'upsert', patch: { ...base, amount: 1 } },
    ]);
    expect(edit.results[0]?.status).toBe('rejected');
    expect(edit.results[0]?.reason).toMatch(/append-only/);

    const del = await pushRaw(token, [{ table: 'payments', id: paymentId, op: 'delete', patch: {} }]);
    expect(del.results[0]?.status).toBe('rejected');

    const reversal = await pushRaw(token, [
      {
        table: 'payments',
        id: randomUUID(),
        op: 'upsert',
        patch: { ...base, amount: -150_000, reversesPaymentId: paymentId },
      },
    ]);
    expect(reversal.results[0]?.status).toBe('ok');

    // The sign rule is enforced by the database itself.
    const wrongSign = await pushRaw(token, [
      { table: 'payments', id: randomUUID(), op: 'upsert', patch: { ...base, amount: -5 } },
    ]);
    expect(wrongSign.results[0]?.status).toBe('rejected');

    // And the client refuses before anything is queued.
    await expect(a.engine.update('payments', paymentId, { amount: 2 })).rejects.toThrow(/append-only/);
  });

  it('drops a rejected new row from the device and reports it', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const bad = await a.engine.create('sites', { name: 'Impossible', type: 'castle' });
    await a.engine.syncOnce();
    expect(await a.db.entity('sites').get(bad.id)).toBeUndefined();
    expect(a.engine.getStatus().rejected).toBeGreaterThanOrEqual(1);
    const rejected = await a.db.rejected.toArray();
    expect(rejected.at(-1)?.reason).toMatch(/one of/);
  });

  it('refuses to sign out while changes are unsent', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    a.setOnline(false);
    await a.engine.create('sites', { name: 'Unsent', type: 'house' });
    await expect(a.engine.logout()).rejects.toThrow(/not been sent/);
    a.setOnline(true);
    await a.engine.syncOnce();
    await a.engine.logout();
    expect(await a.engine.getSession()).toBeNull();
    expect(await a.db.entity('sites').count()).toBe(0);
  });
});

describe('pull paging', () => {
  it('pages through more rows than the limit without gaps or repeats', async () => {
    const a = await signedIn('fantasy@example.com', 'correct horse battery');
    const { token } = (await a.engine.getSession())!;
    const ids = Array.from({ length: 25 }, () => randomUUID());
    const push = await server.app.request('/api/sync/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        changes: ids.map((id, i) => ({
          table: i % 2 === 0 ? 'landlords' : 'tenants',
          id,
          op: 'upsert',
          patch: { name: `Bulk ${i}` },
        })),
      }),
    });
    expect(push.status).toBe(200);

    const fresh = await signedIn('brother@example.com', 'another long password');
    // A tiny page size forces many round trips.
    const small = new (await import('@subrent/sync-client')).SyncEngine(fresh.db, {
      baseUrl: '',
      pullLimit: 4,
      fetchImpl: async (input, init) => server.app.request(String(input), init),
    });
    await small.syncOnce();
    expect(small.getStatus().phase).toBe('idle');
    const have = new Set([
      ...(await fresh.db.entity('landlords').toArray()).map((r) => r.id),
      ...(await fresh.db.entity('tenants').toArray()).map((r) => r.id),
    ]);
    for (const id of ids) expect(have.has(id)).toBe(true);
  });
});
