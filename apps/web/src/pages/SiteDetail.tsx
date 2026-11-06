import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { cedi, fmtDate, monthly, plural, relativeDays } from '../data/format';
import { useDwellData } from '../data/derive';
import { useSites } from '../data/hooks';
import { actions } from '../sync';
import { BackLink, confirmDelete, Empty, FormError, Loading, useAction } from '../components/ui';
import { Icon } from '../components/Icon';
import { MapCard } from '../components/MapArt';
import { SITE_TYPES, SiteForm } from './Sites';

export function SiteDetail() {
  const { siteId } = useParams({ strict: false }) as { siteId: string };
  const navigate = useNavigate();
  const data = useDwellData();
  const sites = useSites();
  const [editing, setEditing] = useState(false);
  const { error, run } = useAction();

  if (!data || !sites) return <Loading />;
  const info = data.siteInfos.find((s) => s.site.id === siteId);
  const site = sites.find((s) => s.id === siteId);
  if (!site || !info) {
    return (
      <>
        <BackLink to="/sites">Sites</BackLink>
        <Empty>This site no longer exists.</Empty>
      </>
    );
  }

  const type = SITE_TYPES.find((t) => t.value === site.type)?.label ?? 'Site';
  const lease = info.lease;
  const landlord = lease ? data.landlords.find((l) => l.id === lease.landlordId) : undefined;
  const full = info.vacant === 0 && info.total > 0;
  const leases = info.leases;

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <Link to="/sites" className="back-link"><Icon name="chevronLeft" size={16} /> Sites</Link>
          <h1 className="page-title">{site.name}</h1>
          <p className="page-subtitle">{type}{site.address ? ` · ${site.address}` : ''}</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setEditing((open) => !open)}>
            <Icon name="edit" size={17} /> {editing ? 'Close' : 'Edit'}
          </button>
          {lease ? (
            <Link to="/sites/$siteId/leases/new" params={{ siteId }} className="btn" aria-label="Add lease">
              <Icon name="plus" size={17} /> Add lease
            </Link>
          ) : (
            <Link to="/sites/$siteId/leases/new" params={{ siteId }} className="btn g" aria-label="Add lease">
              <Icon name="plus" size={18} strokeWidth={2.4} /> Add lease
            </Link>
          )}
        </div>
      </header>

      {editing && <SiteForm site={site} onDone={() => setEditing(false)} />}
      {site.notes && !editing && <p className="mu">{site.notes}</p>}

      <section className="site-hero">
        <div className="card site-net">
          <div className="row-between">
            <span className="eyebrow">Net each month</span>
            <span className={`pill ${info.net >= 0 ? 'ok' : 'bad'}`}>{full ? 'Full house' : `${plural(info.vacant, 'room')} empty`}</span>
          </div>
          <span className="d n site-net-value" style={{ color: info.net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
            {info.net >= 0 ? '+' : '−'}{cedi(Math.abs(info.net))}
          </span>
          <div className="bar" style={{ height: 18 }}>
            <i style={{ width: `${info.monthlyCost > 0 ? Math.min(100, (info.monthlyRent / info.monthlyCost) * 100) : 0}%`, background: 'var(--mint)' }} />
          </div>
          <div className="site-money-row">
            <span><span className="mu">Rent in</span><b className="d n" style={{ color: 'var(--mint)' }}>{cedi(info.monthlyRent)}</b></span>
            <span><span className="mu">Lease cost</span><b className="d n">{cedi(info.monthlyCost)}</b></span>
            <span><span className="mu">Rooms let</span><b className="d n">{info.occupied} of {info.total}</b></span>
          </div>
        </div>

        {lease && (
          <Link to="/leases/$leaseId" params={{ leaseId: lease.id }} className="bone site-lease" aria-label={`${landlord?.name ?? 'Landlord'}'s lease`}>
            <div className="row-between">
              <span className="eyebrow">Your lease</span>
              <Icon name="arrowRight" size={18} />
            </div>
            <span className="d lease-name">{landlord?.name ?? 'Landlord'}</span>
            <span style={{ color: 'var(--bmu)' }}>{cedi(lease.rentAmount)} every {lease.periodMonths} months</span>
            <span className="lease-progress-row">
              <span className="bar" style={{ background: '#d9d2c0' }}>
                <i style={{ width: '62%', background: 'var(--bink)' }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bmu)' }}>{relativeDays(lease.endDate, data.today)}</span>
            </span>
            <span style={{ fontSize: 13, color: 'var(--bmu)' }}>Ends {fmtDate(lease.endDate)}</span>
          </Link>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Rooms</h2>
          {lease && (
            <Link to="/leases/$leaseId" params={{ leaseId: lease.id }} className="btn sm" aria-label="Add room">
              <Icon name="plus" size={15} /> Add room
            </Link>
          )}
        </div>
        {info.rooms.length === 0 ? (
          <div className="empty-card">
            <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="room" size={26} /></span>
            <b className="d" style={{ fontSize: 24, color: 'var(--tx)' }}>No rooms yet</b>
            <span>Open the lease and add the rooms you sublet. A whole house can be one room.</span>
            {lease && (
              <Link to="/leases/$leaseId" params={{ leaseId: lease.id }} className="btn g" aria-label="Add room">
                Add the first room
              </Link>
            )}
          </div>
        ) : (
          <div className="room-grid">
            {info.rooms.map((room) => (
              <Link
                to="/units/$unitId"
                params={{ unitId: room.unit.id }}
                key={room.unit.id}
                className={`room-card ${room.state === 'occupied' ? 'let' : ''}`}
              >
                <span className="row-between">
                  <span className="room-card-name d">{room.unit.name}</span>
                  <span className={`pill ${room.state === 'occupied' ? 'ok' : room.state === 'vacant' ? 'warn' : ''}`}>
                    {room.state === 'occupied' ? 'Let' : room.state === 'vacant' ? 'Empty' : room.state === 'off_market' ? 'Off' : 'Soon'}
                  </span>
                </span>
                <span className="room-card-person">
                  {room.state === 'occupied' ? room.tenantName : room.state === 'vacant' ? `${plural(room.vacantDays, 'day')} empty` : 'Not lettable'}
                </span>
                <span className="room-card-money">
                  <span><span className="mu">Rent</span><b className="n">{cedi(room.monthlyRent)}</b></span>
                  <span><span className="mu">Cost</span><b className="n">{cedi(room.monthlyCost)}</b></span>
                  <span><span className="mu">Net</span><b className="n" style={{ color: room.net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>{room.net >= 0 ? '+' : ''}{cedi(room.net)}</b></span>
                </span>
                {room.current?.endDate && (
                  <span className="room-card-foot">{fmtDate(room.current.endDate)} · {relativeDays(room.current.endDate, data.today)}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {leases.length > 1 && (
        <section>
          <div className="section-head"><h2>Lease history</h2></div>
          <div className="stack-sm">
            {leases.map((item) => (
              <Link key={item.id} to="/leases/$leaseId" params={{ leaseId: item.id }} className="card row-link" style={{ padding: 20 }}>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <b>{data.landlords.find((l) => l.id === item.landlordId)?.name ?? 'Landlord'}</b>
                  <span className="mu small">{fmtDate(item.startDate)} to {fmtDate(item.endDate)}</span>
                </span>
                <span className="pill">{cedi(monthly(item.rentAmount, item.periodMonths))}/mo</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="dash-split">
        <MapCard siteCount={1} label={site.name} />
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 className="d" style={{ fontSize: 28, fontWeight: 700 }}>At a glance</h2>
          <div className="kv"><span className="mu">Type</span><b>{type}</b></div>
          <div className="kv"><span className="mu">Address</span><b style={{ textAlign: 'right' }}>{site.address ?? 'Not set'}</b></div>
          <div className="kv"><span className="mu">Lease ends</span><b>{lease ? fmtDate(lease.endDate) : 'No lease'}</b></div>
          <div className="kv"><span className="mu">Rooms</span><b>{info.total}</b></div>
          <div className="kv"><span className="mu">Vacant</span><b>{info.vacant}</b></div>
          {info.offMarket > 0 && <div className="kv"><span className="mu">Off market</span><b>{info.offMarket}</b></div>}
          <div className="row wrap" style={{ marginTop: 'auto' }}>
            <Link to="/inbox" className="btn">Open inbox</Link>
            <Link to="/calendar" className="btn">Calendar</Link>
          </div>
        </div>
      </section>

      <FormError message={error} />
      <button
        className="btn danger"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          if (!confirmDelete(`${site.name}`)) return;
          const done = await run(async () => {
            await actions.removeSite(site.id);
            return true;
          });
          if (done) void navigate({ to: '/sites' });
        }}
      >
        Delete site
      </button>
    </>
  );
}
