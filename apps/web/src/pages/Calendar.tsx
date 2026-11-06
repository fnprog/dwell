import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { addMonths, monthMatrix, useDwellData, type DiaryEvent } from '../data/derive';
import { dueIn, fmtDate, fmtDayMonth, fmtMonthYear } from '../data/format';
import { Icon } from '../components/Icon';
import { Loading } from '../components/ui';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TONES: Record<string, { bg: string; fg: string }> = {
  gold: { bg: '#3b2b07', fg: '#ffcb5c' },
  mint: { bg: '#12372a', fg: '#62e6b1' },
  coral: { bg: '#3f1b16', fg: '#ff9c8c' },
  sky: { bg: '#17283b', fg: '#8cbfff' },
  ink: { bg: 'var(--s3)', fg: 'var(--tx)' },
  mu: { bg: 'var(--s3)', fg: 'var(--mu)' },
};

export function CalendarPage() {
  const data = useDwellData();
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'agenda'>('month');

  if (!data) return <Loading />;
  const cursorDate = cursor ?? data.today;
  const selectedDate = selected ?? data.today;
  const cells = monthMatrix(cursorDate);
  const byDate = new Map<string, DiaryEvent[]>();
  for (const event of data.events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  const selectedEvents = byDate.get(selectedDate) ?? [];
  const monthEvents = data.events.filter((event) => event.date.slice(0, 7) === cursorDate.slice(0, 7));

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Calendar</h1>
          <p className="page-subtitle">Rent days, move-ins, and the dates that creep up.</p>
        </div>
        <div className="page-actions">
          <div className="seg" role="group" aria-label="View">
            <button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button>
            <button className={view === 'agenda' ? 'on' : ''} onClick={() => setView('agenda')}>Agenda</button>
          </div>
          <Link to="/reminders" className="btn g"><Icon name="bell" size={17} /> Reminders</Link>
        </div>
      </header>

      <section className="calendar-wrap">
        <div className="card calendar-card">
          <div className="cal-head">
            <div className="row" style={{ gap: 8 }}>
              <button className="ib" aria-label="Previous month" onClick={() => setCursor(addMonths(cursorDate, -1))}>
                <Icon name="chevronLeft" size={18} />
              </button>
              <button className="ib" aria-label="Next month" onClick={() => setCursor(addMonths(cursorDate, 1))}>
                <Icon name="chevronRight" size={18} />
              </button>
              <h2 className="d" style={{ fontSize: 28, fontWeight: 800, marginLeft: 8 }}>{fmtMonthYear(cursorDate)}</h2>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="chip" onClick={() => { setCursor(data.today); setSelected(data.today); }}>Today</button>
              <span className="pill">{monthEvents.length} events</span>
            </div>
          </div>

          {view === 'month' ? (
            <div className="cal-grid" style={{ marginTop: 16 }}>
              {DOW.map((day, index) => (
                <div className="cal-dow" key={`${day}-${index}`}>{day}</div>
              ))}
              {cells.map((cell) => {
                const dayEvents = byDate.get(cell.date) ?? [];
                const { d } = { d: Number(cell.date.slice(8, 10)) };
                return (
                  <button
                    key={cell.date}
                    className={`cell ${cell.inMonth ? '' : 'out'} ${cell.isToday ? 'today' : ''} ${selectedDate === cell.date ? 'sel' : ''}`}
                    onClick={() => setSelected(cell.date)}
                    aria-label={`${fmtDate(cell.date)}, ${dayEvents.length} events`}
                  >
                    <span className="dn">{d}</span>
                    {dayEvents.slice(0, 2).map((event) => (
                      <span
                        key={event.id}
                        className="evc"
                        style={{ background: TONES[event.tone]?.bg, color: TONES[event.tone]?.fg }}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 2 && <span className="mu" style={{ fontSize: 10, paddingLeft: 6 }}>+{dayEvents.length - 2}</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="stack-sm" style={{ marginTop: 16, gap: 8 }}>
              {monthEvents.length === 0 && <p className="mu">Nothing this month.</p>}
              {monthEvents.map((event) => (
                <Link
                  key={event.id}
                  to={(event.to ?? '/calendar') as never}
                  params={event.params as never}
                  className="row-between"
                  style={{ padding: '14px 12px', borderRadius: 18, background: 'var(--s2)' }}
                >
                  <span className="row">
                    <span className="ico sm" style={{ background: TONES[event.tone]?.bg, color: TONES[event.tone]?.fg }}>
                      <Icon name="calendar" size={17} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column' }}>
                      <b>{event.title}</b>
                      <span className="mu small">{event.subtitle}</span>
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <b>{fmtDayMonth(event.date)}</b>
                    <span className="mu small" style={{ display: 'block' }}>{dueIn(event.date, data.today)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bone calendar-side">
          <div className="row-between">
            <span className="d" style={{ fontSize: 30, fontWeight: 800 }}>{fmtDayMonth(selectedDate)}</span>
            <span className="pill" style={{ background: 'rgba(26,24,19,.1)' }}>{selectedEvents.length} events</span>
          </div>
          <p style={{ color: 'var(--bmu)' }}>{fmtDate(selectedDate)}</p>
          {selectedEvents.length === 0 ? (
            <div className="empty-day">
              <span className="d" style={{ fontSize: 26, fontWeight: 800 }}>Nothing on this day.</span>
              <p style={{ color: 'var(--bmu)' }}>A quiet day is a good day. Pick another date, or set a reminder.</p>
              <Link to="/reminders" className="btn k">Set a reminder</Link>
            </div>
          ) : (
            <div className="stack-sm">
              {selectedEvents.map((event) => (
                <Link
                  key={event.id}
                  to={(event.to ?? '/calendar') as never}
                  params={event.params as never}
                  className="ev"
                  style={{ background: '#E9E3D3' }}
                >
                  <span className="ico" style={{ background: TONES[event.tone]?.bg, color: TONES[event.tone]?.fg }}>
                    <Icon name="calendar" size={21} />
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <b>{event.title}</b>
                    <span style={{ fontSize: 13, color: 'var(--bmu)' }}>{event.subtitle}</span>
                  </span>
                  <Icon name="chevronRight" size={18} style={{ color: 'var(--bmu)', alignSelf: 'center' }} />
                </Link>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto' }}>
            <span className="eyebrow" style={{ color: 'var(--bmu)' }}>Later in {MONTHS[(Number(cursorDate.slice(5, 7)) - 1)]}</span>
            <div className="stack-sm" style={{ marginTop: 10 }}>
              {monthEvents.slice(0, 3).map((event) => (
                <Link key={`side-${event.id}`} to={(event.to ?? '/calendar') as never} params={event.params as never} className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid #d9d2c0' }}>
                  <span style={{ color: 'var(--bmu)' }}>{fmtDayMonth(event.date)}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right' }}>{event.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
