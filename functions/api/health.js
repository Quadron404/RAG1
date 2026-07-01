const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest({ request, env }) {
  const cf = request.cf || {};
  const t0 = Date.now();

  let dbOk = false;
  let dbLatency = null;
  try {
    const t1 = Date.now();
    await env.RAG_DB.prepare('SELECT 1 AS ok').run();
    dbLatency = Date.now() - t1;
    dbOk = true;
  } catch {}

  const elapsed = Date.now() - t0;

  const colo = cf.colo || 'UNKNOWN';
  const coloCoords = {
    MAA:  { lat: 13.1, lon: 80.3 },
    BOM:  { lat: 19.1, lon: 72.9 },
    DEL:  { lat: 28.6, lon: 77.2 },
    CCU:  { lat: 22.6, lon: 88.4 },
    HYD:  { lat: 17.4, lon: 78.5 },
    BLR:  { lat: 12.9, lon: 77.6 },
    FRA:  { lat: 50.1, lon: 8.7 },
    LHR:  { lat: 51.5, lon: -0.5 },
    SIN:  { lat: 1.3, lon: 103.8 },
    NRT:  { lat: 35.7, lon: 139.8 },
    IAD:  { lat: 39.0, lon: -77.5 },
  };

  return new Response(JSON.stringify({
    status: 'ok',
    region: colo,
    colo,
    coloLat: coloCoords[colo]?.lat || null,
    coloLon: coloCoords[colo]?.lon || null,
    country: cf.country || null,
    city: cf.city || null,
    latency: elapsed,
    dbConnected: dbOk,
    dbLatency,
    timestamp: new Date().toISOString(),
  }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
