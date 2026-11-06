import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { cedi, fmtDate, initials, periodLabel, plural } from '../data/format';
import { useDwellData } from '../data/derive';
import { useTenants } from '../data/hooks';
import { isUnsynced } from '../data/types';
import { actions } from '../sync';
import { BackLink, confirmDelete, Empty, FormError, Loading, useAction } from '../components/ui';
import { Icon } from '../components/Icon';
import { useOverlay } from '../components/overlays';

export function TenantsPage() {
  const data = useDwellData();
  const tenants = useTenants();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'tenants' | 'landlords'>('tenants');
  const { openAdd } = useOverlay();

  const people = useMemo(() => {
    if (!data) return [];
    return data.tenants
      .map((tenant) => {
        const room = data.rooms.find((r) => r.current?.tenantId === tenant.id) ?? null;
        return { tenant, room };
      })
      .sort((a, b) => {
        const weight = (value: typeof a) => (value.room ? 0 : 1);
        return weight(a) - weight(b) || a.tenant.name.localeCompare(b.tenant.name);
      });
  }, [data]);

  const filtered = people.filter(({ tenant }) => {
    const needle = query.trim().toLowerCase();
    return !needle || tenant.name.toLowerCase().includes(needle) || (tenant.phone ?? '').includes(needle);
  });

  const landlords = (data?.landlords ?? []).filter((landlord) => {
    const needle = query.trim().toLowerCase();
    return !needle || landlord.name.toLowerCase().includes(needle) || (landlord.phone ?? '').includes(needle);
  });

  if (!data || !tenants) return <Loading />;
  const currentCount = people.filter((p) => p.room).length;

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">People</h1>
          <p className="page-subtitle">{currentCount} in a room · {plural(data.tenants.length - currentCount, 'person', 'people')} between stays</p>
        </div>
        <div className="page-actions">
          <button className="btn g" onClick={() => openAdd('tenant')}>
            <Icon name="peopleAdd" size={18} /> Add a person
          </button>
        </div>
      </header>

      <div className="filter-row">
        <label className="search-field">
          <Icon name="search" size={17} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or phone"
            aria-label="Search people"
          />
        </label>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className={`chip ${tab === 'tenants' ? 'on' : ''}`} onClick={() => setTab('tenants')}>Tenants</button>
          <button className={`chip ${tab === 'landlords' ? 'on' : ''}`} onClick={() => setTab('landlords')}>Landlords</button>
        </div>
      </div>

      {tab === 'tenants' ? (
        filtered.length === 0 ? (
          <div className="empty-card">
            <Icon name="people" size={30} />
            <b className="d" style={{ fontSize: 24, color: 'var(--tx)' }}>{data.tenants.length === 0 ? 'No tenants yet' : 'No one matches that'}</b>
            <span>{data.tenants.length === 0 ? 'Add the people who rent your rooms.' : 'Try another name or number.'}</span>
            {data.tenants.length === 0 && <button className="btn g" onClick={() => openAdd('tenant')}>Add a tenant</button>}
          </div>
        ) : (
          <section className="people-grid" aria-label="People">
            {filtered.map(({ tenant, room }) => (
              <Link
                key={tenant.id}
                to="/tenants/$tenantId"
                params={{ tenantId: tenant.id }}
                className="person-card"
              >
                <span className="avatar lg">{initials(tenant.name).slice(0, 1)}</span>
                <span className="person-main">
                  <span className="d person-name">{tenant.name}</span>
                  <span className="mu small">{tenant.phone ?? 'No phone saved'}</span>
                </span>
                <span className="person-meta">
                  {room ? (
                    <>
                      <b>{room.unit.name}</b>
                      <span className="mu small">{room.site.name}</span>
                    </>
                  ) : (
                    <span className="pill">Between stays</span>
                  )}
                </span>
                <span className="person-money">
                  {room ? (
                    <>
                      <b className="n">{cedi(room.monthlyRent)}</b>
                      <span className="mu small">a month</span>
                    </>
                  ) : (
                    <span className="mu small">No room</span>
                  )}
                </span>
                <span className="person-tail">
                  {isUnsynced(tenant) && <span className="pill warn">Not synced</span>}
                  <Icon name="chevronRight" size={18} className="mu" />
                </span>
              </Link>
            ))}
          </section>
        )
      ) : landlords.length === 0 ? (
        <div className="empty-card">
          <b className="d" style={{ fontSize: 24, color: 'var(--tx)' }}>No landlords yet</b>
          <span>They appear when you add a lease.</span>
        </div>
      ) : (
        <section className="people-grid" aria-label="Landlords">
          {landlords.map((landlord) => {
            const leases = data.leases.filter((lease) => lease.landlordId === landlord.id);
            return (
              <div key={landlord.id} className="person-card">
                <span className="avatar lg sky">{initials(landlord.name).slice(0, 1)}</span>
                <span className="person-main">
                  <span className="d person-name">{landlord.name}</span>
                  <span className="mu small">{landlord.phone ?? 'No phone saved'}</span>
                </span>
                <span className="person-meta">
                  <b>{plural(leases.length, 'lease')}</b>
                  <span className="mu small">{leases[0] ? `Ends ${fmtDate(leases[0].endDate)}` : 'No lease'}</span>
                </span>
                <span className="person-money">
                  <b className="n">{leases[0] ? cedi(leases[0].rentAmount) : '—'}</b>
                  <span className="mu small">{leases[0] ? `every ${periodLabel(leases[0].periodMonths)}` : ''}</span>
                </span>
                <span className="person-tail">
                  {leases[0] && (
                    <Link to="/leases/$leaseId" params={{ leaseId: leases[0].id }} className="pill sky">Lease</Link>
                  )}
                </span>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

export function TenantDetail() {
  const { tenantId } = useParams({ strict: false }) as { tenantId: string };
  const navigate = useNavigate();
  const data = useDwellData();
  const [editing, setEditing] = useState(false);
  const { error, run } = useAction();

  if (!data) return <Loading />;
  const tenant = data.tenants.find((t) => t.id === tenantId);
  if (!tenant) {
    return (
      <>
        <BackLink to="/tenants">People</BackLink>
        <Empty>This person no longer exists.</Empty>
      </>
    );
  }

  const mine = data.tenancies.filter((t) => t.tenantId === tenant.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const current = mine.find((t) => data.rooms.some((r) => r.current?.id === t.id));
  const room = current ? data.rooms.find((r) => r.current?.id === current.id) : undefined;
  const due = current ? data.entries.filter((entry) => entry.tenancyId === current.id && entry.dueDate <= data.today && !data.payments.some((p) => p.scheduleEntryId === entry.id)) : [];
  const dueTotal = due.reduce((sum, entry) => sum + entry.amountDue, 0);
  const landlord = room ? data.landlords.find((l) => l.id === room.lease.landlordId) : undefined;

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <Link to="/tenants" className="back-link"><Icon name="chevronLeft" size={16} /> People</Link>
          <h1 className="page-title">{tenant.name}</h1>
          <p className="page-subtitle">{room ? `${room.unit.name} · ${room.site.name}` : 'Between stays'}</p>
        </div>
        <div className="page-actions">
          {tenant.phone && (
            <>
              <a className="btn" href={`tel:${tenant.phone}`}><Icon name="message" size={17} /> Call</a>
              <a className="btn" href={`https://wa.me/${tenant.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
            </>
          )}
          <button className="btn" onClick={() => setEditing((open) => !open)}>{editing ? 'Close' : 'Edit'}</button>
        </div>
      </header>

      {editing && <TenantEdit tenant={tenant} onDone={() => setEditing(false)} />}

      <section className="profile-hero">
        <div className="card" style={{ padding: 32, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="avatar" style={{ width: 96, height: 96, fontSize: 42 }}>{initials(tenant.name).slice(0, 1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <span className="d" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>{tenant.name}</span>
            <span className="mu">{tenant.phone ?? 'No phone saved'}</span>
            {room && (
              <Link to="/units/$unitId" params={{ unitId: room.unit.id }} className="pill ok" style={{ alignSelf: 'flex-start', marginTop: 6 }}>
                {room.unit.name} · {room.site.name}
              </Link>
            )}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="mu small">{dueTotal > 0 ? 'Outstanding' : 'Rent'}</span>
            <span className="d n" style={{ fontSize: 40, fontWeight: 800, color: dueTotal > 0 ? 'var(--coral)' : 'var(--mint)', lineHeight: 1 }}>
              {dueTotal > 0 ? cedi(dueTotal) : current ? 'Paid up' : '—'}
            </span>
            {current && <span className="mu small">{cedi(current.rentAmount)} every {periodLabel(current.periodMonths)}</span>}
          </div>
        </div>
        <div className="bone" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="eyebrow">Contact card</span>
          <span className="d" style={{ fontSize: 28, fontWeight: 800 }}>{tenant.phone ?? 'No phone'}</span>
          <span style={{ color: 'var(--bmu)' }}>ID: {tenant.idDetails ?? 'Not recorded'}</span>
          <span style={{ color: 'var(--bmu)' }}>Guarantor: {tenant.guarantor ?? 'Not recorded'}</span>
          {tenant.notes && <p style={{ color: 'var(--bmu)' }}>{tenant.notes}</p>}
          {tenant.phone && (
            <a className="btn k" style={{ marginTop: 'auto' }} href={`https://wa.me/${tenant.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              Open WhatsApp
            </a>
          )}
        </div>
      </section>

      {current && room && (
        <section>
          <div className="section-head"><h2>Current stay</h2><Link to="/units/$unitId" params={{ unitId: room.unit.id }} className="btn sm">Open room</Link></div>
          <div className="card" style={{ padding: 28 }}>
            <div className="site-money-row">
              <span><span className="mu">Moved in</span><b>{fmtDate(current.startDate)}</b></span>
              <span><span className="mu">Leaves</span><b>{fmtDate(current.endDate)}</b></span>
              <span><span className="mu">Room</span><b>{room.unit.name}</b></span>
              <span><span className="mu">Your landlord</span><b>{landlord?.name ?? '—'}</b></span>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="section-head"><h2>History</h2></div>
        {mine.length === 0 ? (
          <Empty>No tenancies yet. Start one from a room.</Empty>
        ) : (
          <div className="card" style={{ padding: 8 }}>
            {mine.map((tenancy, index) => {
              const historyRoom = data.rooms.find((r) => r.unit.id === tenancy.unitId);
              const active = tenancy.id === current?.id;
              return (
                <Link
                  key={tenancy.id}
                  to="/units/$unitId"
                  params={{ unitId: tenancy.unitId }}
                  className="row-between"
                  style={{ padding: '16px', borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <b>{historyRoom ? `${historyRoom.site.name} · ${historyRoom.unit.name}` : 'Room'}</b>
                    <span className="mu small">{fmtDate(tenancy.startDate)} to {fmtDate(tenancy.endDate)}</span>
                  </span>
                  <span className={`pill ${active ? 'ok' : ''}`}>{active ? 'Current' : tenancy.startDate > data.today ? 'Upcoming' : 'Past'}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <FormError message={error} />
      <button
        className="btn danger"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          if (!confirmDelete(tenant.name)) return;
          const done = await run(async () => {
            await actions.removeTenant(tenant.id);
            return true;
          });
          if (done) void navigate({ to: '/tenants' });
        }}
      >
        Delete person
      </button>
      {mine.length > 0 && <p className="muted small">A person with {plural(mine.length, 'tenancy', 'tenancies')} on record cannot be deleted until those are removed.</p>}
    </>
  );
}

function TenantEdit({ tenant, onDone }: { tenant: NonNullable<ReturnType<typeof useDwellData>>['tenants'][number]; onDone: () => void }) {
  const [name, setName] = useState(tenant.name);
  const [phone, setPhone] = useState(tenant.phone ?? '');
  const [idDetails, setIdDetails] = useState(tenant.idDetails ?? '');
  const [guarantor, setGuarantor] = useState(tenant.guarantor ?? '');
  const [notes, setNotes] = useState(tenant.notes ?? '');
  const { error, busy, run } = useAction();

  return (
    <form
      className="card form"
      onSubmit={async (event: React.FormEvent) => {
        event.preventDefault();
        const saved = await run(() => actions.saveTenant({ name, phone, idDetails, guarantor, notes }, tenant.id));
        if (saved) onDone();
      }}
    >
      <div className="two">
        <label className="field"><span>Name</span><input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field"><span>Phone</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      </div>
      <div className="two">
        <label className="field"><span>ID details</span><input value={idDetails} onChange={(e) => setIdDetails(e.target.value)} /></label>
        <label className="field"><span>Guarantor</span><input value={guarantor} onChange={(e) => setGuarantor(e.target.value)} /></label>
      </div>
      <label className="field"><span>Notes</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <FormError message={error} />
      <button className="btn g" style={{ alignSelf: 'flex-start' }} disabled={busy}>Save changes</button>
    </form>
  );
}
