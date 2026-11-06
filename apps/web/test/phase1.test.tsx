import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, todayLocal } from '@subrent/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startServer, type TestServer } from '../../api/test/harness';
import { leases, scheduleEntries, tenancies, units } from '../../api/src/schema';
import { App } from '../src/App';
import { restoreSession } from '../src/sync';

let server: TestServer;

beforeAll(async () => {
  server = await startServer();
  await server.addUser('Fantasy', 'fantasy@example.com', 'correct horse battery');
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => server.app.request(String(input), init));
  vi.stubGlobal('alert', vi.fn());
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterAll(async () => {
  cleanup();
  await server.close();
});

const setDate = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('Phase 1 flow, as a person would do it on their phone', () => {
  it('site, lease, room, tenancy, then the dashboard follows the dates', async () => {
    const user = userEvent.setup();
    const today = todayLocal();
    const leaseStart = addDays(today, -60);
    const moveIn = addDays(today, -5);
    const leftOn = addDays(today, -3);

    await restoreSession();
    render(<App />);
    await user.type(await screen.findByLabelText('Email'), 'fantasy@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await screen.findByText('Start with your first site');

    // --- a site ---------------------------------------------------------------
    await user.click(screen.getByRole('link', { name: 'Add a site' }));
    await user.click(await screen.findByRole('button', { name: 'Add site' }));
    await user.type(screen.getByLabelText('Name'), 'Spintex house');
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    await user.click(await screen.findByRole('link', { name: /Spintex house/ }));

    // --- a lease, with a brand-new landlord created in the same form ---------------
    await user.click(await screen.findByRole('link', { name: 'Add lease' }));
    await user.type(await screen.findByLabelText(/New landlord's name/), 'Mrs Owusu');
    await user.type(screen.getByLabelText(/Rent you pay each period/), '12000');
    await user.click(screen.getByRole('button', { name: '6 mo' }));
    setDate(/Lease starts/, leaseStart);
    // The end date follows the start date until it is set by hand: one year, less a day.
    const leaseEnd = addDays((screen.getByLabelText(/Lease ends/) as HTMLInputElement).value, 0);
    expect(leaseEnd > leaseStart).toBe(true);
    expect(await screen.findByText(/You will owe 2 payments/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add lease' }));

    // --- lease page: schedule, then a room ----------------------------------------
    await screen.findByRole('heading', { name: "Mrs Owusu's lease" });
    expect(screen.getByText('Rent you owe the landlord')).toBeInTheDocument();
    expect(screen.getAllByText('GHS 12,000.00').length).toBeGreaterThanOrEqual(2); // one per scheduled payment
    await user.click(screen.getByRole('button', { name: 'Add room' }));
    await user.type(screen.getByLabelText(/Room name/), 'Room 2');
    await user.click(screen.getByRole('button', { name: 'Add room' }));
    expect(await screen.findByText(/Your cost: GHS 12,000.00 per 6 months/)).toBeInTheDocument();
    expect(screen.getByText(/Vacant 60 days/)).toBeInTheDocument();

    // --- the dashboard sees a vacant room --------------------------------------------
    await user.click(screen.getByRole('link', { name: 'Today' }));
    expect(await screen.findByText('1 vacant room')).toBeInTheDocument();
    expect(screen.getByText(/Vacant 60 days/)).toBeInTheDocument();

    // --- start a tenancy with a brand-new tenant; a 12-month stay outlasts the lease -------
    await user.click(screen.getByRole('link', { name: /Spintex house · Room 2/ }));
    await user.click(await screen.findByRole('link', { name: 'Start a tenancy' }));
    await user.type(await screen.findByLabelText(/New tenant's name/), 'Efua');
    await user.type(screen.getByLabelText(/Rent each period/), '1500');
    setDate(/Moves in/, moveIn);
    await user.click(screen.getByRole('button', { name: '12 mo' }));
    await user.click(screen.getByRole('button', { name: '1 period' }));
    expect(await screen.findByText(/runs past your lease/)).toBeInTheDocument();
    expect(screen.getByText(/1 payment expected/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start tenancy' }));

    await screen.findByText('Current tenant');
    expect(screen.getByRole('link', { name: 'Efua' })).toBeInTheDocument();

    // --- dashboard: room is let, and the lease gap is called out ---------------------------
    await user.click(screen.getByRole('link', { name: 'Today' }));
    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 rooms let')).toBeInTheDocument();
    expect(screen.getByText(/past your lease/)).toBeInTheDocument();
    expect(screen.getByText('Lease gap')).toBeInTheDocument();

    // --- booking someone whose dates overlap the current tenant is refused, with a clear message ---
    await user.click(screen.getByRole('link', { name: /Efua in Spintex house/ }));
    await user.click(await screen.findByRole('link', { name: 'Book the next tenant' }));
    await user.selectOptions(await screen.findByLabelText(/^Tenant/), 'Efua');
    await user.type(screen.getByLabelText(/Rent each period/), '1000');
    await user.click(screen.getByRole('button', { name: 'Start tenancy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Dates cannot overlap/);
    expect(vi.mocked(window.alert)).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: /Room 2/ }));
    await screen.findByText('Current tenant');

    // --- the tenants list shows who is where ---------------------------------------------------------
    await user.click(screen.getByRole('link', { name: 'People' }));
    expect(await screen.findByText('Efua')).toBeInTheDocument();
    expect(screen.getByText('Room 2')).toBeInTheDocument();

    // --- the tenant leaves early: the room is vacant from the next day -----------------------------
    await user.click(screen.getByRole('link', { name: 'Portfolio' }));
    await user.click(await screen.findByRole('link', { name: /Spintex house/ }));
    await user.click(await screen.findByRole('link', { name: /Mrs Owusu/ }));
    await user.click(await screen.findByRole('link', { name: /Room 2/ }));
    await user.click(await screen.findByRole('button', { name: 'Tenant is leaving' }));
    setDate(/Last day in the room/, leftOn);
    await user.click(screen.getByRole('button', { name: 'End tenancy' }));
    expect(await screen.findByText(/2 days, since/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a tenancy' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Today' }));
    expect(await screen.findByText('1 vacant room')).toBeInTheDocument();
    expect(screen.getByText(/Vacant 2 days/)).toBeInTheDocument();
    expect(screen.queryByText('Lease gap')).not.toBeInTheDocument(); // the tenancy is over, so the gap is gone

    // --- everything reaches the server, in an order its foreign keys accept ----------------------------
    await user.click(screen.getByRole('button', { name: /Synced|Syncing|waiting/ }));
    await waitFor(async () => expect(await server.handle.db.select().from(tenancies)).toHaveLength(1), { timeout: 8000 });
    const [lease] = await server.handle.db.select().from(leases);
    expect(lease).toMatchObject({ rentAmount: 1_200_000, periodMonths: 6, startDate: leaseStart });
    expect(await server.handle.db.select().from(units)).toHaveLength(1);
    const [tenancy] = await server.handle.db.select().from(tenancies);
    expect(tenancy).toMatchObject({ rentAmount: 150_000, periodMonths: 12, startDate: moveIn, endDate: leftOn });
    const entries = await server.handle.db.select().from(scheduleEntries);
    // 2 landlord payments, and the tenant's single 12-month payment, which stays because it had started.
    expect(entries.filter((e) => e.kind === 'landlord_rent')).toHaveLength(2);
    expect(entries.filter((e) => e.kind === 'tenant_rent' && !e.deletedAt)).toHaveLength(1);
  });
});
