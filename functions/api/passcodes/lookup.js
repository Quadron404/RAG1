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
    let valid = false;
    for (let i = 1; i <= 500; i++) {
      const key = `passcode${i}`;
      if (env[key] === passcodeId) {
        valid = true;
        break;
      }
    }

    if (!valid) return json({ error: 'Unknown passcode' }, 404);

    await ensurePasscodesTable(db);

    const passcode = await db
      .prepare(
        `SELECT passcode_id, status, webauthn_credential_id
         FROM passcodes
         WHERE passcode_id = ?`,
      )
      .bind(passcodeId)
      .first();

    if (passcode && (passcode.status === 'Flagged' || passcode.status === 'Compromised')) {
      return json({
        passcode_id: passcode.passcode_id,
        status: passcode.status,
        webauthn_credential_id: passcode.webauthn_credential_id,
      });
    }

    if (!passcode) {
      return json({
        passcode_id: passcodeId,
        status: 'Unused',
        webauthn_credential_id: null,
      });
    }

    return json({
      passcode_id: passcode.passcode_id,
      status: passcode.status,
      webauthn_credential_id: passcode.webauthn_credential_id,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
