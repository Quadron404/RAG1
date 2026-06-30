import { CORS, ensurePasscodesTable, json } from './_shared.js';

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const db = env.RAG_DB;
  if (!db) return json({ error: 'D1 binding RAG_DB not configured' }, 500);

  let passcodeId;
  try {
    const body = await request.json();
    passcodeId = typeof body.passcode_id === 'string' ? body.passcode_id.trim() : '';
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (!passcodeId) return json({ error: 'passcode_id is required' }, 400);

  try {
    await ensurePasscodesTable(db);

    const result = await db
      .prepare("UPDATE passcodes SET status = 'Compromised' WHERE passcode_id = ?")
      .bind(passcodeId)
      .run();

    if (!result.meta?.changes) return json({ error: 'Unknown passcode' }, 404);
    return json({ success: true, passcode_id: passcodeId, status: 'Compromised' });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
