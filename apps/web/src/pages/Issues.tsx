import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { cedi, fmtDate, plural } from '../data/format';
import { useDwellData } from '../data/derive';
import { Icon } from '../components/Icon';
import { useOverlay } from '../components/overlays';
import { Loading } from '../components/ui';

export function IssuesPage() {
  const data = useDwellData();
  const [tab, setTab] = useState<'open' | 'fixed' | 'all'>('open');
  const { openAdd } = useOverlay();

  const issues = useMemo(() => {
    if (!data) return [];
    return data.items
      .filter((item) => item.condition === 'needs_repair' || item.condition === 'broken')
      .map((item) => {
        const room = data.rooms.find((r) => r.unit.id === item.unitId);
        const repairs = data.repairs.filter((repair) => repair.itemId === item.id).sort((a, b) => b.repairedOn.localeCompare(a.repairedOn));
        return { item, room, repairs };
      });
  }, [data]);

  if (!data) return <Loading />;
  const fixed = data.repairs.slice().sort((a, b) => b.repairedOn.localeCompare(a.repairedOn));
  const broken = issues.filter((issue) => issue.item.condition === 'broken').length;

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Issues</h1>
          <p className="page-subtitle">{plural(issues.length, 'thing')} needs a look · {plural(fixed.length, 'repair')} on record.</p>
        </div>
        <div className="page-actions">
          <button className="btn g" onClick={() => openAdd('issue')}>
            <Icon name="plus" size={18} strokeWidth={2.4} /> Report an issue
          </button>
        </div>
      </header>

      <section className="issue-summary">
        <div className="card issue-stat">
          <span className="ico lg" style={{ background: 'var(--coral)' }}><Icon name="wrench" size={24} /></span>
          <span><b className="d n">{issues.length}</b><span className="mu">Open</span></span>
        </div>
        <div className="card issue-stat">
          <span className="ico lg" style={{ background: 'var(--gold)' }}><Icon name="clock" size={24} /></span>
          <span><b className="d n">{broken}</b><span className="mu">Broken</span></span>
        </div>
        <div className="card issue-stat">
          <span className="ico lg" style={{ background: 'var(--mint)' }}><Icon name="check" size={24} /></span>
          <span><b className="d n">{fixed.length}</b><span className="mu">Fixed</span></span>
        </div>
      </section>

      <div className="filter-row">
        <div className="seg" role="group" aria-label="Issue filter">
          <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Open</button>
          <button className={tab === 'fixed' ? 'on' : ''} onClick={() => setTab('fixed')}>Fixed</button>
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All</button>
        </div>
      </div>

      {tab !== 'fixed' && (
        <section>
          <div className="section-head"><h2>Open</h2><span className="pill bad">{issues.length}</span></div>
          {issues.length === 0 ? (
            <div className="empty-card">
              <span className="ico lg" style={{ background: 'var(--mint)' }}><Icon name="check" size={28} /></span>
              <b className="d" style={{ fontSize: 26, color: 'var(--tx)' }}>Nothing broken</b>
              <span>Every item in your inventory is in good shape. Report an issue when something changes.</span>
              <button className="btn" onClick={() => openAdd('issue')}>Report an issue</button>
            </div>
          ) : (
            <div className="issue-grid">
              {issues.map(({ item, room }) => (
                <article key={item.id} className="card issue-card">
                  <div className="row-between">
                    <span className={`pill ${item.condition === 'broken' ? 'bad' : 'warn'}`}>{item.condition === 'broken' ? 'Broken' : 'Needs repair'}</span>
                    <span className="mu small">{room ? room.site.name : 'Room'}</span>
                  </div>
                  <h3 className="d" style={{ fontSize: 26, fontWeight: 800, marginTop: 12 }}>{item.name}</h3>
                  <p className="mu small">{room ? `${room.unit.name} · ${room.tenantName}` : 'Room not found'}</p>
                  <div className="row-between" style={{ marginTop: 'auto', paddingTop: 16 }}>
                    <span className="mu small">Added {fmtDate(item.createdAt.slice(0, 10))}</span>
                    {room && (
                      <Link to="/units/$unitId" params={{ unitId: room.unit.id }} className="btn sm">Open room</Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {tab !== 'open' && (
        <section>
          <div className="section-head"><h2>Fixed</h2><span className="pill ok">{fixed.length}</span></div>
          {fixed.length === 0 ? (
            <p className="mu">No repairs logged yet.</p>
          ) : (
            <div className="card" style={{ padding: 8 }}>
              {fixed.map((repair, index) => {
                const item = data.items.find((candidate) => candidate.id === repair.itemId);
                const room = item ? data.rooms.find((r) => r.unit.id === item.unitId) : undefined;
                return (
                  <div key={repair.id} className="row-between" style={{ padding: '14px 16px', borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}>
                    <span className="row">
                      <span className="ico sm" style={{ background: 'var(--mint)' }}><Icon name="check" size={17} /></span>
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <b>{item?.name ?? 'Item repaired'}</b>
                        <span className="mu small">{repair.description || 'Repair'} · {room?.unit.name ?? 'Room'}</span>
                      </span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <b className="n">{cedi(repair.cost)}</b>
                      <span className="mu small" style={{ display: 'block' }}>{fmtDate(repair.repairedOn)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
