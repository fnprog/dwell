import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { fmtDate, initials } from '../data/format';
import { useDwellData } from '../data/derive';
import { signOut, useSession } from '../sync';
import { Icon } from '../components/Icon';
import { SyncBadge } from '../components/SyncBadge';
import { Loading } from '../components/ui';

export function SettingsPage() {
  const session = useSession();
  const data = useDwellData();
  const [alerts, setAlerts] = useState({ rent: true, ending: true, sync: true, weekly: false });

  if (session === undefined || session === null || !data) return <Loading />;
  const name = session.user.name;

  const toggle = (key: keyof typeof alerts) => setAlerts((current) => ({ ...current, [key]: !current[key] }));

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Your half of Dwell. Everything is on this device, first.</p>
        </div>
        <div className="page-actions">
          <Link to="/sync" className="btn"><Icon name="refresh" size={17} /> Sync</Link>
          <button className="btn g" onClick={() => window.print()}><Icon name="download" size={17} /> Backup</button>
        </div>
      </header>

      <section className="settings-hero">
        <div className="card settings-profile">
          <span className="avatar" style={{ width: 84, height: 84, fontSize: 36 }}>{initials(name).slice(0, 1)}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="d" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>{name}</span>
            <span className="mu">{session.user.email}</span>
            <span className="pill gold" style={{ alignSelf: 'flex-start', marginTop: 8 }}>Partner</span>
          </div>
          <div style={{ marginLeft: 'auto' }}><SyncBadge /></div>
        </div>
        <div className="bone" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">The business</span>
          <span className="d" style={{ fontSize: 28, fontWeight: 800 }}>Dwell Property</span>
          <span style={{ color: 'var(--bmu)' }}>{data.sites.length} {data.sites.length === 1 ? 'site' : 'sites'} · {data.units.length} rooms · {data.tenants.length} people</span>
          <div className="row-between" style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #d9d2c0' }}>
            <span style={{ color: 'var(--bmu)' }}>Currency</span>
            <b>GHS · Ghana cedi</b>
          </div>
          <div className="row-between">
            <span style={{ color: 'var(--bmu)' }}>Since</span>
            <b>{fmtDate(data.today)}</b>
          </div>
        </div>
      </section>

      <section className="settings-grid">
        <div className="card" style={{ padding: 28 }}>
          <div className="section-head"><h2>Alerts</h2><span className="mu small">On this device</span></div>
          <div className="setting">
            <div><b>Rent is late</b><div className="mu small">Tell me when a payment passes its due date.</div></div>
            <button className={`tg ${alerts.rent ? 'on' : ''}`} role="switch" aria-checked={alerts.rent} aria-label="Rent is late" onClick={() => toggle('rent')} />
          </div>
          <div className="setting">
            <div><b>Tenancy ending</b><div className="mu small">A nudge before a room comes free.</div></div>
            <button className={`tg ${alerts.ending ? 'on' : ''}`} role="switch" aria-checked={alerts.ending} aria-label="Tenancy ending" onClick={() => toggle('ending')} />
          </div>
          <div className="setting">
            <div><b>Sync problems</b><div className="mu small">When something cannot reach the server.</div></div>
            <button className={`tg ${alerts.sync ? 'on' : ''}`} role="switch" aria-checked={alerts.sync} aria-label="Sync problems" onClick={() => toggle('sync')} />
          </div>
          <div className="setting">
            <div><b>Weekly digest</b><div className="mu small">A Monday summary of the portfolio.</div></div>
            <button className={`tg ${alerts.weekly ? 'on' : ''}`} role="switch" aria-checked={alerts.weekly} aria-label="Weekly digest" onClick={() => toggle('weekly')} />
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="section-head"><h2>Team</h2><span className="pill">2</span></div>
          <div className="row" style={{ padding: '12px 0', borderBottom: '1px solid var(--ln)' }}>
            <span className="avatar">{initials(name).slice(0, 1)}</span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <b>{name}</b>
              <span className="mu small">You · Partner</span>
            </span>
            <span className="pill ok" style={{ marginLeft: 'auto' }}>Signed in</span>
          </div>
          <div className="row" style={{ padding: '12px 0' }}>
            <span className="avatar dark">?</span>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <b>Your partner</b>
              <span className="mu small">Invite by sharing this device or the sync link.</span>
            </span>
            <Link to="/sync" className="pill sky" style={{ marginLeft: 'auto' }}>Sync</Link>
          </div>
          <Link to="/landlords" className="btn" style={{ marginTop: 12 }}><Icon name="key" size={17} /> Landlords</Link>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="section-head"><h2>Data</h2></div>
          <div className="setting">
            <div><b>On this device</b><div className="mu small">Every change saves here first, then syncs.</div></div>
            <span className="pill ok">Local first</span>
          </div>
          <div className="setting">
            <div><b>Sync</b><div className="mu small">Manage this device's connection.</div></div>
            <Link to="/sync" className="btn sm">Open</Link>
          </div>
          <div className="setting">
            <div><b>Export a statement</b><div className="mu small">Print the money page for your records.</div></div>
            <button className="btn sm" onClick={() => window.print()}>Export</button>
          </div>
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div className="section-head"><h2>Account</h2></div>
          <div className="setting">
            <div><b>{name}</b><div className="mu small">{session.user.email}</div></div>
            <span className="pill">Partner</span>
          </div>
          <div className="setting">
            <div><b>Sign out</b><div className="mu small">You can sign back in when you are online.</div></div>
            <button
              className="btn danger"
              onClick={() => {
                signOut().catch((error: Error) => window.alert(error.message));
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </section>

      <section className="card" style={{ padding: 24, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="ico" style={{ background: 'var(--gold)' }}><Icon name="shield" size={22} /></span>
        <span style={{ flex: 1 }}>
          <b>Nothing leaves without you.</b>
          <span className="mu small" style={{ display: 'block' }}>Dwell works offline, saves on this device first, and reconciles with your partner when the signal returns.</span>
        </span>
        <Link to="/sync" className="btn">See sync status</Link>
      </section>
    </>
  );
}
