import { CORS, cleanString, ensurePasscodesTable, generateChallenge, json, storeChallenge } from './_shared.js';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env.RAG_DB;
  if (!db) return json({ error: 'D1 binding RAG_DB not configured' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const passcodeId = cleanString(body.passcode_id);
  if (!passcodeId) return json({ error: 'passcode_id is required' }, 400);

  let valid = false;
  for (let i = 1; i <= 500; i++) {
    if (env[`passcode${i}`] === passcodeId) { valid = true; break; }
  }
  if (!valid) return json({ error: 'Unknown passcode' }, 404);

  try {
    await ensurePasscodesTable(db);
    const challenge = generateChallenge();
    await storeChallenge(db, passcodeId, challenge);
    return json({ challenge });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}