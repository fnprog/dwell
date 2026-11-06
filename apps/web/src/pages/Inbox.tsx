import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useDwellData } from '../data/derive';
import { Icon } from '../components/Icon';
import { Loading } from '../components/ui';

export function InboxPage() {
  const data = useDwellData();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'action' | 'updates'>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [read, setRead] = useState<Set<string>>(new Set());

  if (!data) return <Loading />;
  const items = data.inbox.filter((item) => !dismissed.has(item.id));
  const shown = items.filter((item) => {
    if (tab === 'action') return item.tone === 'gold' || item.tone === 'coral';
    if (tab === 'updates') return item.tone === 'mint' || item.tone === 'sky';
    return true;
  });
  const unread = items.filter((item) => !read.has(item.id)).length;

  const markAll = () => setRead(new Set(items.map((item) => item.id)));

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Inbox</h1>
          <p className="page-subtitle">{unread} unread · the things Dwell noticed so you do not have to.</p>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={markAll} disabled={unread === 0}>
            <Icon name="check" size={17} /> Mark all read
          </button>
          <Link to="/reminders" className="btn g"><Icon name="bell" size={17} /> Reminders</Link>
        </div>
      </header>

      <div className="filter-row">
        <div className="seg" role="group" aria-label="Inbox filter">
          <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All</button>
          <button className={tab === 'action' ? 'on' : ''} onClick={() => setTab('action')}>Needs action</button>
          <button className={tab === 'updates' ? 'on' : ''} onClick={() => setTab('updates')}>Updates</button>
        </div>
        <span className="pill">{items.length} total</span>
      </div>

      {shown.length === 0 ? (
        <div className="empty-card">
          <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="inbox" size={28} /></span>
          <b className="d" style={{ fontSize: 26, color: 'var(--tx)' }}>All clear</b>
          <span>No alerts match this view. Dwell will pipe up when a room empties, rent is late, or a lease creeps up.</span>
        </div>
      ) : (
        <section className="inbox-list" aria-label="Alerts">
          {shown.map((item, index) => {
            const isRead = read.has(item.id);
            const bg = item.tone === 'gold' ? 'var(--gold)' : item.tone === 'coral' ? 'var(--coral)' : item.tone === 'mint' ? 'var(--mint)' : 'var(--sky)';
            return (
              <article key={item.id} className={`inbox-item ${isRead ? 'read' : ''}`} style={{ animationDelay: `${index * 0.04}s` }}>
                {!isRead && <span className="unread-dot" />}
                <span className="ico lg" style={{ background: bg }}><Icon name={item.tone === 'coral' ? 'issues' : item.tone === 'mint' ? 'check' : item.tone === 'sky' ? 'calendar' : 'bell'} size={23} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-between" style={{ alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{item.title}</h2>
                      <p className="mu small" style={{ marginTop: 2 }}>{item.body}</p>
                    </div>
                    <span className="mu small" style={{ whiteSpace: 'nowrap' }}>now</span>
                  </div>
                  <div className="row wrap" style={{ marginTop: 14, gap: 8 }}>
                    <button
                      className="btn sm g"
                      onClick={() => {
                        setRead((current) => new Set(current).add(item.id));
                        void navigate({ to: item.to as never, params: item.params as never });
                      }}
                    >
                      Open <Icon name="arrowRight" size={15} />
                    </button>
                    <button
                      className="btn sm"
                      onClick={() => setRead((current) => new Set(current).add(item.id))}
                    >
                      {isRead ? 'Read' : 'Mark read'}
                    </button>
                    <button
                      className="btn sm ghost"
                      onClick={() => setDismissed((current) => new Set(current).add(item.id))}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
