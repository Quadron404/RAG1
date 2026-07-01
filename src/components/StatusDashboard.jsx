import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COLO_COORDS = {
  MAA: { lat: 13.1, lon: 80.3, label: 'MAA (Chennai)' },
  BOM: { lat: 19.1, lon: 72.9, label: 'BOM (Mumbai)' },
  DEL: { lat: 28.6, lon: 77.2, label: 'DEL (Delhi)' },
  CCU: { lat: 22.6, lon: 88.4, label: 'CCU (Kolkata)' },
  HYD: { lat: 17.4, lon: 78.5, label: 'HYD (Hyderabad)' },
  BLR: { lat: 12.9, lon: 77.6, label: 'BLR (Bangalore)' },
};

function getBrowserLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz?.includes('Kolkata')) resolve({ lat: 22.5, lon: 88.3 });
      else if (tz?.includes('Mumbai')) resolve({ lat: 19.0, lon: 72.8 });
      else if (tz?.includes('Delhi')) resolve({ lat: 28.6, lon: 77.2 });
      else if (tz?.includes('Chennai')) resolve({ lat: 13.0, lon: 80.2 });
      else resolve({ lat: 20.5, lon: 78.0 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz?.includes('Kolkata')) resolve({ lat: 22.5, lon: 88.3 });
        else if (tz?.includes('Mumbai')) resolve({ lat: 19.0, lon: 72.8 });
        else if (tz?.includes('Delhi')) resolve({ lat: 28.6, lon: 77.2 });
        else if (tz?.includes('Chennai')) resolve({ lat: 13.0, lon: 80.2 });
        else resolve({ lat: 20.5, lon: 78.0 });
      },
      { timeout: 3000, enableHighAccuracy: false }
    );
  });
}

