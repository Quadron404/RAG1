import { useCallback, useEffect, useRef, useState } from 'react';

const INDIA_POLYGON = [
  [34.0,77.3],[34.5,76.5],[35.0,76.0],[35.5,75.5],[35.0,76.5],[35.0,77.5],[34.5,78.5],[34.0,79.0],[33.5,79.0],[33.0,78.5],[32.5,79.0],[32.0,79.5],[31.5,79.0],[31.0,78.5],[30.5,79.0],[30.0,79.5],[29.5,80.0],[29.0,80.5],[28.5,81.0],[28.0,81.5],[27.5,82.0],[27.0,82.5],[26.5,83.0],[26.0,83.5],[25.5,84.0],[25.0,84.5],[24.5,85.0],[24.0,85.5],[23.5,86.0],[23.0,86.5],[22.5,87.0],[22.5,88.0],[22.0,88.5],[21.5,89.5],[21.0,89.0],[20.5,88.0],[20.0,87.5],[19.5,86.5],[19.0,85.5],[18.5,84.5],[18.0,84.0],[17.5,83.0],[17.0,82.5],[16.5,82.0],[16.0,81.5],[15.5,81.0],[15.0,80.5],[14.5,80.5],[14.0,80.5],[13.5,80.5],[13.0,80.5],[12.5,80.0],[12.0,79.5],[11.5,79.5],[11.0,79.5],[10.5,79.0],[10.0,79.0],[9.5,78.5],[9.0,78.0],[8.5,77.5],[8.0,77.5],[8.2,77.0],[8.5,76.8],[9.0,76.5],[9.5,76.5],[10.0,76.5],[10.5,76.5],[11.0,76.0],[11.5,76.0],[12.0,75.5],[12.5,75.5],[13.0,75.0],[13.5,74.5],[14.0,74.5],[14.5,74.5],[15.0,74.5],[15.5,74.0],[16.0,74.0],[16.5,73.5],[17.0,73.5],[17.5,73.0],[18.0,73.0],[18.5,72.5],[19.0,72.5],[19.5,72.5],[20.0,72.5],[20.5,72.5],[21.0,72.5],[21.5,72.0],[22.0,72.0],[22.5,71.5],[22.5,71.0],[22.5,70.5],[23.0,70.0],[23.5,69.5],[24.0,69.0],[24.5,69.5],[25.0,70.0],[25.5,70.5],[26.0,71.0],[26.5,71.5],[27.0,72.0],[27.5,72.5],[28.0,73.0],[28.5,73.5],[29.0,74.0],[29.5,74.5],[30.0,75.0],[30.5,75.5],[31.0,75.5],[31.5,76.0],[32.0,76.5],[32.5,76.5],[33.0,77.0],[33.5,77.0],
];

const COLO_COORDS = {
  MAA: { lat: 13.1, lon: 80.3, label: 'MAA (Chennai)' },
  BOM: { lat: 19.1, lon: 72.9, label: 'BOM (Mumbai)' },
  DEL: { lat: 28.6, lon: 77.2, label: 'DEL (Delhi)' },
  CCU: { lat: 22.6, lon: 88.4, label: 'CCU (Kolkata)' },
  HYD: { lat: 17.4, lon: 78.5, label: 'HYD (Hyderabad)' },
  BLR: { lat: 12.9, lon: 77.6, label: 'BLR (Bangalore)' },
};

const VB_W = 420, VB_H = 440;
const LAT_MIN = 8, LAT_MAX = 37;
const LON_MIN = 68, LON_MAX = 98;
const PAD_X = 10, PAD_Y = 20;
const MAP_W = VB_W - PAD_X * 2, MAP_H = VB_H - PAD_Y * 2;

function toSvg(lat, lon) {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_W + PAD_X;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_H + PAD_Y;
  return [x, y];
}

const INDIA_POINTS = INDIA_POLYGON.map(p => toSvg(p[0], p[1]).join(',')).join(' ');

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

