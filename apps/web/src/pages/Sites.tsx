import { Link } from '@tanstack/react-router';
import { useMemo, useState, type FormEvent } from 'react';
import { cedi, fmtDate, fmtDayMonth, plural } from '../data/format';
import { useDwellData } from '../data/derive';
import { useSites } from '../data/hooks';
import { isUnsynced, type Site } from '../data/types';
import { actions } from '../sync';
import { Field, FormError, Loading, useAction } from '../components/ui';
import { Icon, BuildingArt } from '../components/Icon';
import { SiteCoordinates } from '../components/SiteCoordinates';
import { useOverlay } from '../components/overlays';

export const SITE_TYPES = [
  { value: 'house', label: 'House' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'block', label: 'Apartment block' },
] as const;

export function SiteForm(props: { site?: Site; onDone?: () => void }) {
  const { site } = props;
  const [name, setName] = useState(site?.name ?? '');
  const [type, setType] = useState<Site['type']>(site?.type ?? 'house');
  const [address, setAddress] = useState(site?.address ?? '');
  const [lat, setLat] = useState(site?.lat != null ? String(site.lat) : '');
  const [lng, setLng] = useState(site?.lng != null ? String(site.lng) : '');
  const [notes, setNotes] = useState(site?.notes ?? '');
  const { error, busy, run } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() => actions.saveSite({ name, type, address, lat, lng, notes }, site?.id));
    if (saved && !site) {
      setName('');
      setAddress('');
      setLat('');
      setLng('');
      setNotes('');
    }
    if (saved) props.onDone?.();
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 className="section-title-sm">{site ? 'Edit site' : 'Add a site'}</h2>
        <span className="pill">{site ? 'Edit' : 'New'}</span>
      </div>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Osu hostel" required />
      </Field>
      <Field label="Type">
        <select value={type} onChange={(e) => setType(e.target.value as Site['type'])}>
          {SITE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Address">
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 Palm Avenue, Osu, Accra" />
      </Field>
      <SiteCoordinates address={address} lat={lat} lng={lng} onLatChange={setLat} onLngChange={setLng} />
      <Field label="Notes">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Gate code, caretaker, landmarks…" />
      </Field>
      <FormError message={error} />
      <button className="btn g" disabled={busy} style={{ alignSelf: 'flex-start' }}>
        {site ? 'Save changes' : 'Add site'}
      </button>
    </form>
  );
}

