import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { cedi, fmtDate, fmtDayMonth, monthKey, relativeDays } from '../data/format';
import { useDwellData } from '../data/derive';
import { Icon } from '../components/Icon';
import { useOverlay } from '../components/overlays';
import { Loading } from '../components/ui';

const CATEGORY_LABEL: Record<string, string> = {
  maintenance: 'Maintenance',
  repair: 'Repairs',
  cleaning: 'Cleaning',
  furnishing: 'Furniture',
  other: 'Other',
};

export function MoneyPage() {
  const data = useDwellData();
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const { openAdd } = useOverlay();

  if (!data) return <Loading />;

  const totalIn = data.payments.filter((p) => p.direction === 'in').reduce((sum, p) => sum + p.amount, 0);
  const totalOut = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const net = totalIn - totalOut;
  const cover = totalOut > 0 ? Math.round((totalIn / totalOut) * 100) : totalIn > 0 ? 100 : 0;

  const nextDue = data.entries
    .filter((entry) => entry.kind === 'tenant_rent' && entry.dueDate >= data.today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const nextDueTenancy = nextDue?.tenancyId ? data.tenancies.find((t) => t.id === nextDue.tenancyId) : undefined;
  const nextDueRoom = nextDueTenancy ? data.rooms.find((r) => r.unit.id === nextDueTenancy.unitId) : undefined;

  const activity = [
    ...data.payments.map((payment) => {
      const entry = payment.scheduleEntryId ? data.entries.find((e) => e.id === payment.scheduleEntryId) : undefined;
      const tenancy = entry?.tenancyId ? data.tenancies.find((t) => t.id === entry.tenancyId) : undefined;
      const room = tenancy ? data.rooms.find((r) => r.unit.id === tenancy.unitId) : undefined;
      return {
        id: payment.id,
        kind: 'in' as const,
        date: payment.paidOn,
        title: `Rent from ${room?.tenantName ?? 'a tenant'}`,
        subtitle: `${room?.unit.name ?? 'Room'}${room ? ` · ${room.site.name}` : ''} · ${payment.method}`,
        amount: payment.amount,
        to: room ? '/units/$unitId' : '/money',
        params: room ? { unitId: room.unit.id } : undefined,
      };
    }),
    ...data.expenses.map((expense) => {
      const room = expense.unitId ? data.rooms.find((r) => r.unit.id === expense.unitId) : undefined;
      const site = expense.siteId ? data.sites.find((s) => s.id === expense.siteId) : undefined;
      return {
        id: expense.id,
        kind: 'out' as const,
        date: expense.spentOn,
        title: CATEGORY_LABEL[expense.category] ?? 'Expense',
        subtitle: `${room?.unit.name ?? site?.name ?? 'Shared'}${expense.vendor ? ` · ${expense.vendor}` : ''}${expense.note ? ` · ${expense.note}` : ''}`,
        amount: expense.amount,
        to: room ? '/units/$unitId' : '/money',
        params: room ? { unitId: room.unit.id } : undefined,
      };
    }),
    ...data.entries
      .filter((entry) => entry.kind === 'tenant_rent' && entry.dueDate <= data.today && !data.payments.some((p) => p.scheduleEntryId === entry.id))
      .map((entry) => {
        const tenancy = entry.tenancyId ? data.tenancies.find((t) => t.id === entry.tenancyId) : undefined;
        const room = tenancy ? data.rooms.find((r) => r.unit.id === tenancy.unitId) : undefined;
        return {
          id: `due-${entry.id}`,
          kind: 'due' as const,
          date: entry.dueDate,
          title: `Rent due from ${room?.tenantName ?? 'a tenant'}`,
          subtitle: `${room?.unit.name ?? 'Room'} · not logged yet`,
          amount: entry.amountDue,
          to: room ? '/units/$unitId' : '/money',
          params: room ? { unitId: room.unit.id } : undefined,
        };
      }),
  ]
    .filter((row) => filter === 'all' || (filter === 'in' && row.kind !== 'out') || (filter === 'out' && row.kind === 'out'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  const categories = Object.entries(
    data.expenses.reduce<Record<string, number>>((acc, expense) => {
      acc[expense.category] = (acc[expense.category] ?? 0) + expense.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const categoryTotal = categories.reduce((sum, [, value]) => sum + value, 0);

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Money</h1>
          <p className="page-subtitle">Every cedi in and out, tied back to the room.</p>
        </div>
        <div className="page-actions">
          <div className="seg" role="group" aria-label="Filter">
            <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'in' ? 'on' : ''} onClick={() => setFilter('in')}>In</button>
            <button className={filter === 'out' ? 'on' : ''} onClick={() => setFilter('out')}>Out</button>
          </div>
          <button className="btn" onClick={() => window.print()}><Icon name="download" size={17} /> Statement</button>
          <button className="btn" onClick={() => openAdd('expense')}>Add expense</button>
          <button className="btn g" onClick={() => openAdd('payment')}><Icon name="plus" size={17} strokeWidth={2.4} /> Log payment</button>
        </div>
      </header>

      <section className="money-top">
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="mu">Net so far</span>
            <span className="d n" style={{ fontSize: 'clamp(52px, 6vw, 84px)', fontWeight: 800, lineHeight: 1, color: net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
              {net >= 0 ? '+' : '−'}{cedi(Math.abs(net))}
            </span>
          </div>
          <div className="bar" style={{ height: 14 }} role="img" aria-label={`Rent covers ${cover} percent of costs`}>
            <i style={{ width: `${Math.min(100, cover)}%`, background: 'var(--mint)' }} />
          </div>
          <div className="site-money-row">
            <span><span className="mu">Money in</span><b className="d n" style={{ color: 'var(--mint)' }}>{cedi(totalIn)}</b></span>
            <span><span className="mu">Money out</span><b className="d n">{cedi(totalOut)}</b></span>
            <span><span className="mu">Rent covers</span><b className="d n">{cover}%</b></span>
            <span><span className="mu">Outstanding</span><b className="d n" style={{ color: data.rentOutstanding > 0 ? 'var(--coral)' : undefined }}>{cedi(data.rentOutstanding)}</b></span>
          </div>
        </div>

        <div className="bone" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={{ fontWeight: 600, color: 'var(--bmu)' }}>Next rent due</span>
          <span className="d" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>
            {nextDue ? fmtDate(nextDue.dueDate) : 'Nothing due'}
          </span>
          <span style={{ color: 'var(--bmu)' }}>
            {nextDue && nextDueRoom
              ? `${cedi(nextDue.amountDue)} from ${nextDueRoom.tenantName}, ${nextDueRoom.unit.name}. ${relativeDays(nextDue.dueDate, data.today)} to go.`
              : 'No future rent is on the schedule yet.'}
          </span>
          <div className="row wrap" style={{ marginTop: 'auto' }}>
            <Link to="/reminders" className="btn k">Remind tenant</Link>
            <button className="btn o" onClick={() => openAdd('payment')}>Log payment</button>
          </div>
        </div>
      </section>

      <section className="money-bottom">
        <div className="card" style={{ padding: 28 }}>
          <div className="section-head">
            <h2>Activity</h2>
            <span className="mu small">Newest first</span>
          </div>
          {activity.length === 0 ? (
            <div className="empty-card">
              <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="card" size={26} /></span>
              <b className="d" style={{ fontSize: 24, color: 'var(--tx)' }}>No money logged yet</b>
              <span>Log a rent payment or an expense and it will show up here.</span>
              <div className="row wrap">
                <button className="btn g" onClick={() => openAdd('payment')}>Log payment</button>
                <button className="btn" onClick={() => openAdd('expense')}>Add expense</button>
              </div>
            </div>
          ) : (
            <div>
              {activity.map((row, index) => (
                <Link
                  key={row.id}
                  to={row.to as never}
                  params={row.params as never}
                  className="pay-row"
                  style={{ borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}
                >
                  <span
                    className="ico sm"
                    style={{
                      background: row.kind === 'in' ? 'var(--mint)' : row.kind === 'out' ? 'var(--s2)' : 'var(--coral)',
                      color: row.kind === 'out' ? 'var(--tx)' : 'var(--ink)',
                    }}
                  >
                    <Icon name={row.kind === 'out' ? 'document' : row.kind === 'due' ? 'clock' : 'check'} size={17} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <b>{row.title}</b>
                    <span className="mu small">{row.subtitle}</span>
                  </span>
                  <span style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
                    <b className="n" style={{ color: row.kind === 'in' ? 'var(--mint)' : row.kind === 'due' ? 'var(--coral)' : undefined }}>
                      {row.kind === 'in' ? '+' : row.kind === 'due' ? '' : '−'}{cedi(row.amount)}
                    </b>
                    <span className="mu small">{fmtDayMonth(row.date)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="column-stack">
          <div className="card" style={{ padding: 28 }}>
            <div className="section-head"><h2>Where it went</h2><span className="mu small">All time</span></div>
            {categories.length === 0 ? (
              <p className="mu">No expenses yet.</p>
            ) : (
              <div className="stack-sm">
                {categories.map(([category, amount]) => (
                  <div key={category} className="stack-sm" style={{ gap: 6 }}>
                    <div className="row-between"><span>{CATEGORY_LABEL[category] ?? category}</span><b className="n">{cedi(amount)}</b></div>
                    <div className="bar" style={{ height: 9 }}>
                      <i style={{ width: `${categoryTotal ? (amount / categoryTotal) * 100 : 0}%`, background: category === 'repair' ? 'var(--coral)' : category === 'furnishing' ? 'var(--gold)' : 'var(--sky)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bone" style={{ padding: 28 }}>
            <span className="eyebrow">This month</span>
            <div className="row-between" style={{ marginTop: 12 }}>
              <span style={{ color: 'var(--bmu)' }}>Rent collected</span>
              <b className="d n" style={{ fontSize: 28 }}>{cedi(data.paidThisMonth)}</b>
            </div>
            <div className="row-between" style={{ marginTop: 8 }}>
              <span style={{ color: 'var(--bmu)' }}>Spent</span>
              <b className="d n" style={{ fontSize: 28 }}>{cedi(data.spentThisMonth)}</b>
            </div>
            <div className="row-between" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #d9d2c0' }}>
              <span style={{ color: 'var(--bmu)' }}>Left</span>
              <b className="d n" style={{ fontSize: 34, color: data.paidThisMonth - data.spentThisMonth >= 0 ? '#0f6b4a' : '#a52d1f' }}>
                {cedi(data.paidThisMonth - data.spentThisMonth)}
              </b>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