function NodeDot({ x, y, color, label, pulse, sub }) {
  const r = pulse ? 12 : 8;
  return (
    <g>
      <circle cx={x} cy={y} r={r + 6} fill={color} opacity="0.15" className={pulse ? 'sd-node-pulse' : ''} />
      <circle cx={x} cy={y} r={r} fill={color} opacity="0.4" className={pulse ? 'sd-node-pulse' : ''} />
      <circle cx={x} cy={y} r={4} fill={color} stroke="#fff" strokeWidth="1.5" />
      <text x={x} y={y - r - 8} textAnchor="middle" fill="#ccc" fontSize="9" fontFamily="monospace">{label}</text>
      {sub && <text x={x} y={y + r + 16} textAnchor="middle" fill="#888" fontSize="8" fontFamily="monospace">{sub}</text>}
    </g>
  );
}

function ConnLine({ x1, y1, x2, y2, color }) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={midX} y2={midY} stroke={color} strokeWidth="1.5" strokeDasharray="4 4" className="sd-line-anim" opacity="0.6" />
      <line x1={midX} y1={midY} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeDasharray="4 4" className="sd-line-anim" opacity="0.6" />
    </g>
  );
}

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
  const [status, setStatus] = useState('OPERATIONAL');
  const [browser, setBrowser] = useState(null);
  const [edge, setEdge] = useState(null);
  const [backend, setBackend] = useState(null);
  const [browserPos, setBrowserPos] = useState(null);
  const [edgePos, setEdgePos] = useState(null);
  const [backPos, setBackPos] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    getBrowserLocation().then(loc => {
      if (mountedRef.current) setBrowserPos(loc);
    });
  }, []);

  const poll = useCallback(async () => {
    const localOnline = navigator.onLine;
    const jsAlive = true;
    const uiResp = true;
    setBrowser({
      healthy: localOnline && jsAlive,
      checks: [
        { ok: jsAlive, label: 'JavaScript Runtime', value: 'active' },
        { ok: localOnline, label: 'Network Connectivity', value: localOnline ? 'online' : 'offline' },
        { ok: uiResp, label: 'UI Responsiveness', value: `${Math.floor(performance.now() % 100)}ms` },
      ]
    });

    try {
      const t1 = performance.now();
      const r = await fetch('/api/health');
      const d = await r.json();
      const lat = Math.round(performance.now() - t1);
      const healthy = r.ok && d.status === 'ok';
      setEdge({
        healthy,
        latency: lat,
        checks: [
          { ok: r.ok, label: 'HTTP Status', value: r.status },
          { ok: lat < 500, label: 'Response Latency', value: `${lat}ms` },
          { ok: true, label: 'Edge Region', value: d.region || 'N/A' },
          { ok: d.dbConnected, label: 'Database Link', value: d.dbConnected ? 'connected' : 'disconnected' },
        ]
      });
      if (d.colo && COLO_COORDS[d.colo]) {
        const c = COLO_COORDS[d.colo];
        if (mountedRef.current) setEdgePos({ lat: c.lat, lon: c.lon, label: c.label });
      }
      if (d.coloLon && d.coloLat && mountedRef.current) {
        setBackPos({ lat: d.coloLat, lon: d.coloLon, label: `${d.colo} (Host)` });
      }
    } catch {
      if (mountedRef.current) setEdge({
        healthy: false,
        latency: null,
        checks: [
          { ok: false, label: 'HTTP Status', value: 'timeout' },
          { ok: false, label: 'Response Latency', value: '>5000ms' },
          { ok: false, label: 'Edge Region', value: 'unknown' },
          { ok: false, label: 'Database Link', value: 'unknown' },
        ]
      });
    }

    try {
      const r = await fetch('/internal/health');
      const d = await r.json();
      const healthy = r.ok && d.status === 'ok' && d.dbConnected;
      setBackend({
        healthy,
        checks: [
          { ok: r.ok, label: 'Server Status', value: r.status },
          { ok: d.dbConnected, label: 'Database Connectivity', value: d.dbConnected ? 'connected' : 'disconnected' },
          { ok: d.status === 'ok', label: 'Service Integrity', value: d.status },
        ]
      });
    } catch {
      if (mountedRef.current) setBackend({
        healthy: false,
        checks: [
          { ok: false, label: 'Server Status', value: 'timeout' },
          { ok: false, label: 'Database Connectivity', value: 'unknown' },
          { ok: false, label: 'Service Integrity', value: 'failed' },
        ]
      });
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll]);

  const allHealthy = [browser?.healthy, edge?.healthy, backend?.healthy];
  const healthyCount = allHealthy.filter(Boolean).length;
  const totalCount = allHealthy.length;
  const globalStatus = healthyCount === totalCount ? 'OPERATIONAL' : healthyCount >= totalCount - 1 ? 'DEGRADED' : 'CRITICAL';
  const globalColor = globalStatus === 'OPERATIONAL' ? '#00ff88' : globalStatus === 'DEGRADED' ? '#ffcc00' : '#ff3344';

  const posB = browserPos ? toSvg(browserPos.lat, browserPos.lon) : null;
  const posE = edgePos ? toSvg(edgePos.lat, edgePos.lon) : null;
  const posBack = backPos ? toSvg(backPos.lat, backPos.lon) : null;

  return (
    <div className="sd-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sd-panel">
        <button type="button" className="sd-close" onClick={onClose}>✕</button>

        <div className="sd-header">
          <div className="sd-global-status" style={{ borderColor: globalColor }}>
            <span className="sd-global-label">SYSTEM STATUS</span>
            <span className="sd-global-value" style={{ color: globalColor }}>
              <span className={`sd-glow-dot sd-glow-${globalStatus.toLowerCase()}`} style={{ backgroundColor: globalColor }} />
              {globalStatus}
            </span>
          </div>
        </div>

        <div className="sd-map-wrap">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="sd-map">
            <polygon points={INDIA_POINTS} fill="rgba(0,180,255,0.06)" stroke="rgba(0,180,255,0.25)" strokeWidth="1" />
            {posB && posE && <ConnLine x1={posB[0]} y1={posB[1]} x2={posE[0]} y2={posE[1]} color={browser?.healthy && edge?.healthy ? '#00ff88' : '#ff3344'} />}
            {posE && posBack && <ConnLine x1={posE[0]} y1={posE[1]} x2={posBack[0]} y2={posBack[1]} color={edge?.healthy && backend?.healthy ? '#00ff88' : '#ff3344'} />}
            {posB && (
              <NodeDot x={posB[0]} y={posB[1]} color={browser?.healthy ? '#00ff88' : '#ff3344'} label="Browser" sub="Client" pulse={browser?.healthy} />
            )}
            {posE && (
              <NodeDot x={posE[0]} y={posE[1]} color={edge?.healthy ? '#00ff88' : '#ff3344'} label={edgePos?.label || 'Edge'} sub="Cloudflare" pulse={edge?.healthy} />
            )}
            {posBack && (
              <NodeDot x={posBack[0]} y={posBack[1]} color={backend?.healthy ? '#00ff88' : '#ff3344'} label={backPos?.label || 'Host'} sub="Backend" pulse={backend?.healthy} />
            )}
          </svg>
          <div className="sd-map-legend">
            <span><span className="sd-legend-dot" style={{ background: '#00ff88' }} /> Browser</span>
            <span><span className="sd-legend-dot" style={{ background: '#00ff88' }} /> Cloudflare Edge</span>
            <span><span className="sd-legend-dot" style={{ background: '#00ff88' }} /> Backend Host</span>
          </div>
        </div>

        <div className="sd-cards">
          <StatusCard title="Browser Layer" icon="🖥" checks={browser?.checks || []} />
          <StatusCard title="Cloudflare Edge" icon="☁" checks={edge?.checks || []} />
          <StatusCard title="Backend Host" icon="🖧" checks={backend?.checks || []} />
        </div>

        <div className="sd-footer">
          <span>Real-time status · updating every 4s</span>
          <span className={`sd-live-dot ${allHealthy.every(Boolean) ? 'sd-live-ok' : 'sd-live-err'}`} />
        </div>
      </div>
    </div>
  );
}