export function SitesPage() {
  const data = useDwellData();
  const sites = useSites();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'empty' | 'ending' | 'losing'>('all');
  const { openAdd } = useOverlay();

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.siteInfos.filter((info) => {
      if (needle && !`${info.site.name} ${info.site.address ?? ''}`.toLowerCase().includes(needle)) return false;
      if (filter === 'empty') return info.vacant > 0;
      if (filter === 'ending') return Boolean(info.lease && info.lease.endDate <= '2027-02-01');
      if (filter === 'losing') return info.net < 0;
      return true;
    });
  }, [data, filter, query]);

  if (!data || !sites) return <Loading />;

  const next = data.events[0];
  const net = data.netMonthly;

  return (
    <>
      <h1 className="sr-only">Sites</h1>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Portfolio</h1>
          <p className="page-subtitle">Every house, hostel, and block you hold.</p>
        </div>
        <div className="page-actions">
          <Link to="/map" className="btn">
            <Icon name="map" size={18} /> See on map
          </Link>
          <button className="btn g" aria-label={adding ? 'Close add site' : 'Add site'} onClick={() => setAdding((open) => !open)}>
            <Icon name="plus" size={18} strokeWidth={2.4} /> {adding ? 'Close' : 'Add a site'}
          </button>
        </div>
      </header>

      {adding && <SiteForm onDone={() => setAdding(false)} />}

      <section className="card portfolio-summary" aria-label="Summary">
        <Metric label="Sites" value={String(data.sites.length)} />
        <Metric label="Rooms let" value={`${data.summary.occupancy.occupied} of ${data.summary.occupancy.occupied + data.summary.occupancy.vacant}`} />
        <Metric label="Net each month" value={cedi(net)} tone={net >= 0 ? 'mint' : 'coral'} />
        <Metric label="Next date" value={next ? fmtDayMonth(next.date) : '—'} />
      </section>

      <div className="filter-row">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or place"
            aria-label="Search sites"
          />
        </label>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`chip ${filter === 'empty' ? 'on' : ''}`} onClick={() => setFilter('empty')}>Has empty rooms</button>
          <button className={`chip ${filter === 'ending' ? 'on' : ''}`} onClick={() => setFilter('ending')}>Ending soon</button>
          <button className={`chip ${filter === 'losing' ? 'on' : ''}`} onClick={() => setFilter('losing')}>Losing money</button>
        </div>
      </div>

      {data.siteInfos.length === 0 ? (
        <button className="slot" style={{ minHeight: 300 }} onClick={() => openAdd('site')}>
          <span className="ico lg" style={{ background: 'var(--gold)' }}><Icon name="building" size={28} /></span>
          <span className="d" style={{ fontSize: 30, fontWeight: 800 }}>Start with your first site</span>
          <span className="mu" style={{ maxWidth: 420 }}>A house, a hostel, or a block. Add the lease you hold and the rooms inside.</span>
          <span className="btn g" style={{ marginTop: 8 }}><Icon name="plus" size={18} strokeWidth={2.4} /> Add a site</span>
        </button>
      ) : (
        <section className="portfolio-grid" aria-label="Sites">
          {filtered.map((info) => (
            <SiteCard key={info.site.id} info={info} />
          ))}
          <button className="slot portfolio-add" onClick={() => openAdd('site')}>
            <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="plus" size={26} /></span>
            <span className="d" style={{ fontSize: 26, fontWeight: 800 }}>Add a site</span>
            <span className="mu">Another house, hostel, or block.</span>
          </button>
        </section>
      )}

      {filtered.length === 0 && data.siteInfos.length > 0 && (
        <div className="empty-card">
          <Icon name="search" size={28} />
          <b>No sites match that.</b>
          <span>Try a different search or filter.</span>
        </div>
      )}
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'mint' | 'coral' }) {
  return (
    <div className="metric">
      <span className="mu">{label}</span>
      <span className="d n metric-value" style={{ color: tone ? `var(--${tone})` : undefined }}>{value}</span>
    </div>
  );
}

function SiteCard({ info }: { info: NonNullable<ReturnType<typeof useDwellData>>['siteInfos'][number] }) {
  const type = SITE_TYPES.find((t) => t.value === info.site.type)?.label ?? 'Site';
  const address = info.site.address ? `${type} · ${info.site.address}` : type;
  return (
    <Link
      to="/sites/$siteId"
      params={{ siteId: info.site.id }}
      className="site-card"
      aria-label={`${info.site.name}, ${address}, ${info.occupied} of ${info.total} rooms let`}
    >
      <span className="site-art">
        <BuildingArt width={110} height={90} />
        <span className="pill" style={{ position: 'absolute', top: 12, left: 12 }}>
          {type}
        </span>
        {info.vacant > 0 && (
          <span className="pill warn" style={{ position: 'absolute', top: 12, right: 12 }}>
            {plural(info.vacant, 'empty room')}
          </span>
        )}
        <span className="site-art-net" style={{ color: info.net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
          {info.net >= 0 ? '+' : ''}{cedi(info.net)}
        </span>
      </span>
      <span className="site-card-body">
        <span className="row-between">
          <span className="d" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.05 }}>{info.site.name}</span>
          <Icon name="chevronRight" size={20} className="mu" />
        </span>
        <span className="mu small">{address}</span>
        <span className="site-card-stats">
          <span><b>{info.occupied}/{info.total}</b> let</span>
          <span><b>{info.lease ? fmtDate(info.lease.endDate) : 'No lease'}</b> lease ends</span>
          {isUnsynced(info.site) && <span className="pill warn">Not synced</span>}
        </span>
        <span className="bar" style={{ height: 10 }}>
          <i style={{ width: `${info.total ? (info.occupied / info.total) * 100 : 0}%`, background: info.vacant > 0 ? 'var(--gold)' : 'var(--mint)' }} />
        </span>
      </span>
    </Link>
  );
}
