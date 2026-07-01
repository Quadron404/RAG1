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

  let dbOk = false;
  let dbLatency = null;
  let errorMsg = null;
  try {
    const t1 = Date.now();
    await env.RAG_DB.prepare('SELECT 1 AS ok').run();
    dbLatency = Date.now() - t1;
    dbOk = true;
  } catch (e) {
    errorMsg = String(e);
  }

  return new Response(JSON.stringify({
    status: dbOk ? 'ok' : 'error',
    uptime: process?.uptime ? Math.floor(process.uptime()) : null,
    dbConnected: dbOk,
    dbLatency,
    colo: cf.colo || 'UNKNOWN',
    country: cf.country || null,
    timestamp: new Date().toISOString(),
    error: errorMsg,
  }), { status: dbOk ? 200 : 503, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
