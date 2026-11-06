import { Link } from '@tanstack/react-router';
import { parseDate } from '@subrent/shared';
import { cedi, dueIn, fmtDate, fmtDayMonth, initials, num, plural } from '../data/format';
import { rentSeries, useDwellData, type DiaryEvent, type SiteInfo } from '../data/derive';
import { useOverlay } from '../components/overlays';
import { Icon, Logo, ProgressRing, StampArt } from '../components/Icon';
import { MapCard } from '../components/MapArt';
import { MobileGreeting, UtilityBar, useMobileGreetingName } from '../components/Shell';
import { Loading } from '../components/ui';

export function Dashboard() {
  const data = useDwellData();
  const name = useMobileGreetingName();
  const { openAdd } = useOverlay();

  if (!data) return <Loading />;

  if (data.sites.length === 0) return <FirstDay name={name} />;

  const site = data.primarySite;
  const room = data.primaryRoom;
  const tenant = data.primaryTenant;
  const net = data.netMonthly;
  const series = rentSeries(data);
  const thisMonth = series[0]!;
  const netNow = thisMonth.rent - thisMonth.cost || net;
  const costNow = thisMonth.cost || data.costMonthly;
  const rentNow = thisMonth.rent || data.rentMonthly;
  const gapNow = Math.max(0, costNow - rentNow);
  const upCount = data.events.length;
  const milestone = milestones(data);
  const full = site ? site.vacant === 0 && site.total > 0 : false;

  return (
    <>
      <h1 className="sr-only">Home</h1>
      <div className="desktop-only-block">
        <UtilityBar />
      </div>
      <div className="mobile-only-block">
        <MobileGreeting name={name} />
      </div>

      <section className="hero">
        <div className="hero-copy">
          <div className="desktop-only-block">
            <h1 className="hero-h1">
              <span className="rise" style={{ animationDelay: '.05s' }}>
                Hey <span style={{ color: 'var(--tx)' }}>{name},</span>
              </span>{' '}
              {site && (
                <span className="rise" style={{ animationDelay: '.14s' }}>
                  <Link to="/sites/$siteId" params={{ siteId: site.site.id }} className="ic">
                    <Icon name="building" size={30} strokeWidth={2} /> {site.site.name}
                  </Link>
                </span>
              )}{' '}
              <span className="rise" style={{ animationDelay: '.22s' }}>is</span>{' '}
              <span className="rise" style={{ animationDelay: '.3s' }}>
                <span className={`ic ${full ? 'ok' : 'warn'}`}>
                  <Icon name={full ? 'check' : 'room'} size={26} strokeWidth={2.6} />
                  {full ? 'full' : `${plural(site?.vacant ?? 0, 'room')} empty`}
                </span>
              </span>{' '}
              <span className="rise" style={{ animationDelay: '.38s' }}>{net >= 0 ? 'and making' : 'and losing'}</span>{' '}
              <span className="rise n" style={{ animationDelay: '.46s' }}>
                <Link to="/money" className={`ic ${net >= 0 ? 'ok' : 'bad'}`}>
                  {net >= 0 ? '+' : '−'}{cedi(Math.abs(net)).replace(/^GHS /, 'GHS ')}
                </Link>
              </span>{' '}
              <span className="rise" style={{ animationDelay: '.54s' }}>a month.</span>
              {tenant && (
                <>
                  {' '}
                  <span className="rise" style={{ animationDelay: '.64s' }}>
                    <Link to="/tenants/$tenantId" params={{ tenantId: tenant.id }} className="ic">
                      <span className="av">{initials(tenant.name).slice(0, 1)}</span>
                      {tenant.name.split(' ')[0]!.toLowerCase()}
                    </Link>
                  </span>{' '}
                  <span className="rise" style={{ animationDelay: '.72s' }}>leaves in</span>{' '}
                  <span className="rise n" style={{ animationDelay: '.8s' }}>
                    <span className="ic warn">{room?.daysLeft ?? 0} days</span>
                  </span>
                  <span className="rise" style={{ animationDelay: '.86s' }}>, and</span>
                </>
              )}{' '}
              <span className="rise" style={{ animationDelay: '.94s' }}>
                <Link to="/reminders" className="ic">
                  <Icon name="bell" size={26} strokeWidth={2} /> {plural(upCount, 'reminder')}
                </Link>
              </span>{' '}
              <span className="rise" style={{ animationDelay: '1s' }}>is queued.</span>
            </h1>
          </div>

          <div className="mobile-only-block">
            <h1 className="d mobile-hero">
              You are{' '}
              <span style={{ color: net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
                {net >= 0 ? '+' : '−'}{cedi(Math.abs(net))}
              </span>{' '}
              {net >= 0 ? 'up' : 'down'} each month.
            </h1>
            <p className="mu">
              {room ? `${room.unit.name} earns ${cedi(room.monthlyRent)} and costs ${cedi(room.monthlyCost)}.` : 'Add your rooms to see how they perform.'}
            </p>
          </div>

          <div className="quick-actions" aria-label="Quick actions">
            <button className="qa" onClick={() => openAdd('payment')}>
              <span className="qc"><Icon name="card" size={24} /></span>
              Log payment
            </button>
            <button className="qa" onClick={() => openAdd('tenant')}>
              <span className="qc"><Icon name="peopleAdd" size={24} /></span>
              Add tenant
            </button>
            <Link to="/calendar" className="qa">
              <span className="qc"><Icon name="calendarPlus" size={24} /></span>
              Book next
            </Link>
            <button className="qa" onClick={() => openAdd('expense')}>
              <span className="qc"><Icon name="document" size={24} /></span>
              Add expense
            </button>
          </div>
        </div>

        {site && room && tenant && (
          <div className="hero-cards desktop-only-block" aria-label="Your place right now">
            <Link
              to="/sites/$siteId"
              params={{ siteId: site.site.id }}
              className="hero-card hero-card-site tilt"
              aria-label={`${site.site.name}, ${full ? 'full house' : `${site.vacant} empty`}`}
            >
              <span className="hero-card-head">
                <span className="d">{site.site.name}</span>
                <span className="hero-card-kicker">{full ? 'Full house' : `${plural(site.vacant, 'room')} empty`}</span>
              </span>
              <HeroBuilding />
            </Link>
            <Link
              to="/units/$unitId"
              params={{ unitId: room.unit.id }}
              className="hero-card hero-card-room tilt"
              aria-label={`${room.unit.name}, let to ${tenant.name}`}
            >
              <span className="hero-card-kicker">Room</span>
              <span className="hero-room-number d n">{room.unit.name.replace(/^\D+/g, '') || room.unit.name.slice(0, 2)}</span>
              <span className="hero-card-foot">
                <b>Let to {tenant.name.split(' ')[0]!.toLowerCase()}</b>
                <span>{cedi(room.current?.rentAmount ?? 0)} every {room.current?.periodMonths ?? 1} months</span>
              </span>
            </Link>
            <Link
              to="/tenants/$tenantId"
              params={{ tenantId: tenant.id }}
              className="hero-card hero-card-person tilt"
              aria-label={`${tenant.name}, ${room.daysLeft ?? 0} days left`}
            >
              <span className="d hero-person-name">{tenant.name.split(' ')[0]!.toLowerCase()}</span>
              <span className="hero-ring">
                <ProgressRing size={112} pct={Math.max(0.02, Math.min(1, ((room.daysLeft ?? 0) / 120)))} />
                <span className="hero-ring-label d n">
                  {room.daysLeft ?? 0}
                  <span>days left</span>
                </span>
              </span>
              <span className="mu" style={{ fontSize: 12, fontWeight: 600 }}>Until {fmtDate(room.endDate)}</span>
            </Link>
          </div>
        )}
      </section>

      <section className="card pulse-card" aria-label="Portfolio pulse">
        <div className="pulse-metric">
          <span className="d n pulse-value">{Math.round((data.summary.occupancy.rate ?? 0) * 100)}%</span>
          <span className="mu">of rooms let</span>
          <span className="pulse-detail">{data.summary.occupancy.occupied} of {data.summary.occupancy.total} rooms let</span>
        </div>
        <div className="pulse-metric">
          <span className="d n pulse-value" style={{ color: data.summary.occupancy.vacant > 0 ? 'var(--gold)' : 'var(--mint)' }}>
            {data.summary.occupancy.vacant}
          </span>
          <span className="mu">{plural(data.summary.occupancy.vacant, 'vacant room')}</span>
          <span className="pulse-detail">
            {data.summary.vacantUnits[0]
              ? `Vacant ${plural(data.summary.vacantUnits[0].vacantDays, 'day')}`
              : 'Every room has someone in it'}
          </span>
        </div>
        <div className="pulse-metric">
          <span className="d n pulse-value" style={{ color: net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>{net >= 0 ? '+' : '−'}{cedi(Math.abs(net))}</span>
          <span className="mu">net each month</span>
          <span className="pulse-detail">{cedi(data.rentMonthly)} in · {cedi(data.costMonthly)} out</span>
        </div>
        <div className="pulse-metric">
          <span className="d n pulse-value">{data.events.length}</span>
          <span className="mu">{plural(data.events.length, 'date')} ahead</span>
          <span className="pulse-detail">{data.events[0] ? `Next ${fmtDayMonth(data.events[0].date)}` : 'Nothing queued'}</span>
        </div>
      </section>

      <section className="card rooms-pulse">
        <div className="section-head">
          <h2>Rooms</h2>
          <Link to="/sites" className="pill">See portfolio</Link>
        </div>
        {data.rooms.length === 0 ? (
          <p className="mu">No rooms yet. Add a site and lease to start.</p>
        ) : (
          <div className="rooms-pulse-grid">
            {data.rooms.map((entry) => (
              <Link
                key={entry.unit.id}
                to="/units/$unitId"
                params={{ unitId: entry.unit.id }}
                className="room-pulse"
              >
                <span className="row-between" style={{ width: '100%' }}>
                  <b>{entry.site.name} · {entry.unit.name}</b>
                  <span className={`pill ${entry.state === 'occupied' ? 'ok' : entry.state === 'vacant' ? 'warn' : ''}`}>
                    {entry.state === 'occupied' ? 'Let' : entry.state === 'vacant' ? 'Empty' : entry.state === 'off_market' ? 'Off' : 'Soon'}
                  </span>
                </span>
                <span className="mu small">
                  {entry.state === 'occupied'
                    ? `${entry.tenantName} · ${cedi(entry.monthlyRent)} a month`
                    : entry.state === 'vacant'
                      ? `${plural(entry.vacantDays, 'day')} empty · ${cedi(entry.monthlyCost)} a month to hold`
                      : 'Not lettable right now'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="dash-split">
        <div className="card chart-card">
          <div className="section-head">
            <h2>Rent against cost</h2>
            <div className="row" style={{ gap: 8 }}>
              <button className="chip on" type="button">Per month</button>
              <Link to="/money" className="chip" style={{ display: 'inline-flex', alignItems: 'center' }}>Whole lease</Link>
            </div>
          </div>

          <div className="chart-desktop desktop-only-block">
            <RentBubbles cost={costNow} rent={rentNow} gap={gapNow} />
            <div className="stack-sm" style={{ gap: 14, marginTop: 6 }}>
              {series.map((row, index) => {
                const max = Math.max(row.rent, row.cost, 1);
                return (
                  <div className="chart-row" key={row.start}>
                    <span className="chart-label n">{row.label}</span>
                    <div className="meter">
                      <i
                        className="gx"
                        style={{ width: `${Math.max(4, (row.rent / max) * 100)}%`, background: 'var(--mint)', animationDelay: `${index * 0.06}s` }}
                      />
                      <i
                        className="gx"
                        style={{ width: `${Math.max(0, ((row.cost - row.rent) / max) * 100)}%`, background: 'var(--coral)', animationDelay: `${index * 0.06 + 0.1}s` }}
                      />
                    </div>
                    <span className="chart-net n" style={{ color: row.net >= 0 ? 'var(--mint)' : 'var(--coral)' }}>
                      {row.net >= 0 ? '+' : '−'}{cedi(Math.abs(row.net)).replace('GHS ', '')}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="mu" style={{ maxWidth: 560, marginTop: -6 }}>
              {full ? 'Every room is let. ' : `${plural(site?.vacant ?? 0, 'room')} still empty. `}
              Green is rent in; red is what the lease still costs.
            </p>
          </div>

          <div className="chart-mobile mobile-only-block">
            <div className="months">
              {series.map((row, index) => {
                const pct = row.cost > 0 ? Math.min(100, Math.round((row.rent / row.cost) * 100)) : row.rent > 0 ? 100 : 0;
                return (
                  <div className="month" key={row.start}>
                    <div className={`month-track ${row.rent === 0 ? 'empty' : ''}`}>
                      {row.rent > 0 && <i style={{ height: `${pct}%` }} />}
                    </div>
                    <span className="mu" style={{ fontSize: 12 }}>{row.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="mu small">Green is rent in. Red is what the room still costs. Grey months have no tenant booked yet.</p>
          </div>
        </div>

        <div className="bone coming-up">
          <div className="section-head" style={{ padding: '0 8px', marginBottom: 4 }}>
            <h2>Coming up</h2>
            <Link to="/calendar" style={{ fontWeight: 600, fontSize: 13, color: 'var(--bmu)' }}>Calendar</Link>
          </div>
          {(data.events.length ? data.events.slice(0, 4) : []).map((event) => (
            <EventRow key={event.id} event={event} />
          ))}
          {data.events.length === 0 && (
            <p className="mu" style={{ padding: '12px 8px' }}>Nothing on the horizon yet. Add a tenancy or lease to fill the calendar.</p>
          )}
        </div>
      </section>

      <section className="dash-split bottom">
        <MapCard siteCount={data.sites.length} label={site?.site.name ?? 'Your rooms'} />
        <div className="card milestone-card">
          <div className="section-head">
            <h2>Milestones</h2>
            <span className="mu" style={{ fontWeight: 500 }}>{milestone.earned} of 4</span>
          </div>
          <div className="stamps">
            <Stamp label="First tenant" earned={milestone.firstTenant} tone="gold" icon="people" />
            <Stamp label="Full house" earned={milestone.full} tone="mint" icon="building" />
            <Stamp label="In the green" earned={milestone.green} tone="mint" icon="trend" note={milestone.green ? undefined : `Needs +${cedi(Math.abs(net))} a month`} />
            <Stamp label="Days full" earned={milestone.full} tone="gold" icon="clock" value={milestone.daysFull > 0 ? String(milestone.daysFull) : undefined} note={milestone.daysFull > 0 ? 'Day by day' : undefined} />
          </div>
        </div>
      </section>

      {data.summary.flags.length > 0 && (
        <section className="card">
          <div className="section-head">
            <h2>Needs attention</h2>
            <Link to="/inbox" className="pill bad">{plural(data.summary.flags.length, 'alert')}</Link>
          </div>
          <div className="stack-sm">
            {data.summary.flags.slice(0, 3).map((flag) => {
              const roomInfo = data.rooms.find((r) => r.unit.id === flag.unitId);
              return (
                <Link key={`${flag.kind}-${flag.unitId}`} to="/units/$unitId" params={{ unitId: flag.unitId }} className="row-link" style={{ padding: '12px 0', borderTop: '1px solid var(--ln)' }}>
                  <span style={{ display: 'flex', flexDirection: 'column' }}>
                    <b>{roomInfo ? (roomInfo.state === 'vacant' ? `${roomInfo.site.name}: an empty room needs a booking` : `${roomInfo.tenantName} in ${roomInfo.site.name} · ${roomInfo.unit.name}`) : 'A room needs a look'}</b>
                    <span className="mu small">
                      {flag.kind === 'tenancy_outlasts_lease'
                        ? 'This tenancy runs past your lease.'
                        : `${roomInfo?.site.name ?? 'This site'} still has lease left and an empty room.`}
                    </span>
                  </span>
                  <span className={`pill ${flag.kind === 'tenancy_outlasts_lease' ? 'bad' : 'warn'}`}>
                    {flag.kind === 'tenancy_outlasts_lease' ? 'Lease gap' : 'Empty'}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

function FirstDay({ name }: { name: string }) {
  const { openAdd } = useOverlay();
  return (
    <>
      <h1 className="sr-only">Home</h1>
      <div className="desktop-only-block"><UtilityBar /></div>
      <div className="mobile-only-block"><MobileGreeting name={name} /></div>
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-h1">
            <span className="rise">Hey <span style={{ color: 'var(--tx)' }}>{name},</span></span>{' '}
            <span className="rise" style={{ animationDelay: '.12s' }}>your first house is</span>{' '}
            <span className="rise" style={{ animationDelay: '.24s' }}><span className="ic gold"><Logo width={26} height={28} tone="ink" /> a blank page.</span></span>
          </h1>
          <p className="mu" style={{ maxWidth: 520 }}>
            A site is a house, hostel, or block. Add the lease you hold, the rooms you sublet, and the people in them.
          </p>
          <div className="quick-actions">
            <button className="qa" onClick={() => openAdd('site')}>
              <span className="qc"><Icon name="building" size={24} /></span>
              Add a site
            </button>
            <button className="qa" onClick={() => openAdd('tenant')}>
              <span className="qc"><Icon name="peopleAdd" size={24} /></span>
              Add tenant
            </button>
            <Link to="/calendar" className="qa">
              <span className="qc"><Icon name="calendarPlus" size={24} /></span>
              Book next
            </Link>
          </div>
        </div>
      </section>

      <section className="dash-split">
        <div className="bone" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <span className="ico lg" style={{ background: 'var(--gold)' }}><Icon name="building" size={28} /></span>
          <h2 className="d" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>Start with your first site</h2>
          <p style={{ color: 'var(--bmu)' }}>
            Then add the lease you hold on it, the rooms you sublet, and your tenants. Dwell will do the rent maths for you.
          </p>
          <div className="row wrap">
            <Link to="/sites" className="btn k">Add a site</Link>
            <Link to="/sites" className="btn o">See how it works</Link>
          </div>
        </div>
        <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <h2 className="d" style={{ fontSize: 28, fontWeight: 700 }}>What Dwell tracks</h2>
          {[
            ['building', 'Sites and leases', 'What you hold, what it costs, and when it ends.'],
            ['room', 'Rooms and tenants', 'Who is in, who is leaving, and what is empty.'],
            ['money', 'Rent against cost', 'Whether each room is making or losing money.'],
          ].map(([icon, title, body]) => (
            <div className="row" key={title}>
              <span className="ico" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name={icon as 'building'} size={22} /></span>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <b>{title}</b>
                <span className="mu small">{body}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function EventRow({ event }: { event: DiaryEvent }) {
  const { m, d } = parseDate(event.date);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]!;
  const bg =
    event.tone === 'gold' ? 'var(--gold)' :
    event.tone === 'mint' ? 'var(--mint)' :
    event.tone === 'coral' ? 'var(--coral)' :
    event.tone === 'sky' ? 'var(--sky)' :
    event.tone === 'ink' ? 'var(--bink)' : 'var(--s3)';
  const fg = event.tone === 'ink' ? 'var(--bone)' : 'var(--ink)';
  return (
    <Link to={(event.to ?? '/calendar') as never} params={event.params as never} className="up">
      <span className="up-date" style={{ background: bg, color: fg }}>
        <span>{month}</span>
        <span className="d">{d}</span>
      </span>
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontWeight: 600 }}>{event.title}</span>
        <span style={{ fontSize: 13, color: 'var(--bmu)' }}>{event.subtitle}</span>
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--bmu)', whiteSpace: 'nowrap' }}>{dueIn(event.date, new Date().toISOString().slice(0, 10))}</span>
    </Link>
  );
}

function RentBubbles({ cost, rent, gap }: { cost: number; rent: number; gap: number }) {
  const lhs = (v: number) => (v >= 100000 ? `${Math.round(v / 100000)}k` : num(Math.round(v / 100)));
  const max = cost + gap;
  const pill = max > 0 ? Math.round((rent / Math.max(rent + gap, 1)) * 100) : 0;
  return (
    <svg className="chart-svg" viewBox="0 0 600 250" role="img" aria-label={`Lease cost ${cedi(cost)} a month, rent in ${cedi(rent)}, leaving a gap of ${cedi(gap)}`}>
      <g className="bub" style={{ animationDelay: '.1s' }}>
        <circle cx="140" cy="125" r="108" fill="#2A2822" stroke="#3D3A31" />
        <text x="140" y="116" textAnchor="middle" fill="#A8A291" fontSize="14" fontWeight="500">Lease cost</text>
        <text className="d n" x="140" y="156" textAnchor="middle" fill="#F4F0E6" fontSize="42" fontWeight="700">{lhs(cost)}</text>
      </g>
      <g className="bub" style={{ animationDelay: '.25s' }}>
        <circle cx="300" cy="140" r="90" fill="#62E6B1" />
        <text x="300" y="132" textAnchor="middle" fill="#14110A" fontSize="14" fontWeight="600">Rent in</text>
        <text className="d n" x="300" y="170" textAnchor="middle" fill="#14110A" fontSize="42" fontWeight="700">{lhs(rent)}</text>
      </g>
      <g className="bub" style={{ animationDelay: '.4s' }}>
        <circle cx="440" cy="172" r="58" fill={gap > 0 ? '#FF6F5B' : '#62E6B1'} />
        <text x="440" y="166" textAnchor="middle" fill="#14110A" fontSize="13" fontWeight="600">{gap > 0 ? 'Gap' : 'Green'}</text>
        <text className="d n" x="440" y="196" textAnchor="middle" fill="#14110A" fontSize="30" fontWeight="700">{gap > 0 ? '−' : '+'}{lhs(gap)}</text>
      </g>
      <text x="300" y="246" textAnchor="middle" fill="#A8A291" fontSize="12">{pill}% of the lease is covered by rent</text>
    </svg>
  );
}

function Stamp({
  label,
  earned,
  tone,
  icon,
  value,
  note,
}: {
  label: string;
  earned: boolean;
  tone: 'gold' | 'mint';
  icon: 'people' | 'building' | 'trend' | 'clock';
  value?: string;
  note?: string;
}) {
  return (
    <span
      className={`stamp ${earned ? 'earned' : ''}`}
      style={{
        background: earned ? (tone === 'gold' ? 'var(--gold)' : 'var(--mint)') : 'var(--s2)',
        color: earned ? 'var(--ink)' : 'var(--mu)',
      }}
    >
      <StampArt>
        <g transform="translate(35 30)" stroke={earned ? '#171612' : '#34312A'} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {icon === 'people' && <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M10 11a4 4 0 100-8 4 4 0 000 8z" />}
          {icon === 'building' && <path d="M4 21V5l8-3v19M12 9h8v12M4 21h16" />}
          {icon === 'trend' && <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />}
          {icon === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}
        </g>
      </StampArt>
      {value && <span className="d n stamp-value">{value}</span>}
      <span className="d stamp-label">{label}</span>
      {note && <span className="stamp-note">{note}</span>}
    </span>
  );
}

function HeroBuilding() {
  return (
    <svg width="148" height="120" viewBox="0 0 148 120" fill="none" stroke="#1A1813" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 116h144M14 116V84h22v32M116 116V70h26v46" />
      <rect x="40" y="14" width="68" height="102" rx="3" />
      <path d="M52 32h12M78 32h12M52 54h12M78 54h12M52 76h12M78 76h12M66 116v-20h16v20" />
    </svg>
  );
}

function milestones(data: NonNullable<ReturnType<typeof useDwellData>>) {
  const firstTenant = data.tenancies.length > 0;
  const full = Boolean(data.primarySite && data.primarySite.total > 0 && data.primarySite.vacant === 0);
  const green = data.netMonthly >= 0;
  let daysFull = 0;
  if (full) {
    const start = data.rooms
      .map((r) => r.current?.startDate)
      .filter((v): v is string => Boolean(v))
      .sort()[0];
    if (start) daysFull = Math.max(1, Math.round((Date.parse(`${data.today}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000));
  }
  return {
    firstTenant,
    full,
    green,
    daysFull,
    earned: [firstTenant, full, green, full].filter(Boolean).length,
  };
}
