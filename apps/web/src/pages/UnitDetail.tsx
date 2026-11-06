import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { allocateByWeight, summarizeUnit, todayLocal } from '@subrent/shared';
import { useState, type FormEvent } from 'react';
import { UnitForm } from '../components/UnitForm';
import { BackLink, Empty, FormError, Loading, confirmDelete, useAction } from '../components/ui';
import { Icon, ProgressRing } from '../components/Icon';
import { cedi, fmtDate, initials, money, periodLabel, plural, relativeDays } from '../data/format';
import { useLeases, usePayments, useScheduleEntries, useSites, useTenancies, useTenants, useUnits } from '../data/hooks';
import type { Tenancy } from '../data/types';
import { actions } from '../sync';
import { useOverlay } from '../components/overlays';

function EndTenancy(props: { tenancy: Tenancy; today: string; onDone: () => void }) {
  const { tenancy, today } = props;
  const [date, setDate] = useState(today < tenancy.startDate ? tenancy.startDate : tenancy.endDate && today > tenancy.endDate ? tenancy.endDate : today);
  const { error, busy, run } = useAction();

  return (
    <form
      className="subform"
      onSubmit={async (event) => {
        event.preventDefault();
        if (await run(() => actions.endTenancy(tenancy.id, date))) props.onDone();
      }}
    >
      <label className="field">
        <span>Last day in the room</span>
        <input type="date" value={date} min={tenancy.startDate} max={tenancy.endDate ?? undefined} onChange={(e) => setDate(e.target.value)} required />
        <span className="hint">The room counts as vacant from the next day. Rent periods that start after this date are removed.</span>
      </label>
      <FormError message={error} />
      <div className="two">
        <button type="button" className="btn" onClick={props.onDone}>
          Cancel
        </button>
        <button className="btn g" disabled={busy}>
          End tenancy
        </button>
      </div>
    </form>
  );
}

