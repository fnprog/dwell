import { useEffect, useState, type FormEvent } from 'react';
import { addDays } from '@subrent/shared';
import { fmtDate, fmtDayMonth } from '../data/format';
import { useDwellData } from '../data/derive';
import { Icon } from '../components/Icon';
import { Loading } from '../components/ui';

interface Rule {
  id: string;
  title: string;
  when: string;
  channel: 'WhatsApp' | 'SMS' | 'Email';
  on: boolean;
}

const DEFAULT_RULES: Rule[] = [
  { id: 'rent', title: 'Rent is due', when: '3 days before', channel: 'WhatsApp', on: true },
  { id: 'ending', title: 'Tenancy is ending', when: '14 days before', channel: 'WhatsApp', on: true },
  { id: 'lease', title: 'Lease renewal decision', when: '90 days before', channel: 'Email', on: true },
  { id: 'vacant', title: 'Room is still empty', when: 'Every Monday', channel: 'SMS', on: false },
];

const KEY = 'dwell.reminders.v1';

export function RemindersPage() {
  const data = useDwellData();
  const [rules, setRules] = useState<Rule[]>(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      return saved ? (JSON.parse(saved) as Rule[]) : DEFAULT_RULES;
    } catch {
      return DEFAULT_RULES;
    }
  });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('14 days before');
  const [channel, setChannel] = useState<Rule['channel']>('WhatsApp');

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(rules));
    } catch {
      /* private mode */
    }
  }, [rules]);

  if (!data) return <Loading />;

  const active = rules.filter((rule) => rule.on).length;
  const tenant = data.primaryTenant;
  const room = data.primaryRoom;
  const message = tenant && room
    ? `Hi ${tenant.name.split(' ')[0]}, your rent of ${(room.current?.rentAmount ?? 0) / 100} GHS for ${room.unit.name} is due soon. Please send it by the due date. Thank you.`
    : 'Hi, a quick reminder about your rent. Thank you.';

  function addRule(event: FormEvent) {
    event.preventDefault();
    setRules((current) => [{ id: `custom-${Date.now()}`, title, when, channel, on: true }, ...current]);
    setTitle('');
    setAdding(false);
  }

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Reminders</h1>
          <p className="page-subtitle">{active} active · queued messages that send themselves.</p>
        </div>
        <div className="page-actions">
          <button className="btn g" onClick={() => setAdding((open) => !open)}>
            <Icon name="plus" size={18} strokeWidth={2.4} /> {adding ? 'Close' : 'New reminder'}
          </button>
        </div>
      </header>

      <section className="reminder-hero">
        <div className="bone" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="eyebrow">Next message</span>
          <span className="d" style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.05 }}>
            {data.events[0] ? fmtDate(data.events[0].date) : 'Nothing queued'}
          </span>
          <span style={{ color: 'var(--bmu)' }}>
            {data.events[0]
              ? `${data.events[0].title} · ${data.events[0].subtitle}`
              : 'Add a tenancy and Dwell will queue the rent and move-out reminders.'}
          </span>
          <div className="wa-preview">
            <span className="wa-label">WhatsApp preview</span>
            <span>{message}</span>
          </div>
          <div className="row wrap" style={{ marginTop: 'auto' }}>
            <a className="btn k" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              Open WhatsApp
            </a>
            <button className="btn o" onClick={() => setAdding(true)}>Edit message</button>
          </div>
        </div>

        <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="eyebrow">Queued</span>
          {data.events.slice(0, 5).map((event, index) => (
            <div key={event.id} className="reminder-queue" style={{ borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}>
              <span className="ico sm" style={{ background: index === 0 ? 'var(--gold)' : 'var(--s2)', color: index === 0 ? 'var(--ink)' : 'var(--tx)' }}>
                <Icon name={index === 0 ? 'bell' : 'calendar'} size={17} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <b>{event.title}</b>
                <span className="mu small">{event.subtitle}</span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <b>{fmtDayMonth(event.date)}</b>
                <span className="mu small" style={{ display: 'block' }}>{fmtDate(addDays(event.date, -3))}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {adding && (
        <form className="card form" onSubmit={addRule}>
          <div className="section-head"><h2 className="section-title-sm">New reminder</h2></div>
          <label className="field"><span>What is it for?</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Ask Ama if she is staying" required /></label>
          <div className="two">
            <label className="field"><span>When</span>
              <select value={when} onChange={(event) => setWhen(event.target.value)}>
                <option>3 days before</option>
                <option>14 days before</option>
                <option>30 days before</option>
                <option>60 days before</option>
                <option>90 days before</option>
                <option>Every Monday</option>
              </select>
            </label>
            <label className="field"><span>Send by</span>
              <select value={channel} onChange={(event) => setChannel(event.target.value as Rule['channel'])}>
                <option>WhatsApp</option>
                <option>SMS</option>
                <option>Email</option>
              </select>
            </label>
          </div>
          <button className="btn g" style={{ alignSelf: 'flex-start' }}>Add reminder</button>
        </form>
      )}

      <section>
        <div className="section-head"><h2>Rules</h2><span className="pill">{rules.length}</span></div>
        <div className="card" style={{ padding: 8 }}>
          {rules.map((rule, index) => (
            <div key={rule.id} className="reminder-rule" style={{ borderTop: index === 0 ? 0 : '1px solid var(--ln)' }}>
              <span className="ico sm" style={{ background: rule.on ? 'var(--gold)' : 'var(--s2)', color: rule.on ? 'var(--ink)' : 'var(--mu)' }}>
                <Icon name={rule.channel === 'WhatsApp' ? 'message' : rule.channel === 'Email' ? 'document' : 'bell'} size={17} />
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <b>{rule.title}</b>
                <span className="mu small">{rule.when} · {rule.channel}</span>
              </span>
              <button
                className={`tg ${rule.on ? 'on' : ''}`}
                role="switch"
                aria-checked={rule.on}
                aria-label={`${rule.title} reminder`}
                onClick={() => setRules((current) => current.map((item) => item.id === rule.id ? { ...item, on: !item.on } : item))}
              />
              <button
                className="btn sm ghost"
                aria-label={`Delete ${rule.title}`}
                onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
