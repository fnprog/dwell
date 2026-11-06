import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { cedi, fmtDate, plural } from '../data/format';
import { useDwellData } from '../data/derive';
import { Icon } from '../components/Icon';
import { OsmMap } from '../components/MapArt';
import { Loading } from '../components/ui';

export function MapPage() {
  const data = useDwellData();
  const [selected, setSelected] = useState<string | null>(null);

  if (!data) return <Loading />;
  const located = data.siteInfos.filter((site) => site.site.lat != null && site.site.lng != null);
  const chosen = data.siteInfos.find((site) => site.site.id === selected) ?? data.siteInfos[0];

  return (
    <>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">Map</h1>
          <p className="page-subtitle">OpenStreetMap pins · {plural(located.length, 'pinned site')} of {plural(data.sites.length, 'site')} · {plural(data.rooms.length, 'room')} across your patch.</p>
        </div>
        <div className="page-actions">
          <Link to="/sites" className="btn"><Icon name="portfolio" size={17} /> Portfolio</Link>
        </div>
      </header>

      <section className="map-page">
        <div className="map-canvas">
          <OsmMap sites={data.siteInfos} selectedId={chosen?.site.id ?? null} onSelect={setSelected} />
          {data.siteInfos.length === 0 && (
            <div className="map-empty">
              <span className="ico lg" style={{ background: 'var(--gold)' }}><Icon name="map" size={28} /></span>
              <b className="d" style={{ fontSize: 28, fontWeight: 800 }}>No pins yet</b>
              <span>Add your first site to see it here.</span>
            </div>
          )}
          {data.siteInfos.length > 0 && located.length === 0 && (
            <div className="map-empty" style={{ pointerEvents: 'none' }}>
              <span className="ico lg" style={{ background: 'var(--s3)', color: 'var(--tx)' }}><Icon name="map" size={28} /></span>
              <b className="d" style={{ fontSize: 28, fontWeight: 800 }}>No pins yet</b>
              <span>Edit a site, add its address, and use “Find pin from address”.</span>
            </div>
          )}
          <div className="map-legend">
            <span><span className="dot" style={{ background: 'var(--mint)' }} /> Full</span>
            <span><span className="dot" style={{ background: 'var(--gold)' }} /> Empty room</span>
          </div>
        </div>

        <div className="map-side">
          {chosen ? (
            <>
              <div className="bone" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="eyebrow">Selected site</span>
                <span className="d" style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05 }}>{chosen.site.name}</span>
                <span style={{ color: 'var(--bmu)' }}>{chosen.site.address ?? 'No address yet'}</span>
                <span className="small" style={{ color: 'var(--bmu)' }}>
                  {chosen.site.lat != null && chosen.site.lng != null
                    ? `${chosen.site.lat.toFixed(6)}, ${chosen.site.lng.toFixed(6)}`
                    : 'No pin yet'}
                </span>
                <div className="row-between" style={{ marginTop: 10 }}>
                  <span style={{ color: 'var(--bmu)' }}>{chosen.occupied} of {chosen.total} rooms let</span>
                  <span className="pill" style={{ background: 'rgba(26,24,19,.1)' }}>{chosen.net >= 0 ? '+' : ''}{cedi(chosen.net)}/mo</span>
                </div>
                <Link to="/sites/$siteId" params={{ siteId: chosen.site.id }} className="btn k" style={{ marginTop: 12 }}>
                  Open {chosen.site.name}
                </Link>
              </div>

              <div className="card" style={{ padding: 12 }}>
                {data.siteInfos.map((site) => (
                  <button
                    key={site.site.id}
                    className={`opt ${site.site.id === chosen.site.id ? 'on' : ''}`}
                    onClick={() => setSelected(site.site.id)}
                    style={{ padding: '12px 10px', background: site.site.id === chosen.site.id ? 'var(--s3)' : undefined }}
                  >
                    <span className="ico sm" style={{ background: site.vacant > 0 ? 'var(--gold)' : 'var(--mint)' }}>
                      <Icon name="building" size={18} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'left' }}>
                      <b>{site.site.name}</b>
                      <span className="mu small">
                        {site.occupied}/{site.total} let · {site.site.lat != null && site.site.lng != null ? 'pinned' : 'no pin'} · {site.lease ? `ends ${fmtDate(site.lease.endDate)}` : 'no lease'}
                      </span>
                    </span>
                    <Icon name="chevronRight" size={16} className="mu" />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-card">
              <span className="ico lg" style={{ background: 'var(--s2)', color: 'var(--tx)' }}><Icon name="map" size={28} /></span>
              <b className="d" style={{ fontSize: 26, color: 'var(--tx)' }}>Nothing on the map yet</b>
              <span>Add a site and it will appear here.</span>
              <Link to="/sites" className="btn g">Add a site</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
