import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startServer, type TestServer } from '../../api/test/harness';
import { sites } from '../../api/src/schema';
import { App } from '../src/App';
import { restoreSession } from '../src/sync';

let server: TestServer;
let online = true;

beforeAll(async () => {
  server = await startServer();
  await server.addUser('Fantasy', 'fantasy@example.com', 'correct horse battery');
  // The app talks to the real API, in-process. Going "offline" makes fetch throw,
  // exactly as a browser does when it cannot reach the network.
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!online) throw new TypeError('fetch failed');
    return server.app.request(String(input), init);
  });
  vi.stubGlobal('alert', vi.fn());
});

afterAll(async () => {
  cleanup();
  await server.close();
});

describe('the app, end to end in jsdom', () => {
  it('signs in, saves a site offline, and syncs it when the connection returns', async () => {
    const user = userEvent.setup();
    await restoreSession();
    render(<App />);

    // --- sign in --------------------------------------------------------------
    await user.type(await screen.findByLabelText('Email'), 'fantasy@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('wrong email or password');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'correct horse battery');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.getByText('Start with your first site')).toBeInTheDocument();
    await screen.findByRole('button', { name: /^Synced$/ });

    // --- go offline and add a site -------------------------------------------
    online = false;
    await user.click(screen.getByRole('link', { name: 'Portfolio' }));
    await screen.findByRole('heading', { name: 'Sites' });
    await user.click(screen.getByRole('button', { name: 'Add site' }));
    await user.type(screen.getByLabelText('Name'), 'Osu hostel');
    await user.selectOptions(screen.getByLabelText('Type'), 'hostel');
    await user.type(screen.getByLabelText('Address'), 'Osu, Accra');
    await user.click(screen.getByRole('button', { name: 'Add site' }));

    expect(await screen.findByText('Osu hostel')).toBeInTheDocument();
    expect(screen.getByText(/Hostel · Osu, Accra/)).toBeInTheDocument();
    expect(screen.getByText('Not synced')).toBeInTheDocument();
    // The auto-sync that follows a write finds no network and reports it.
    await screen.findByRole('button', { name: /Offline · 1 waiting/ }, { timeout: 5000 });
    expect(await server.handle.db.select().from(sites)).toHaveLength(0);

    // --- sign-out must not throw away unsent work ------------------------------
    await user.click(screen.getByRole('link', { name: 'More' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/not been sent/)));
    await user.click(screen.getByRole('link', { name: 'Portfolio' }));
    expect(await screen.findByText('Osu hostel')).toBeInTheDocument();

    // --- connection returns: tap the badge to sync now -------------------------
    online = true;
    await user.click(screen.getByRole('button', { name: /Offline · 1 waiting/ }));
    await screen.findByRole('button', { name: /^Synced$/ });
    await waitFor(() => expect(screen.queryByText('Not synced')).not.toBeInTheDocument());

    const stored = await server.handle.db.select().from(sites);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ name: 'Osu hostel', type: 'hostel', address: 'Osu, Accra' });

    // --- now sign-out is allowed and returns to the login screen ----------------
    await user.click(screen.getByRole('link', { name: 'More' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Osu hostel')).not.toBeInTheDocument();
  });
});
