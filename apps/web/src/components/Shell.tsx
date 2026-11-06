import {
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { todayLocal } from '@subrent/shared';
import { cedi, initials, todayLabel } from '../data/format';
import { useDwellData } from '../data/derive';
import { signOut, useSession } from '../sync';
import { Icon, Logo } from './Icon';
import { OverlayProvider, useOverlay } from './overlays';
import { SyncBadge } from './SyncBadge';
import { Login } from '../pages/Login';

const NAV = [
  { to: '/', label: 'Today', a11y: 'Today', icon: 'home' as const, exact: true },
  { to: '/sites', label: 'Portfolio', a11y: 'Portfolio', icon: 'portfolio' as const },
  { to: '/map', label: 'Map', a11y: 'Map', icon: 'map' as const },
  { to: '/calendar', label: 'Calendar', a11y: 'Calendar', icon: 'calendar' as const },
  { to: '/inbox', label: 'Inbox', a11y: 'Inbox', icon: 'inbox' as const, badge: true },
  { to: '/tenants', label: 'People', a11y: 'People', icon: 'people' as const },
  { to: '/money', label: 'Money', a11y: 'Money', icon: 'money' as const },
  { to: '/issues', label: 'Issues', a11y: 'Issues', icon: 'issues' as const },
  { to: '/reminders', label: 'Reminders', a11y: 'Reminders', icon: 'reminders' as const },
] as const;

export function Shell() {
  const session = useSession();
  const location = useRouterState({ select: (state) => state.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (session === undefined) {
    return (
      <div className="center">
        <div className="stack-sm" style={{ alignItems: 'center' }}>
          <Logo width={44} height={48} />
          <span className="mu">Opening Dwell…</span>
        </div>
      </div>
    );
  }
  if (session === null) return <Login />;

  return (
    <OverlayProvider>
      <div className="app">
        <Sidebar path={location} />
        <div className="app-main">
          <div className="content">
            <Outlet />
          </div>
        </div>
        <MobileNav path={location} />
        <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        <SearchButtonBridge onOpen={() => setSearchOpen(true)} />
      </div>
    </OverlayProvider>
  );
}

function Sidebar({ path }: { path: string }) {
  const data = useDwellData();
  const session = useSession();
  const navigate = useNavigate();
  const unread = data?.unread ?? 0;

  return (
    <aside className="side" aria-label="Dwell">
      <Link to="/" className="brand" aria-label="Dwell home">
        <Logo width={32} height={36} />
        <span className="brand-name">Dwell</span>
      </Link>

      <nav className="nav side-nav" aria-label="Main">
        {NAV.map((item) => {
          const exact = 'exact' in item && item.exact === true;
          const active = exact ? path === item.to : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to as never}
              aria-label={item.a11y}
              className={active ? 'on' : ''}
              activeOptions={exact ? { exact: true } : undefined}
            >
              <Icon name={item.icon} size={20} strokeWidth={1.75} />
              <span>{item.label}</span>
              {'badge' in item && item.badge && unread > 0 ? (
                <span className="pill gold" style={{ marginLeft: 'auto', minHeight: 22, height: 22, padding: '0 8px' }}>
                  {unread}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="side-foot">
        <div style={{ alignSelf: 'flex-start' }}>
          <SyncBadge />
        </div>
        <Link to="/settings" className="profile-card" aria-label="Settings">
          <span className="avatar">{initials(session?.user.name ?? 'Dwell')}</span>
          <span className="profile-text">
            <b>{session?.user.name ?? 'Partner'}</b>
            <span>Partner · Settings</span>
          </span>
          <Icon name="chevronRight" size={16} className="mu" />
        </Link>
        <Link to="/more" className="sr-only" aria-label="More">More</Link>
        <button
          className="opt"
          style={{ color: 'var(--mu)', fontSize: 13 }}
          onClick={() => {
            signOut()
              .then(() => navigate({ to: '/' }))
              .catch((error: Error) => window.alert(error.message));
          }}
        >
          <Icon name="logout" size={17} /> Sign out
        </button>
      </div>
    </aside>
  );
}

function MobileNav({ path }: { path: string }) {
  const { openAdd } = useOverlay();
  const data = useDwellData();
  const todayActive = path === '/';
  const sitesActive = path.startsWith('/sites') || path.startsWith('/units') || path.startsWith('/leases');
  const inboxActive = path.startsWith('/inbox') || path.startsWith('/issues') || path.startsWith('/reminders');
  const calendarActive = path.startsWith('/calendar');

  return (
    <nav className="navp mobile-nav" aria-label="Main mobile">
      <Link to="/" aria-label="Today mobile" className={todayActive ? 'on' : ''}>
        <Icon name="home" size={22} strokeWidth={1.9} />
        <span>Today</span>
      </Link>
      <Link to="/sites" aria-label="Sites mobile" className={sitesActive ? 'on' : ''}>
        <Icon name="portfolio" size={22} strokeWidth={1.9} />
      </Link>
      <button className="plus" aria-label="Add" onClick={() => openAdd('menu')}>
        <Icon name="plus" size={26} strokeWidth={2.4} />
      </button>
      <Link
        to="/inbox"
        aria-label="Inbox mobile"
        className={`${inboxActive ? 'on' : ''}${(data?.unread ?? 0) > 0 ? ' dot' : ''}`}
      >
        <Icon name="inbox" size={22} strokeWidth={1.9} />
      </Link>
      <Link to="/calendar" aria-label="Calendar mobile" className={calendarActive ? 'on' : ''}>
        <Icon name="calendar" size={22} strokeWidth={1.9} />
      </Link>
    </nav>
  );
}

function SearchButtonBridge({ onOpen }: { onOpen: () => void }) {
  useEffect(() => {
    const listener = () => onOpen();
    window.addEventListener('dwell:search', listener);
    return () => window.removeEventListener('dwell:search', listener);
  }, [onOpen]);
  return null;
}

export function openSearch() {
  window.dispatchEvent(new Event('dwell:search'));
}

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useDwellData();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    const rows: { label: string; sub: string; to: string; params?: Record<string, string>; icon: 'building' | 'room' | 'people' | 'calendar' | 'money' | 'map' }[] = [
      ...data.siteInfos.map((site) => ({
        label: site.site.name,
        sub: `${site.occupied}/${site.total} rooms let · ${site.site.address ?? 'Site'}`,
        to: '/sites/$siteId',
        params: { siteId: site.site.id },
        icon: 'building' as const,
      })),
      ...data.rooms.map((room) => ({
        label: room.unit.name,
        sub: `${room.site.name} · ${room.tenantName}`,
        to: '/units/$unitId',
        params: { unitId: room.unit.id },
        icon: 'room' as const,
      })),
      ...data.tenants.map((tenant) => ({
        label: tenant.name,
        sub: tenant.phone ?? 'Tenant',
        to: '/tenants/$tenantId',
        params: { tenantId: tenant.id },
        icon: 'people' as const,
      })),
      { label: 'Money', sub: 'Payments, expenses, and rent due', to: '/money', icon: 'money' as const },
      { label: 'Calendar', sub: 'Everything coming up', to: '/calendar', icon: 'calendar' as const },
      { label: 'Map', sub: 'Where your rooms are', to: '/map', icon: 'map' as const },
    ];
    const filtered = needle
      ? rows.filter((row) => `${row.label} ${row.sub}`.toLowerCase().includes(needle))
      : rows.slice(0, 8);
    return filtered.slice(0, 10);
  }, [data, query]);

  if (!open) return null;

  return (
    <>
      <button className="scrim" aria-label="Close search" onClick={onClose} style={{ zIndex: 80 }} />
      <div
        className="glass"
        role="dialog"
        aria-label="Search"
        style={{ position: 'fixed', zIndex: 90, left: '50%', top: 96, transform: 'translateX(-50%)', width: 'min(620px, calc(100vw - 32px))', padding: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 10px' }}>
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sites, rooms, people…"
            aria-label="Search sites, rooms, people"
            style={{ background: 'transparent', border: 0, minHeight: 40, padding: '0 4px', fontSize: 17 }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) {
                const first = results[0];
                void navigate({ to: first.to as never, params: first.params as never });
                onClose();
              }
            }}
          />
          <span className="pill" style={{ fontSize: 11 }}>Esc</span>
        </div>
        <div className="stack-sm" style={{ gap: 2 }}>
          {results.length === 0 ? (
            <p className="mu" style={{ padding: 14 }}>Nothing matches “{query}”.</p>
          ) : (
            results.map((row) => (
              <button
                key={`${row.to}-${row.label}`}
                className="opt"
                onClick={() => {
                  void navigate({ to: row.to as never, params: row.params as never });
                  onClose();
                }}
              >
                <span className="ico sm" style={{ background: 'var(--s3)', color: 'var(--tx)' }}>
                  <Icon name={row.icon} size={17} />
                </span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <b style={{ fontWeight: 600 }}>{row.label}</b>
                  <span className="mu small">{row.sub}</span>
                </span>
                <Icon name="arrowRight" size={16} className="mu" />
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/** The top-of-page utility row used by Today and Settings. */
export function UtilityBar({ tone = 'desktop' }: { tone?: 'desktop' | 'plain' }) {
  const { openAdd } = useOverlay();
  const data = useDwellData();
  const [notifOpen, setNotifOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const today = data?.today ?? todayLocal();

  return (
    <header className={`utility ${tone}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 12 }}>
      <span className="mu" style={{ fontWeight: 500 }}>{todayLabel(today)}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <button className="btn desktop-only" onClick={openSearch} style={{ minWidth: 280, justifyContent: 'space-between', color: 'var(--mu)', fontWeight: 500 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="search" size={18} /> Search or jump to
          </span>
          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 8, background: 'var(--s3)' }}>Ctrl K</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button
            className="btn ic1"
            aria-label={`Notifications, ${data?.unread ?? 0} new`}
            onClick={() => {
              setNotifOpen((open) => !open);
              setMenuOpen(false);
            }}
          >
            <Icon name="bell" size={20} />
            {(data?.unread ?? 0) > 0 && (
              <span className="ping-dot">
                <span className="ping" />
                <span />
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <button className="scrim" aria-label="Close notifications" onClick={() => setNotifOpen(false)} style={{ position: 'fixed' }} />
              <div className="pop" role="dialog" aria-label="Notifications" style={{ right: 0, top: 56, width: 'min(420px, calc(100vw - 32px))', padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px 12px' }}>
                  <span className="d" style={{ fontSize: 22, fontWeight: 700 }}>Inbox</span>
                  <Link to="/inbox" onClick={() => setNotifOpen(false)} style={{ fontWeight: 600, fontSize: 13, color: 'var(--gold)' }}>
                    See all
                  </Link>
                </div>
                {(data?.inbox ?? []).slice(0, 4).map((item, index) => (
                  <button
                    key={item.id}
                    className={`notif ${index > 1 ? 'read' : ''}`}
                    style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => {
                      setNotifOpen(false);
                      void navigate({ to: item.to as never, params: item.params as never });
                    }}
                  >
                    <span className="unread" />
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{item.title}</span>
                      <span className="mu" style={{ fontSize: 13 }}>{item.body}</span>
                    </span>
                  </button>
                ))}
                {(data?.inbox.length ?? 0) === 0 && <p className="mu" style={{ padding: 12 }}>Nothing needs you right now.</p>}
              </div>
            </>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className="btn g"
            onClick={() => {
              setMenuOpen((open) => !open);
              setNotifOpen(false);
            }}
          >
            <Icon name="plus" size={18} strokeWidth={2.4} /> New
          </button>
          {menuOpen && (
            <>
              <button className="scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} style={{ position: 'fixed' }} />
              <div className="pop" role="menu" aria-label="Create" style={{ right: 0, top: 56, width: 280, padding: 10 }}>
                <button className="opt" role="menuitem" onClick={() => { setMenuOpen(false); openAdd('payment'); }}>
                  <Icon name="card" size={20} /> Log a payment
                </button>
                <button className="opt" role="menuitem" onClick={() => { setMenuOpen(false); openAdd('tenant'); }}>
                  <Icon name="peopleAdd" size={20} /> Add a tenant
                </button>
                <button className="opt" role="menuitem" onClick={() => { setMenuOpen(false); openAdd('room'); }}>
                  <Icon name="room" size={20} /> Add a room
                </button>
                <button className="opt" role="menuitem" onClick={() => { setMenuOpen(false); openAdd('site'); }}>
                  <Icon name="building" size={20} /> Add a site
                </button>
                <button className="opt" role="menuitem" onClick={() => { setMenuOpen(false); openAdd('expense'); }}>
                  <Icon name="document" size={20} /> Add an expense
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Mobile page header: date + greeting + avatar, like the prototype. */
export function MobileGreeting({ name }: { name: string }) {
  return (
    <header className="mobile-greeting" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="mu">{todayLabel(todayLocal())}</span>
        <span className="d" style={{ fontSize: 24, fontWeight: 700 }}>Good day, {name}</span>
      </div>
      <Link to="/settings" className="ib" aria-label="Your profile" style={{ background: 'var(--gold)', color: 'var(--ink)', borderColor: 'var(--gold)', fontWeight: 800 }}>
        <span className="d" style={{ fontSize: 20 }}>{initials(name).slice(0, 1)}</span>
      </Link>
    </header>
  );
}

/** A small money line, shared by cards. */
export function MoneyLine({ amount, palette = 'auto' }: { amount: number; palette?: 'auto' | 'ink' }) {
  const tone = palette === 'ink' ? undefined : amount >= 0 ? 'var(--mint)' : 'var(--coral)';
  return <span className="n" style={{ color: tone }}>{cedi(amount)}</span>;
}

export function useMobileGreetingName(): string {
  const session = useSession();
  return (session?.user.name ?? 'partner').split(' ')[0]!.toLowerCase();
}