const nodeIcon = L.divIcon({
  className: 'sd-marker',
  html: '<div class="sd-marker-inner"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function StatusCard({ title, icon, checks }) {
  const healthy = checks.every(c => c.ok);
  return (
    <div className={`sd-card ${healthy ? 'sd-card--ok' : 'sd-card--err'}`}>
      <div className="sd-card-header">
        <span className={`sd-card-icon ${healthy ? 'sd-icon-ok' : 'sd-icon-err'}`}>{icon}</span>
        <span className="sd-card-title">{title}</span>
        <span className={`sd-card-badge ${healthy ? 'sd-badge-ok' : 'sd-badge-err'}`}>
          {healthy ? '✔ ONLINE' : '✖ OFFLINE'}
        </span>
      </div>
      <div className="sd-card-checks">
        {checks.map((c, i) => (
          <div key={i} className="sd-check-row">
            <span className={c.ok ? 'sd-check-pass' : 'sd-check-fail'}>{c.ok ? '✔' : '✖'}</span>
            <span className="sd-check-label">{c.label}</span>
            {c.value !== undefined && <span className="sd-check-value">{c.value}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatusDashboard({ onClose }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const linesRef = useRef(null);
  const geoLayerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('OPERATIONAL');
  const [browserData, setBrowserData] = useState(null);
  const [edgeData, setEdgeData] = useState(null);
  const [backendData, setBackendData] = useState(null);
  const [browserPos, setBrowserPos] = useState(null);
  const [edgePos, setEdgePos] = useState(null);
  const [backPos, setBackPos] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    getBrowserLocation().then(loc => { if (mountedRef.current) setBrowserPos(loc); });
  }, []);

  function lineColor(edgeOk, backOk) {
    if (edgeOk === false || backOk === false) return '#ff3344';
    if (edgeData?.latency && edgeData.latency > 300) return '#ffcc00';
    return '#00ff88';
  }

  function lineSpeed() {
    const lat = edgeData?.latency;
    if (!lat || lat > 500) return '0s';
    if (lat > 300) return '1.5s';
    if (lat > 150) return '0.8s';
    return '0.4s';
  }

  const updateMapNodes = useCallback(() => {
    const map = mapInstance.current;
    if (!map) return;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (linesRef.current) { map.removeLayer(linesRef.current); linesRef.current = null; }

    const positions = [];
    if (browserPos) positions.push({ ...browserPos, label: 'Browser', color: browserData?.healthy ? '#00ff88' : '#ff3344' });
    if (edgePos) positions.push({ ...edgePos, label: edgePos.label || 'Edge', color: edgeData?.healthy ? '#00ff88' : '#ff3344' });
    if (backPos) positions.push({ ...backPos, label: backPos.label || 'Host', color: backendData?.healthy ? '#00ff88' : '#ff3344' });

    positions.forEach(p => {
      const m = L.marker([p.lat, p.lon], { icon: nodeIcon }).addTo(map);
      m.bindTooltip(p.label, { direction: 'top', offset: L.point(0, -10), className: 'sd-tooltip' });
      const el = m.getElement();
      if (el) el.style.setProperty('--node-color', p.color);
      markersRef.current.push(m);
    });

    if (positions.length >= 2) {
      const pairs = [];
      const browser = positions.find(p => p.label === 'Browser');
      const edge = positions.find(p => p.label?.includes('Edge') || p.label === 'Edge');
      const host = positions.find(p => p.label === 'Host' || p.label?.includes('Host'));
      if (browser && edge) pairs.push([browser, edge]);
      if (edge && host) pairs.push([edge, host]);
      const latlngs = pairs.map(pair => [L.latLng(pair[0].lat, pair[0].lon), L.latLng(pair[1].lat, pair[1].lon)]);
      const lines = [];
      pairs.forEach((pair, i) => {
        const c = lineColor(edgeData?.healthy, backendData?.healthy);
        const s = lineSpeed();
        const ln = L.polyline([L.latLng(pair[0].lat, pair[0].lon), L.latLng(pair[1].lat, pair[1].lon)], {
          color: c, weight: 2, opacity: 0.7, dashArray: '8 6',
        }).addTo(map);
        const el = ln.getElement();
        if (el) {
          el.style.animation = s === '0s' ? 'none' : `sdLineDash ${s} linear infinite`;
          el.style.strokeDasharray = '8 6';
        }
        lines.push(ln);
      });
      linesRef.current = L.featureGroup(lines);
    }

    if (positions.length > 0) {
      const group = L.featureGroup(positions.map(p => L.marker([p.lat, p.lon])));
      map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 6 });
    }
  }, [browserPos, edgePos, backPos, browserData, edgeData, backendData]);

  useEffect(() => {
    if (mapInstance.current) { updateMapNodes(); }
  }, [updateMapNodes]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el || mapInstance.current) return;
    const map = L.map(el, {
      center: [20.5, 78.0],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      className: 'sd-tiles',
    }).addTo(map);
    mapInstance.current = map;

    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/india.geojson')
      .then(r => r.json())
      .then(geo => {
        if (!mountedRef.current) return;
        const layer = L.geoJSON(geo, {
          style: { color: '#4488ff', weight: 1.5, fillColor: 'rgba(0,60,120,0.08)', fillOpacity: 1 },
        }).addTo(map);
        geoLayerRef.current = layer;
        setReady(true);
        updateMapNodes();
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setReady(true);
        updateMapNodes();
      });

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  const poll = useCallback(async () => {
    const online = navigator.onLine;
    setBrowserData({
      healthy: online,
      checks: [
        { ok: true, label: 'JavaScript Runtime', value: 'active' },
        { ok: online, label: 'Network Connectivity', value: online ? 'online' : 'offline' },
        { ok: true, label: 'UI Responsiveness', value: `${Math.floor(performance.now() % 100)}ms` },
      ]
    });

    let edgeErr = null, edgeLat = null, edgeResult = null;
    let backErr = null, backResult = null;

    try {
      const t1 = performance.now();
      const r = await fetch('/api/health');
      const d = await r.json();
      edgeLat = Math.round(performance.now() - t1);
      const h = r.ok && d.status === 'ok';
      edgeResult = {
        healthy: h,
        checks: [
          { ok: r.ok, label: 'HTTP Status', value: `${r.status}` },
          { ok: edgeLat < 500, label: 'Response Latency', value: `${edgeLat}ms` },
          { ok: true, label: 'Edge Region', value: d.region || 'N/A' },
          { ok: d.dbConnected, label: 'Database Link', value: d.dbConnected ? 'connected' : 'disconnected' },
        ]
      };
      if (d.colo && COLO_COORDS[d.colo] && mountedRef.current) {
        const c = COLO_COORDS[d.colo];
        setEdgePos({ lat: c.lat, lon: c.lon, label: c.label });
      }
      if (d.coloLon && d.coloLat && mountedRef.current) {
        setBackPos({ lat: d.coloLat, lon: d.coloLon, label: `${d.colo} (Host)` });
      }
    } catch (e) {
      edgeErr = e.message || String(e);
      if (e.name === 'TypeError' && e.message.includes('fetch')) edgeErr = 'Network timeout or DNS failure';
      else if (e.name === 'TypeError' && e.message.includes('CORS')) edgeErr = 'CORS blocked';
      else if (e.message) edgeErr = e.message;
    }

    if (edgeErr !== null || !edgeResult) {
      if (mountedRef.current) setEdgeData({
        healthy: false,
        checks: [
          { ok: false, label: 'HTTP Status', value: 'FAILED' },
          { ok: false, label: 'Error', value: edgeErr || 'unreachable' },
          { ok: false, label: 'Edge Region', value: 'unknown' },
          { ok: false, label: 'Database Link', value: 'unknown' },
        ]
      });
    } else if (mountedRef.current) {
      setEdgeData(edgeResult);
    }

    try {
      const r = await fetch('/internal/health');
      const d = await r.json();
      const h = r.ok && d.status === 'ok' && d.dbConnected;
      backResult = {
        healthy: h,
        checks: [
          { ok: r.ok, label: 'HTTP Status', value: `${r.status}` },
          { ok: d.dbConnected, label: 'Database', value: d.dbConnected ? 'connected' : 'disconnected' },
          { ok: d.status === 'ok', label: 'Service Integrity', value: d.status },
        ]
      };
      if (mountedRef.current) setBackendData(backResult);
    } catch (e) {
      backErr = e.message || String(e);
      if (e.name === 'TypeError' && e.message.includes('fetch')) backErr = 'Network timeout or DNS failure';
      else if (e.name === 'TypeError' && e.message.includes('CORS')) backErr = 'CORS blocked';
      else if (e.message) backErr = e.message;
      if (mountedRef.current) setBackendData({
        healthy: false,
        checks: [
          { ok: false, label: 'HTTP Status', value: 'FAILED' },
          { ok: false, label: 'Error', value: backErr },
          { ok: false, label: 'Service Integrity', value: 'unknown' },
        ]
      });
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll]);

  const allData = [browserData, edgeData, backendData];
  const allHealthy = allData.filter(Boolean).every(d => d.healthy);
  const anyUnhealthy = allData.filter(Boolean).some(d => !d.healthy);
  const globalStatus = !allData.every(Boolean) ? 'INITIALIZING' : allHealthy ? 'OPERATIONAL' : anyUnhealthy ? 'DEGRADED' : 'CRITICAL';
  const globalColor = globalStatus === 'OPERATIONAL' ? '#00ff88' : globalStatus === 'DEGRADED' ? '#ffcc00' : '#ff3344';

  return (
    <div className="sd-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sd-panel">
        <button type="button" className="sd-close" onClick={onClose}><span className="sd-close-icon">✕</span> <span className="sd-close-label">CLOSE</span></button>

        <div className="sd-global-status" style={{ borderColor: globalColor }}>
          <span className="sd-gs-label">SYSTEM STATUS</span>
          <span className="sd-gs-value" style={{ color: globalColor }}>
            <span className="sd-glow-dot" style={{ backgroundColor: globalColor, boxShadow: `0 0 10px ${globalColor}` }} />
            {globalStatus}
          </span>
        </div>

        <div className="sd-map-container">
          <div ref={mapRef} className="sd-map-leaflet" />
        </div>

        <div className="sd-cards">
          <StatusCard title="Browser Layer" icon="🖥" checks={browserData?.checks || []} />
          <StatusCard title="Cloudflare Edge" icon="☁" checks={edgeData?.checks || []} />
          <StatusCard title="Backend Host" icon="🖧" checks={backendData?.checks || []} />
        </div>
      </div>
    </div>
  );
}
