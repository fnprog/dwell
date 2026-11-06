import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { allocateByWeight, findLeaseFlags, summarizeUnit, todayLocal } from '@subrent/shared';
import { useState } from 'react';
import { UnitForm } from '../components/UnitForm';
import { BackLink, Chip, Empty, FormError, Loading, confirmDelete, useAction } from '../components/ui';
import { Icon } from '../components/Icon';
import { cedi, fmtDate, money, periodLabel, plural, relativeDays } from '../data/format';
import { useLandlords, useLeases, useScheduleEntries, useSites, useTenancies, useTenants, useUnits } from '../data/hooks';
import { actions } from '../sync';

export function LeaseDetail() {
  const { leaseId } = useParams({ strict: false }) as { leaseId: string };
  const navigate = useNavigate();
  const leases = useLeases();
  const sites = useSites();
  const landlords = useLandlords();
  const units = useUnits();
  const tenancies = useTenancies();
  const tenants = useTenants();
  const entries = useScheduleEntries();
  const [addingRoom, setAddingRoom] = useState(false);
  const { error, run } = useAction();

  if (!leases || !sites || !landlords || !units || !tenancies || !tenants || !entries) return <Loading />;
  const lease = leases.find((l) => l.id === leaseId);
  if (!lease) {
    return (
      <>
        <BackLink to="/sites">Sites</BackLink>
        <Empty>This lease no longer exists.</Empty>
      </>
    );
  }

  const today = todayLocal();
  const site = sites.find((s) => s.id === lease.siteId);
  const landlord = landlords.find((l) => l.id === lease.landlordId);
  const rooms = units.filter((u) => u.leaseId === lease.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const tenancyById = new Map(tenancies.map((t) => [t.id, t]));
  const shares = allocateByWeight(lease.rentAmount, rooms.map((r) => r.allocationWeight));
  const flags = findLeaseFlags([lease], rooms, tenancies, today).filter((f) => f.kind === 'tenancy_outlasts_lease');
  const schedule = entries.filter((e) => e.leaseId === lease.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const ended = lease.endDate < today;
  const notStarted = lease.startDate > today;
  const equal = new Set(rooms.map((r) => r.allocationWeight)).size <= 1;
  const monthlyCost = Math.round(lease.rentAmount / lease.periodMonths);
  const nextDue = schedule.find((entry) => entry.dueDate >= today);
  const occupied = rooms.filter((room) => summarizeUnit(room, lease, tenancies, today).state === 'occupied').length;

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <Link to="/sites/$siteId" params={{ siteId: lease.siteId }} className="back-link">
            <Icon name="chevronLeft" size={16} /> {site?.name ?? 'Site'}
          </Link>
          <h1 className="page-title">{landlord?.name ?? 'Landlord'}'s lease</h1>
          <p className="page-subtitle">{site?.name} · {fmtDate(lease.startDate)} to {fmtDate(lease.endDate)}</p>
        </div>
        <div className="page-actions">
          <Link to="/leases/$leaseId/edit" params={{ leaseId }} className="btn">
            <Icon name="edit" size={17} /> Edit
          </Link>
        </div>
      </header>

      <section className="lease-hero">
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="row-between">
            <span className={`pill ${ended ? 'bad' : notStarted ? 'warn' : 'ok'}`}>{ended ? 'Ended' : notStarted ? 'Upcoming' : 'Active'}</span>
            <span className="mu small">{relativeDays(lease.endDate, today)}</span>
          </div>
          <span className="d n" style={{ fontSize: 'clamp(44px, 5vw, 72px)', fontWeight: 800, lineHeight: 1 }}>
            {cedi(lease.rentAmount)}
          </span>
          <span className="mu">every {periodLabel(lease.periodMonths)} · about {cedi(monthlyCost)} a month</span>
          <div className="site-money-row">
            <span><span className="mu">Rooms let</span><b className="d n">{occupied} of {rooms.length}</b></span>
            <span><span className="mu">Advance</span><b className="d n">{cedi(lease.advancePaid)}</b></span>
            <span><span className="mu">Deposit</span><b className="d n">{cedi(lease.depositPaid)}</b></span>
          </div>
          {lease.notes && <p className="mu small">{lease.notes}</p>}
        </div>
        <div className="bone" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="eyebrow">Next rent to the landlord</span>
          <span className="d" style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.05 }}>
            {nextDue ? fmtDate(nextDue.dueDate) : 'No payment due'}
          </span>
          <span style={{ color: 'var(--bmu)' }}>
            {nextDue ? `${cedi(nextDue.amountDue)} · ${relativeDays(nextDue.dueDate, today)}` : 'Every rent period is settled.'}
          </span>
          <div className="timeline" style={{ marginTop: 12 }}>
            <div className="step"><span style={{ fontWeight: 700 }}>{fmtDate(lease.startDate)}</span><span style={{ color: 'var(--bmu)' }}>Lease starts</span></div>
            <div className="step next"><span style={{ fontWeight: 700 }}>{fmtDate(lease.endDate)}</span><span style={{ color: 'var(--bmu)' }}>Lease ends</span></div>
          </div>
          <div className="row wrap" style={{ marginTop: 'auto' }}>
            <button className="btn k" onClick={() => setAddingRoom((open) => !open)}>
              {addingRoom ? 'Close' : 'Add room'}
            </button>
            <Link to="/sites/$siteId" params={{ siteId: lease.siteId }} className="btn o">Open site</Link>
          </div>
        </div>
      </section>

      {addingRoom && (
        <div className="card" style={{ padding: 24 }}>
          <UnitForm leaseId={lease.id} onDone={() => setAddingRoom(false)} />
        </div>
      )}

      {flags.length > 0 && (
        <div className="card attention" style={{ padding: 22 }}>
          <strong>Heads up:</strong>{' '}
          {plural(flags.length, 'tenancy', 'tenancies')} {flags.length === 1 ? 'runs' : 'run'} past the end of this lease. Renew with the landlord or shorten the tenancy.
        </div>
      )}

      <section>
        <div className="section-head">
          <h2>Rooms</h2>
        </div>
        {rooms.length === 0 ? (
          <div className="empty-card">
            <b className="d" style={{ fontSize: 24, color: 'var(--tx)' }}>No rooms yet</b>
            <span>Add the rooms you sublet under this lease. A whole house can be one room.</span>
          </div>
        ) : (
          <>
            <p className="mu small" style={{ marginBottom: 14 }}>
              {rooms.length === 1
                ? `This room carries the whole ${money(lease.rentAmount)} you pay per period.`
                : equal
                  ? `The landlord's ${money(lease.rentAmount)} per period is split equally across ${rooms.length} rooms.`
                  : `The landlord's ${money(lease.rentAmount)} per period is split across ${rooms.length} rooms by each room's share.`}
            </p>
            <div className="room-grid">
              {rooms.map((room, index) => {
                const summary = summarizeUnit(room, lease, tenancies, today);
                const tenancy = summary.currentTenancyId ? tenancyById.get(summary.currentTenancyId) : undefined;
                const tenant = tenancy && tenantById.get(tenancy.tenantId);
                return (
                  <Link
                    key={room.id}
                    to="/units/$unitId"
                    params={{ unitId: room.id }}
                    className={`room-card ${summary.state === 'occupied' ? 'let' : ''}`}
                    aria-label={`${room.name}${tenant ? `, ${tenant.name}` : ''}`}
                  >
                    <span className="row-between">
                      <span className="room-card-name d">{room.name}</span>
                      <Chip tone={summary.state === 'occupied' ? 'ok' : summary.state === 'vacant' ? 'warn' : 'plain'}>
                        {summary.state === 'occupied' ? 'Let' : summary.state === 'vacant' ? 'Vacant' : summary.state === 'off_market' ? 'Off' : 'Soon'}
                      </Chip>
                    </span>
                    <span className="room-card-person">
                      {summary.state === 'occupied'
                        ? `${tenant?.name ?? 'Tenant'} · ${money(tenancy?.rentAmount ?? 0)} per ${periodLabel(tenancy?.periodMonths ?? 1)}`
                        : summary.state === 'vacant'
                          ? summary.vacantDays === 0
                            ? 'Vacant from today'
                            : `Vacant ${plural(summary.vacantDays, 'day')}`
                          : summary.state === 'off_market'
                            ? 'Off the market'
                            : 'Lease not started'}
                    </span>
                    <span className="room-card-foot">Your cost: {money(shares[index] ?? 0)} per {periodLabel(lease.periodMonths)}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section>
        <div className="section-head"><h2>Rent you owe the landlord</h2></div>
        {schedule.length === 0 ? (
          <Empty>No payments scheduled.</Empty>
        ) : (
          <div className="card" style={{ padding: 8 }}>
            {schedule.map((entry, index) => (
              <div key={entry.id} className="row-between" style={{ padding: '14px 16px', borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={`ico sm ${entry.dueDate < today ? 'done' : ''}`} style={{ background: entry.dueDate < today ? 'var(--mint)' : 'var(--s2)', color: entry.dueDate < today ? 'var(--ink)' : 'var(--tx)' }}>
                    <Icon name={entry.dueDate < today ? 'check' : 'clock'} size={18} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <b>{fmtDate(entry.dueDate)}</b>
                    <span className="mu small">{relativeDays(entry.dueDate, today)}</span>
                  </span>
                </span>
                <b className="n">{money(entry.amountDue)}</b>
              </div>
            ))}
          </div>
        )}
      </section>

      <FormError message={error} />
      <button
        className="btn danger"
        style={{ alignSelf: 'flex-start' }}
        onClick={async () => {
          if (!confirmDelete('this lease')) return;
          const done = await run(async () => {
            await actions.removeLease(lease.id);
            return true;
          });
          if (done) void navigate({ to: '/sites/$siteId', params: { siteId: lease.siteId } });
        }}
      >
        Delete lease
      </button>
    </>
  );
}
