import { useState } from 'react';
import { Icon } from './Icon';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

/**
 * OpenStreetMap Nominatim lookup for a site address. It is only used when a
 * person taps "Find pin"; the app works offline after that because the
 * coordinates are saved on the site row.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'gh',
    addressdetails: '0',
    q: query,
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!response.ok) throw new Error('Map lookup failed.');
  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = results[0];
  if (!first) return null;
  return {
    lat: Number(first.lat),
    lng: Number(first.lon),
    displayName: first.display_name,
  };
}

export function SiteCoordinates(props: {
  address: string;
  lat: string;
  lng: string;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function findPin() {
    if (!props.address.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await geocodeAddress(props.address);
      if (!result) {
        setStatus('No match found. Add latitude and longitude manually, or try a fuller address.');
        return;
      }
      props.onLatChange(result.lat.toFixed(6));
      props.onLngChange(result.lng.toFixed(6));
      setStatus(`Pin found: ${result.displayName}`);
    } catch {
      setStatus('Map lookup needs a connection. Add latitude and longitude manually.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`coords${props.compact ? ' compact' : ''}`}>
      <div className="coords-row">
        <label className="field">
          <span>Latitude</span>
          <input
            value={props.lat}
            onChange={(event) => props.onLatChange(event.target.value)}
            inputMode="decimal"
            placeholder="5.603700"
          />
        </label>
        <label className="field">
          <span>Longitude</span>
          <input
            value={props.lng}
            onChange={(event) => props.onLngChange(event.target.value)}
            inputMode="decimal"
            placeholder="-0.187000"
          />
        </label>
      </div>
      <div className="coords-actions">
        <button
          type="button"
          className="btn sm"
          onClick={findPin}
          disabled={busy || !props.address.trim()}
        >
          <Icon name="map" size={16} /> {busy ? 'Finding…' : 'Find pin from address'}
        </button>
        <span className="hint">Latitude/longitude fixes the map pin. Without it, the site has no pin.</span>
      </div>
      {status && (
        <p className="hint" role="status" style={{ marginTop: 8 }}>
          {status}
        </p>
      )}
    </div>
  );
}
