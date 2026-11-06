import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import L, { type LayerGroup, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SiteInfo } from '../data/derive';

const ACCRA: [number, number] = [5.6037, -0.187];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char);
}

function pinHtml(site: SiteInfo, selected: boolean) {
  const tone = site.vacant > 0 ? 'gold' : 'mint';
  return `
    <span class="dwell-pin-pill ${selected ? 'selected' : ''}">
      <span class="dwell-pin-dot ${tone}"></span>
      <span class="dwell-pin-label">${escapeHtml(site.site.name)}</span>
    </span>
    <span class="dwell-pin-stem ${tone}"></span>
  `;
}

/**
 * OpenStreetMap-backed map for site pins. It uses the free OSM tile layer
 * with a dark CSS filter, and Dwell pins are drawn as divIcons. Sites
 * without latitude/longitude are listed in the side panel but not pinned.
 */
export function OsmMap({
  sites,
  selectedId,
  onSelect,
}: {
  sites: SiteInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      zoomAnimation: true,
    }).setView(ACCRA, 11);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !map || !layer) return;

    layer.clearLayers();
    const located = sites.filter((site) => site.site.lat != null && site.site.lng != null);

    for (const site of located) {
      const marker = L.marker([site.site.lat!, site.site.lng!], {
        icon: L.divIcon({
          className: 'dwell-leaflet-pin',
          html: pinHtml(site, site.site.id === selectedId),
          iconSize: [180, 46],
          iconAnchor: [90, 44],
        }),
        keyboard: true,
        title: site.site.name,
        alt: `${site.site.name}, ${site.vacant} empty`,
      });
      marker.on('click', () => onSelectRef.current(site.site.id));
      marker.addTo(layer);
    }

    const chosen = sites.find((site) => site.site.id === selectedId);
    if (chosen?.site.lat != null && chosen?.site.lng != null) {
      map.flyTo([chosen.site.lat, chosen.site.lng], Math.max(map.getZoom(), 13), {
        duration: 0.8,
      });
    } else if (located.length > 1) {
      const bounds = L.latLngBounds(located.map((site) => [site.site.lat!, site.site.lng!] as const));
      map.fitBounds(bounds, { padding: [44, 44], maxZoom: 15 });
    } else if (located.length === 1) {
      const only = located[0]!;
      map.flyTo([only.site.lat!, only.site.lng!], 13, { duration: 0.8 });
    } else {
      map.setView(ACCRA, 11);
    }
  }, [ready, sites, selectedId]);

  return <div ref={containerRef} className="osm-map" aria-label="OpenStreetMap of your sites" />;
}

/** Quiet mini-map for cards. The full route uses {@link OsmMap}. */
export function MapArt({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'map-bg'} viewBox="0 0 700 300" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="700" height="300" fill="#13120F" />
      <path d="M430 -10c40 60 20 110 80 150s150 20 210 90" stroke="#1B2A30" strokeWidth="46" strokeLinecap="round" />
      <rect x="60" y="40" width="130" height="90" rx="14" fill="#1A2118" />
      <rect x="540" y="30" width="100" height="70" rx="12" fill="#1A2118" />
      <rect x="330" y="190" width="120" height="70" rx="12" fill="#1A2118" />
      <path d="M-10 90H710M-10 210H710M120 -10V310M300 -10V310M470 -10V310M610 -10V310" stroke="#24221C" strokeWidth="10" />
      <path d="M-10 150L710 120M220 -10L260 310" stroke="#2E2B23" strokeWidth="16" />
      <path d="M-10 250H710M380 -10V310" stroke="#1D1B16" strokeWidth="5" />
      <circle cx="185" cy="155" r="5" fill="#2E2B23" />
      <circle cx="490" cy="225" r="5" fill="#2E2B23" />
    </svg>
  );
}

export function MapPin({ label, tone = 'gold', style }: { label: string; tone?: 'gold' | 'mint' | 'coral'; style?: React.CSSProperties }) {
  return (
    <span className="map-pin" style={style}>
      <span className="map-label" style={{ background: tone === 'gold' ? 'var(--gold)' : tone === 'mint' ? 'var(--mint)' : 'var(--coral)' }}>
        <span style={{ position: 'relative', width: 22, height: 22 }}>
          <span className="ping" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--ink)', opacity: 0.35 }} />
          <span style={{ position: 'absolute', inset: 4, borderRadius: '50%', background: 'var(--ink)' }} />
        </span>
        {label}
      </span>
      <span style={{ width: 2, height: 14, background: tone === 'gold' ? 'var(--gold)' : tone === 'mint' ? 'var(--mint)' : 'var(--coral)' }} />
    </span>
  );
}

export function MapCard({ siteCount, href = '/map' as const, label }: { siteCount: number; href?: '/map'; label?: string }) {
  return (
    <Link to={href} className="card map-card">
      <MapArt />
      <MapPin label={label ?? 'Your rooms'} />
      <span className="map-note">
        <span className="d" style={{ fontSize: 24, fontWeight: 700 }}>Where your rooms are</span>
        <span className="mu">
          {siteCount === 0
            ? 'No sites on the map yet. Add one to drop a pin.'
            : `${siteCount} ${siteCount === 1 ? 'site' : 'sites'} on the map. Open it to add the exact spot.`}
        </span>
      </span>
    </Link>
  );
}