export function UnitDetail() {
  const { unitId } = useParams({ strict: false }) as { unitId: string };
  const navigate = useNavigate();
  const units = useUnits();
  const leases = useLeases();
  const sites = useSites();
  const tenancies = useTenancies();
  const tenants = useTenants();
  const entries = useScheduleEntries();
  const payments = usePayments();
  const [editing, setEditing] = useState(false);
  const [ending, setEnding] = useState(false);
  const { error, run } = useAction();
  const { openAdd } = useOverlay();

  if (!units || !leases || !sites || !tenancies || !tenants || !entries || !payments) return <Loading />;
  const unit = units.find((u) => u.id === unitId);
  if (!unit) {
    return (
      <>
        <BackLink to="/sites">Sites</BackLink>
        <Empty>This room no longer exists.</Empty>
      </>
    );
  }
  const lease = leases.find((l) => l.id === unit.leaseId);
  if (!lease) return <Empty>This room's lease no longer exists.</Empty>;
  const site = sites.find((s) => s.id === lease.siteId);

  const today = todayLocal();
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const mine = tenancies.filter((t) => t.unitId === unit.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const summary = summarizeUnit(unit, lease, tenancies, today);
  const current = mine.find((t) => t.id === summary.currentTenancyId);
  const tenant = current ? tenantById.get(current.tenantId) : undefined;
  const siblings = units.filter((u) => u.leaseId === lease.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const share = allocateByWeight(lease.rentAmount, siblings.map((s) => s.allocationWeight))[siblings.findIndex((s) => s.id === unit.id)] ?? 0;
  const monthlyCost = Math.round(share / lease.periodMonths);
  const monthlyRent = current ? Math.round(current.rentAmount / current.periodMonths) : 0;
  const net = monthlyRent - monthlyCost;
  const offMarket = unit.status === 'off_market';
  const currentEntries = current ? entries.filter((entry) => entry.tenancyId === current.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate)) : [];
  const paidEntries = new Set(payments.map((p) => p.scheduleEntryId).filter(Boolean));
  const due = currentEntries.find((entry) => entry.dueDate <= today && !paidEntries.has(entry.id));
  const daysLeft = current?.endDate ? Math.max(0, Math.round((Date.parse(`${current.endDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)) : null;
  const totalDays = current?.endDate ? Math.max(1, Math.round((Date.parse(`${current.endDate}T12:00:00Z`) - Date.parse(`${current.startDate}T12:00:00Z`)) / 86_400_000)) : 1;
  const elapsed = current?.endDate ? Math.max(0, Math.min(1, 1 - (daysLeft ?? 0) / totalDays)) : 0;

  return (
    <>
      <h2 className="sr-only">Current tenant</h2>
      <header className="page-header">
        <div className="page-heading">
          <Link to="/sites/$siteId" params={{ siteId: lease.siteId }} className="back-link">
            <Icon name="chevronLeft" size={16} /> {site?.name ?? 'Site'}
          </Link>
          <h1 className="page-title">{unit.name}</h1>
          <p className="page-subtitle">{site?.name} · {unit.name} · {current ? `let to ${tenant?.name}` : 'empty'}</p>
        </div>
        <div className="page-actions">
          {tenant?.phone && (
            <a className="btn" href={`https://wa.me/${tenant.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
              <Icon name="message" size={17} /> Message {tenant.name.split(' ')[0]}
            </a>
          )}
          {current && (
            <button className="btn g" onClick={() => openAdd('payment')}>
              <Icon name="card" size={18} /> Log payment
            </button>
          )}
          <button className="btn" onClick={() => setEditing((open) => !open)}>
            <Icon name="edit" size={17} /> {editing ? 'Close' : 'Edit'}
          </button>
        </div>
      </header>

      {editing && <UnitForm leaseId={lease.id} unit={unit} onDone={() => setEditing(false)} />}

      {current && tenant ? (
        <section className="room-hero">
          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div className="row">
              <span className="avatar lg">{initials(tenant.name).slice(0, 1)}</span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <Link to="/tenants/$tenantId" params={{ tenantId: tenant.id }} className="d" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1 }} aria-label={tenant.name}>
                  {tenant.name}
                </Link>
                <span className="mu">Moved in {fmtDate(current.startDate)}</span>
              </span>
              <span className={`pill ${due ? 'warn' : 'ok'}`} style={{ marginLeft: 'auto' }}>{due ? 'Rent due' : 'Paid up'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="row-between wrap">
                <span className="d n" style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{daysLeft} days left</span>
                <span className="mu">Ends {fmtDate(current.endDate)}</span>
              </div>
              <div className="bar" style={{ height: 14 }} role="img" aria-label={`Tenancy ${Math.round(elapsed * 100)} percent done`}>
                <i style={{ width: `${Math.max(2, elapsed * 100)}%`, background: 'var(--gold)' }} />
              </div>
            </div>
            <div className="site-money-row">
              <span><span className="mu">Rent</span><b className="d n">{cedi(current.rentAmount)}</b><span className="mu" style={{ fontSize: 13 }}>every {periodLabel(current.periodMonths)}</span></span>
              <span><span className="mu">Per month</span><b className="d n">{cedi(monthlyRent)}</b></span>
              <span><span className="mu">Room costs</span><b className="d n" style={{ color: 'var(--coral)' }}>{cedi(monthlyCost)}</b></span>
            </div>
            <div className="row wrap">
              <button className="btn" onClick={() => openAdd('payment')}><Icon name="card" size={17} /> Log payment</button>
              <Link to="/units/$unitId/tenancies/new" params={{ unitId: unit.id }} className="btn">Book the next tenant</Link>
              <Link to="/tenancies/$tenancyId/edit" params={{ tenancyId: current.id }} className="btn">Edit terms</Link>
              <button className="btn danger" onClick={() => setEnding(true)}>Tenant is leaving</button>
              <Link to="/tenants/$tenantId" params={{ tenantId: tenant.id }} className="btn">Open profile</Link>
            </div>
            {ending && <EndTenancy tenancy={current} today={today} onDone={() => setEnding(false)} />}
          </div>

          <div className="bone" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 className="d" style={{ fontSize: 28, fontWeight: 800 }}>What happens next</h2>
            <div className="timeline" style={{ flex: 1 }}>
              <div className="step"><span style={{ fontWeight: 700 }}>{fmtDate(current.startDate)}</span><span style={{ color: 'var(--bmu)' }}>{tenant.name} moved in</span></div>
              <div className="step"><span style={{ fontWeight: 700 }}>{current.endDate ? fmtDate(`${current.endDate.slice(0, 8)}14`) : '—'}</span><span style={{ color: 'var(--bmu)' }}>WhatsApp: are you staying?</span></div>
              <div className="step next"><span style={{ fontWeight: 700 }}>{fmtDate(current.endDate)}</span><span style={{ color: 'var(--bmu)' }}>Tenancy ends</span></div>
            </div>
            <Link to="/reminders" className="btn k" style={{ marginTop: 'auto' }}>Set a reminder</Link>
          </div>
        </section>
      ) : (
        <section className="bone" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row-between">
            <span className={`pill ${offMarket ? '' : 'warn'}`}>{offMarket ? 'Off the market' : 'Empty room'}</span>
            <span className="mu">{summary.state === 'vacant' ? `${plural(summary.vacantDays, 'day')} empty` : summary.state === 'off_market' ? 'Not lettable' : 'Lease not started'}</span>
          </div>
          <h2 className="d" style={{ fontSize: 'clamp(36px, 4vw, 56px)', fontWeight: 800, lineHeight: 1.02 }}>
            {offMarket ? 'This room is resting.' : summary.vacantDays === 0 ? 'Empty from today.' : `Empty ${plural(summary.vacantDays, 'day')}, since ${fmtDate(summary.vacantSince)}.`}
          </h2>
          <p style={{ color: 'var(--bmu)' }}>
            The room costs {cedi(monthlyCost)} a month while it sits empty. Book the next tenant early.
          </p>
          {!offMarket && (
            <Link to="/units/$unitId/tenancies/new" params={{ unitId: unit.id }} className="btn k" style={{ alignSelf: 'flex-start' }}>
              Start a tenancy
            </Link>
          )}
          {offMarket && <p style={{ color: 'var(--bmu)' }}>This room is off the market. Put it back to rent it out.</p>}
        </section>
      )}

      {current && (
        <section className="room-actions">
          <Link to="/inventory" className="card room-action">
            <span className="ico" style={{ background: 'var(--sky)' }}><Icon name="box" size={22} /></span>
            <span><b>Inventory</b><span className="mu small">What is in this room</span></span>
            <Icon name="arrowRight" size={18} className="mu" style={{ marginLeft: 'auto' }} />
          </Link>
          <Link to="/contract" className="card room-action">
            <span className="ico" style={{ background: 'var(--gold)' }}><Icon name="document" size={22} /></span>
            <span><b>Contract</b><span className="mu small">Signed tenancy agreement</span></span>
            <Icon name="arrowRight" size={18} className="mu" style={{ marginLeft: 'auto' }} />
          </Link>
          <Link to="/issues" className="card room-action">
            <span className="ico" style={{ background: 'var(--coral)' }}><Icon name="wrench" size={22} /></span>
            <span><b>Issues</b><span className="mu small">Repairs and complaints</span></span>
            <Icon name="arrowRight" size={18} className="mu" style={{ marginLeft: 'auto' }} />
          </Link>
        </section>
      )}

      {current && (
        <section>
          <div className="section-head"><h2>Rent history</h2></div>
          {currentEntries.length === 0 ? (
            <Empty>No rent scheduled yet.</Empty>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              {currentEntries.map((entry, index) => {
                const paid = paidEntries.has(entry.id);
                return (
                  <div key={entry.id} className="row-between" style={{ padding: '14px 16px', borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}>
                    <span className="row">
                      <span className="ico sm" style={{ background: paid ? 'var(--mint)' : entry.dueDate < today ? 'var(--coral)' : 'var(--s2)', color: paid || entry.dueDate < today ? 'var(--ink)' : 'var(--tx)' }}>
                        <Icon name={paid ? 'check' : 'clock'} size={17} />
                      </span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <b>{fmtDate(entry.dueDate)}</b>
                        <span className="mu small">{paid ? 'Paid' : entry.dueDate < today ? 'Overdue' : relativeDays(entry.dueDate, today)}</span>
                      </span>
                    </span>
                    <b className="n">{money(entry.amountDue)}</b>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="section-head"><h2>History</h2></div>
        {mine.length === 0 ? (
          <Empty>No tenants yet.</Empty>
        ) : (
          <ul className="list">
            {mine.map((t) => {
              const isCurrent = t.id === current?.id;
              const upcoming = t.startDate > today;
              return (
                <li key={t.id} className="card">
                  <div className="row">
                    <span className="avatar">{initials(tenantById.get(t.tenantId)?.name ?? '?').slice(0, 1)}</span>
                    <div>
                      <div className="title">{tenantById.get(t.tenantId)?.name ?? 'Tenant'}</div>
                      <div className="muted small">{fmtDate(t.startDate)} to {fmtDate(t.endDate)}</div>
                      <div className="muted small">{money(t.rentAmount)} every {periodLabel(t.periodMonths)}</div>
                    </div>
                    <span className={`pill ${isCurrent ? 'ok' : upcoming ? 'warn' : ''}`} style={{ marginLeft: 'auto' }}>{isCurrent ? 'Current' : upcoming ? 'Upcoming' : 'Past'}</span>
                  </div>
                  <div className="two top-gap">
                    <Link to="/tenancies/$tenancyId/edit" params={{ tenancyId: t.id }} className="btn">
                      Edit
                    </Link>
                    <button
                      className="btn danger"
                      onClick={() => {
                        if (confirmDelete('this tenancy and its rent schedule')) void run(() => actions.removeTenancy(t.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FormError message={error} />
      <div className="stack">
        <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => void run(() => actions.setOffMarket(unit.id, !offMarket))} disabled={Boolean(current) && !offMarket}>
          {offMarket ? 'Put back on the market' : 'Take off the market'}
        </button>
        {current && !offMarket && <p className="muted small">End the current tenancy before taking this room off the market.</p>}
        {!current && !offMarket && (
          <button
            className="btn danger"
            style={{ alignSelf: 'flex-start' }}
            onClick={async () => {
              if (!confirmDelete(unit.name)) return;
              const done = await run(async () => {
                await actions.removeUnit(unit.id);
                return true;
              });
              if (done) void navigate({ to: '/leases/$leaseId', params: { leaseId: lease.id } });
            }}
          >
            Delete room
          </button>
        )}
      </div>
    </>
  );
}
